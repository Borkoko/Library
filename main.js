let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
  checkLoginStatus();
  
  document.getElementById('home-link').addEventListener('click', showSection.bind(null, 'home-section'));
  document.getElementById('books-link').addEventListener('click', function() {
    showSection('books-section');
    loadBooks();
  });
  document.getElementById('my-loans-link').addEventListener('click', function() {
    showSection('my-loans-section');
    loadMyLoans();
  });
  document.getElementById('manage-books-link').addEventListener('click', function() {
    showSection('manage-books-section');
    loadAdminBooks();
  });
  document.getElementById('login-link').addEventListener('click', showSection.bind(null, 'login-section'));
  document.getElementById('register-link').addEventListener('click', showSection.bind(null, 'register-section'));
  document.getElementById('logout-link').addEventListener('click', logoutUser);
  
  document.getElementById('to-register-link').addEventListener('click', showSection.bind(null, 'register-section'));
  document.getElementById('to-login-link').addEventListener('click', showSection.bind(null, 'login-section'));
  
  document.getElementById('login-form').addEventListener('submit', loginUser);
  document.getElementById('register-form').addEventListener('submit', registerUser);
  
  document.getElementById('add-book-btn').addEventListener('click', function() {
    document.getElementById('add-book-form-container').style.display = 'block';
  });
  document.getElementById('cancel-add-book').addEventListener('click', function() {
    document.getElementById('add-book-form-container').style.display = 'none';
  });
  document.getElementById('add-book-form').addEventListener('submit', addBook);
  
  document.getElementById('search-button').addEventListener('click', function() {
    loadBooks(document.getElementById('search-input').value);
  });
  document.getElementById('filter-availability').addEventListener('change', function() {
    loadBooks(document.getElementById('search-input').value);
  });
});

function showSection(sectionId) {
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    section.style.display = 'none';
  });
  
  document.getElementById(sectionId).style.display = 'block';
  
  const links = document.querySelectorAll('#nav a');
  links.forEach(link => {
    link.classList.remove('active');
  });
  
  const linkId = sectionId.replace('section', 'link');
  const activeLink = document.getElementById(linkId);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

function checkLoginStatus() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    updateAuthUI(true);
  } else {
    updateAuthUI(false);
  }
}

function updateAuthUI(isLoggedIn) {
  const authRequired = document.querySelectorAll('.auth-required');
  const authNotRequired = document.querySelectorAll('.auth-not-required');
  const adminOnly = document.querySelectorAll('.admin-only');
  
  if (isLoggedIn) {
    authRequired.forEach(el => {
      el.style.display = '';
    });
    
    authNotRequired.forEach(el => {
      el.style.display = 'none';
    });
    
    if (currentUser && currentUser.role === 'admin') {
      adminOnly.forEach(el => {
        el.style.display = '';
      });
    } else {
      adminOnly.forEach(el => {
        el.style.display = 'none';
      });
    }
  } else {
    authRequired.forEach(el => {
      el.style.display = 'none';
    });
    
    authNotRequired.forEach(el => {
      el.style.display = '';
    });
    
    adminOnly.forEach(el => {
      el.style.display = 'none';
    });
  }
}

function loginUser(event) {
  event.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      localStorage.setItem('user', JSON.stringify(data.user));
      currentUser = data.user;
      
      updateAuthUI(true);
      
      document.getElementById('login-message').textContent = 'Login successful!';
      document.getElementById('login-message').className = 'success';
      
      setTimeout(() => {
        showSection('home-section');
      }, 1000);
    } else {
      document.getElementById('login-message').textContent = data.message || 'Login failed!';
      document.getElementById('login-message').className = 'error';
    }
  })
  .catch(error => {
    console.error('Login error:', error);
    document.getElementById('login-message').textContent = 'An error occurred during login';
    document.getElementById('login-message').className = 'error';
  });
}

function registerUser(event) {
  event.preventDefault();
  
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  
  if (password !== confirmPassword) {
    document.getElementById('register-message').textContent = 'Passwords do not match!';
    document.getElementById('register-message').className = 'error';
    return;
  }
  
  fetch('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, email, password })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      document.getElementById('register-message').textContent = 'Registration successful! Please login.';
      document.getElementById('register-message').className = 'success';
      
      document.getElementById('register-form').reset();
      
      setTimeout(() => {
        showSection('login-section');
      }, 2000);
    } else {
      document.getElementById('register-message').textContent = data.message || 'Registration failed!';
      document.getElementById('register-message').className = 'error';
    }
  })
  .catch(error => {
    console.error('Registration error:', error);
    document.getElementById('register-message').textContent = 'An error occurred during registration';
    document.getElementById('register-message').className = 'error';
  });
}

function logoutUser() {
  fetch('/api/logout', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    localStorage.removeItem('user');
    currentUser = null;
    
    updateAuthUI(false);
    
    showSection('home-section');
  })
  .catch(error => {
    console.error('Logout error:', error);
  });
}

