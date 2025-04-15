const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(session({
  secret: 'library-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',       
  password: 'project',   
  database: 'library',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established successfully!');
    connection.release();
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

testConnection();

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ success: false, message: 'Authentication required' });
};

const isAdmin = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT role FROM users WHERE user_id = ?',
      [req.session.userId]
    );
    
    if (rows.length > 0 && rows[0].role === 'admin') {
      return next();
    }
    
    res.status(403).json({ success: false, message: 'Admin privileges required' });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'user']
    );
    
    res.status(201).json({ success: true, userId: result.insertId });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Error registering user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = users[0];
    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    req.session.userId = user.user_id;
    
    res.json({ 
      success: true, 
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.get('/api/books', async (req, res) => {
  try {
    let query = 'SELECT * FROM books';
    const params = [];
    const conditions = [];
    
    if (req.query.title) {
      conditions.push('title LIKE ?');
      params.push(`%${req.query.title}%`);
    }
    
    if (req.query.author) {
      conditions.push('author LIKE ?');
      params.push(`%${req.query.author}%`);
    }
    
    if (req.query.genre) {
      conditions.push('genre LIKE ?');
      params.push(`%${req.query.genre}%`);
    }
    
    if (req.query.availability) {
      conditions.push('availability = ?');
      params.push(req.query.availability);
    }
    
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const [books] = await pool.query(query, params);
    res.json({ success: true, books });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const [books] = await pool.query(
      'SELECT * FROM books WHERE book_id = ?',
      [req.params.id]
    );
    
    if (books.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    
    res.json({ success: true, book: books[0] });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/books', isAuthenticated, isAdmin, async (req, res) => {
  const { title, author, genre } = req.body;
  
  try {
    const [result] = await pool.query(
      'INSERT INTO books (title, author, genre, availability) VALUES (?, ?, ?, ?)',
      [title, author, genre, 'available']
    );
    
    res.status(201).json({ 
      success: true, 
      book: {
        book_id: result.insertId,
        title,
        author,
        genre,
        availability: 'available'
      }
    });
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/books/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { title, author, genre, availability } = req.body;
  
  try {
    await pool.query(
      'UPDATE books SET title = ?, author = ?, genre = ?, availability = ? WHERE book_id = ?',
      [title, author, genre, availability, req.params.id]
    );
    
    res.json({ success: true, message: 'Book updated successfully' });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/books/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [loans] = await pool.query(
      'SELECT * FROM loans WHERE book_id = ? AND return_date IS NULL',
      [req.params.id]
    );
    
    if (loans.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete a book that is currently borrowed' });
    }
    
    await pool.query('DELETE FROM books WHERE book_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.post('/api/loans', isAuthenticated, async (req, res) => {
  const { bookId } = req.body;
  const userId = req.session.userId;
  
  try {
    const [books] = await pool.query(
      'SELECT * FROM books WHERE book_id = ?',
      [bookId]
    );
    
    if (books.length === 0) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    
    if (books[0].availability !== 'available') {
      return res.status(400).json({ success: false, message: 'Book is not available for borrowing' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      await connection.query(
        'UPDATE books SET availability = ? WHERE book_id = ?',
        ['borrowed', bookId]
      );
      
      const [result] = await connection.query(
        'INSERT INTO loans (book_id, user_id, loan_date) VALUES (?, ?, NOW())',
        [bookId, userId]
      );
      
      await connection.commit();
      
      res.status(201).json({ 
        success: true, 
        message: 'Book borrowed successfully',
        loanId: result.insertId
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error borrowing book:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/loans/:id/return', isAuthenticated, async (req, res) => {
  const loanId = req.params.id;
  
  try {
    const [loans] = await pool.query(
      'SELECT * FROM loans WHERE loan_id = ?',
      [loanId]
    );
    
    if (loans.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    
    const loan = loans[0];
    
    if (loan.return_date) {
      return res.status(400).json({ success: false, message: 'Book has already been returned' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      await connection.query(
        'UPDATE loans SET return_date = NOW() WHERE loan_id = ?',
        [loanId]
      );
      
      await connection.query(
        'UPDATE books SET availability = ? WHERE book_id = ?',
        ['available', loan.book_id]
      );
      
      await connection.commit();
      
      res.json({ success: true, message: 'Book returned successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/loans/user', isAuthenticated, async (req, res) => {
  try {
    const [loans] = await pool.query(
      `SELECT l.loan_id, l.loan_date, l.return_date, 
              b.book_id, b.title, b.author, b.genre 
       FROM loans l
       JOIN books b ON l.book_id = b.book_id
       WHERE l.user_id = ?
       ORDER BY l.loan_date DESC`,
      [req.session.userId]
    );
    
    res.json({ success: true, loans });
  } catch (error) {
    console.error('Error fetching user loans:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/loans', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [loans] = await pool.query(
      `SELECT l.loan_id, l.loan_date, l.return_date, 
              b.book_id, b.title, b.author,
              u.user_id, u.name as user_name, u.email
       FROM loans l
       JOIN books b ON l.book_id = b.book_id
       JOIN users u ON l.user_id = u.user_id
       ORDER BY l.loan_date DESC`
    );
    
    res.json({ success: true, loans });
  } catch (error) {
    console.error('Error fetching all loans:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT user_id, name, email, role FROM users ORDER BY user_id'
    );
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT user_id, name, email, role FROM users WHERE user_id = ?',
      [req.params.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user: users[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { name, email, role } = req.body;
  
  try {
    if (email) {
      const [existingUsers] = await pool.query(
        'SELECT * FROM users WHERE email = ? AND user_id != ?',
        [email, req.params.id]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already in use by another user' });
      }
    }
    
    await pool.query(
      'UPDATE users SET name = ?, email = ?, role = ? WHERE user_id = ?',
      [name, email, role, req.params.id]
    );
    
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.session.userId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    
    const [activeLoans] = await pool.query(
      'SELECT * FROM loans WHERE user_id = ? AND return_date IS NULL',
      [req.params.id]
    );
    
    if (activeLoans.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete user with active loans. User must return all books first.'
      });
    }
    
    await pool.query('DELETE FROM loans WHERE user_id = ?', [req.params.id]);
    
    await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/users/:id/reset-password', isAuthenticated, isAdmin, async (req, res) => {
  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'New password must be at least 6 characters long' 
    });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE users SET password = ? WHERE user_id = ?',
      [hashedPassword, req.params.id]
    );
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