function loadBooks(searchQuery = '') {
  const booksContainer = document.getElementById('books-container');
  booksContainer.innerHTML = '<p>Loading books...</p>';
  
  let url = '/api/books';
  const params = [];
  
  if (searchQuery) {
    if (searchQuery.length > 0) {
      params.push(`title=${encodeURIComponent(searchQuery)}`);
    }
  }
  
  const availabilityFilter = document.getElementById('filter-availability').value;
  if (availabilityFilter) {
    params.push(`availability=${encodeURIComponent(availabilityFilter)}`);
  }
  
  if (params.length > 0) {
    url += '?' + params.join('&');
  }
  
  fetch(url)
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      displayBooks(data.books, booksContainer);
    } else {
      booksContainer.innerHTML = '<p class="error">Error loading books: ' + (data.message || 'Unknown error') + '</p>';
    }
  })
  .catch(error => {
    console.error('Error loading books:', error);
    booksContainer.innerHTML = '<p class="error">Error loading books. Please try again later.</p>';
  });
}

function displayBooks(books, container) {
  if (books.length === 0) {
    container.innerHTML = '<p>No books found.</p>';
    return;
  }
  
  let html = '';
  
  books.forEach(book => {
    html += `
      <div class="book-item" data-id="${book.book_id}">
        <h3>${book.title}</h3>
        <p><strong>Author:</strong> ${book.author}</p>
        <p><strong>Genre:</strong> ${book.genre}</p>
        <p><strong>Status:</strong> ${book.availability}</p>
        ${book.availability === 'available' && currentUser ? 
          `<button class="borrow-btn" onclick="borrowBook(${book.book_id})">Borrow</button>` : ''}
        ${currentUser && currentUser.role === 'admin' ? 
          `<div>
            <button onclick="editBook(${book.book_id})">Edit</button>
            <button onclick="deleteBook(${book.book_id})">Delete</button>
          </div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function loadAdminBooks() {
  const container = document.getElementById('admin-books-container');
  loadBooks();
}

function loadMyLoans() {
  const container = document.getElementById('my-loans-container');
  container.innerHTML = '<p>Loading your loans...</p>';
  
  fetch('/api/loans/user')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      displayLoans(data.loans, container);
    } else {
      container.innerHTML = '<p class="error">Error loading loans: ' + (data.message || 'Unknown error') + '</p>';
    }
  })
  .catch(error => {
    console.error('Error loading loans:', error);
    container.innerHTML = '<p class="error">Error loading loans. Please try again later.</p>';
  });
}

function displayLoans(loans, container) {
  if (loans.length === 0) {
    container.innerHTML = '<p>You have no loans.</p>';
    return;
  }
  
  let html = '';
  
  loans.forEach(loan => {
    const returnDate = loan.return_date ? new Date(loan.return_date).toLocaleDateString() : 'Not returned yet';
    
    html += `
      <div class="loan-item" data-id="${loan.loan_id}">
        <h3>${loan.title}</h3>
        <p><strong>Author:</strong> ${loan.author}</p>
        <p><strong>Borrowed on:</strong> ${new Date(loan.loan_date).toLocaleDateString()}</p>
        <p><strong>Return date:</strong> ${returnDate}</p>
        ${!loan.return_date ? 
          `<button onclick="returnBook(${loan.loan_id})">Return Book</button>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function borrowBook(bookId) {
  if (!currentUser) {
    alert('You need to login to borrow books!');
    return;
  }
  
  fetch('/api/loans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bookId })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Book borrowed successfully!');
      loadBooks();
    } else {
      alert('Error: ' + (data.message || 'Failed to borrow book'));
    }
  })
  .catch(error => {
    console.error('Error borrowing book:', error);
    alert('Error borrowing book. Please try again later.');
  });
}

function returnBook(loanId) {
  fetch(`/api/loans/${loanId}/return`, {
    method: 'PUT'
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Book returned successfully!');
      loadMyLoans();
    } else {
      alert('Error: ' + (data.message || 'Failed to return book'));
    }
  })
  .catch(error => {
    console.error('Error returning book:', error);
    alert('Error returning book. Please try again later.');
  });
}

function addBook(event) {
  event.preventDefault();
  
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Only administrators can add books!');
    return;
  }
  
  const title = document.getElementById('book-title').value;
  const author = document.getElementById('book-author').value;
  const genre = document.getElementById('book-genre').value;
  
  fetch('/api/books', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, author, genre })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Book added successfully!');
      document.getElementById('add-book-form').reset();
      document.getElementById('add-book-form-container').style.display = 'none';
      loadAdminBooks();
    } else {
      alert('Error: ' + (data.message || 'Failed to add book'));
    }
  })
  .catch(error => {
    console.error('Error adding book:', error);
    alert('Error adding book. Please try again later.');
  });
}

function editBook(bookId) {
  alert('Edit book functionality not implemented yet');
}

function deleteBook(bookId) {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Only administrators can delete books!');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this book?')) {
    return;
  }
  
  fetch(`/api/books/${bookId}`, {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('Book deleted successfully!');
      loadAdminBooks();
    } else {
      alert('Error: ' + (data.message || 'Failed to delete book'));
    }
  })
  .catch(error => {
    console.error('Error deleting book:', error);
    alert('Error deleting book. Please try again later.');
  });
}
