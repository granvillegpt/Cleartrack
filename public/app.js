const { useState, useEffect, useCallback } = React;

// Use Firebase-backed API from firebase-api.js instead of the old HTTP API.
const api = window.firebaseApi;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    try {
      const response = await api.login(email, password);
      localStorage.setItem('token', response.token);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      localStorage.setItem('token', response.token);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), 3000)
      );
      
      const response = await Promise.race([
        api.getCurrentUser(),
        timeoutPromise
      ]);
      
      if (response && response.user) {
        setUser(response.user);
      }
    } catch (error) {
      console.log('Auth check failed:', error.message);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const LoginForm = ({ onSwitchToRegister, onLogin }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await onLogin(formData.email, formData.password);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="form-container">
      <h2 className="text-center mb-6">Login to Cleartrack</h2>
      {error && <div className="alert alert-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>
        
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Login
        </button>
      </form>
      
      <p className="text-center mt-4">
        Don't have an account?{' '}
        <button 
          type="button" 
          className="btn btn-outline" 
          onClick={onSwitchToRegister}
        >
          Register
        </button>
      </p>
    </div>
  );
};

// Register Component
const RegisterForm = ({ onSwitchToLogin, onRegister }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    idNumber: '',
    isPractitioner: false
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await onRegister(formData);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="form-container">
      <h2 className="text-center mb-6">Create Account</h2>
      {error && <div className="alert alert-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            minLength="6"
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="idNumber">ID Number</label>
            <input
              type="text"
              id="idNumber"
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
            />
          </div>
        </div>
        
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={formData.isPractitioner}
              onChange={(e) => setFormData({ ...formData, isPractitioner: e.target.checked })}
            />
            {' '}I am a tax practitioner
          </label>
        </div>
        
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Create Account
        </button>
      </form>
      
      <p className="text-center mt-4">
        Already have an account?{' '}
        <button 
          type="button" 
          className="btn btn-outline" 
          onClick={onSwitchToLogin}
        >
          Login
        </button>
      </p>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await api.getDashboard();
        setDashboardData(data.dashboard);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return <div className="text-center">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="mb-6">Dashboard</h1>
      
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{dashboardData?.documentCount || 0}</div>
          <div className="stat-label">Documents Uploaded</div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-value">{dashboardData?.vehicleCount || 0}</div>
          <div className="stat-label">Vehicles Registered</div>
        </div>
        
        <div className="stat-card warning">
          <div className="stat-value">{dashboardData?.expenseCount || 0}</div>
          <div className="stat-label">Expenses Recorded</div>
        </div>
        
        <div className="stat-card danger">
          <div className="stat-value">R {dashboardData?.totalExpenseAmount?.toLocaleString() || 0}</div>
          <div className="stat-label">Total Expenses</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="flex gap-4">
            <button className="btn btn-primary">Upload Document</button>
            <button className="btn btn-secondary">Add Vehicle</button>
            <button className="btn btn-success">Record Expense</button>
            <button className="btn btn-outline">View Tax Return</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Documents Component
const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await api.getDocuments();
      setDocuments(response.documents);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await api.deleteDocument(id);
        setDocuments(documents.filter(doc => doc._id !== id));
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-center">Loading documents...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Documents</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowUpload(true)}
        >
          Upload Document
        </button>
      </div>

      {showUpload && (
        <DocumentUpload 
          onClose={() => setShowUpload(false)}
          onUpload={loadDocuments}
        />
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Document Type</th>
              <th>Tax Year</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => (
              <tr key={doc._id}>
                <td>{doc.documentType}</td>
                <td>{doc.taxYear}</td>
                <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                <td>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(doc._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Document Upload Component
const DocumentUpload = ({ onClose, onUpload }) => {
  const [formData, setFormData] = useState({
    documentType: '',
    taxYear: new Date().getFullYear(),
    description: ''
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('document', file);
      formDataToSend.append('documentType', formData.documentType);
      formDataToSend.append('taxYear', formData.taxYear);
      formDataToSend.append('description', formData.description);

      await api.uploadDocument(formDataToSend);
      onUpload();
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Upload Document</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="documentType">Document Type</label>
            <select
              id="documentType"
              value={formData.documentType}
              onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
              required
            >
              <option value="">Select document type</option>
              <option value="IRP5">IRP5</option>
              <option value="IT3">IT3</option>
              <option value="PAYSLIP">Payslip</option>
              <option value="BANK_STATEMENT">Bank Statement</option>
              <option value="INVOICE">Invoice</option>
              <option value="RECEIPT">Receipt</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="taxYear">Tax Year</label>
            <input
              type="number"
              id="taxYear"
              value={formData.taxYear}
              onChange={(e) => setFormData({ ...formData, taxYear: parseInt(e.target.value) })}
              min="2020"
              max={new Date().getFullYear()}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
            />
          </div>
          
          <div className="form-group">
            <label>Select File</label>
            <div className="file-upload">
              <input
                type="file"
                id="file"
                onChange={(e) => setFile(e.target.files[0])}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                required
              />
              <label htmlFor="file" className="file-upload-label">
                {file ? file.name : 'Choose file or drag and drop'}
              </label>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const { user, login, register, logout, loading } = React.useContext(AuthContext);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showLogin, setShowLogin] = useState(true);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Cleartrack...</p>
      </div>
    );
  }

  if (!user) {
    return showLogin ? (
      <LoginForm 
        onSwitchToRegister={() => setShowLogin(false)}
        onLogin={login}
      />
    ) : (
      <RegisterForm 
        onSwitchToLogin={() => setShowLogin(true)}
        onRegister={register}
      />
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'documents':
        return <Documents />;
      case 'vehicles':
        return <div>Vehicles component coming soon...</div>;
      case 'expenses':
        return <div>Expenses component coming soon...</div>;
      case 'profile':
        return <div>Profile component coming soon...</div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">Cleartrack</div>
        <nav className="nav">
          <button 
            className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-link ${currentView === 'documents' ? 'active' : ''}`}
            onClick={() => setCurrentView('documents')}
          >
            Documents
          </button>
          <button 
            className={`nav-link ${currentView === 'vehicles' ? 'active' : ''}`}
            onClick={() => setCurrentView('vehicles')}
          >
            Vehicles
          </button>
          <button 
            className={`nav-link ${currentView === 'expenses' ? 'active' : ''}`}
            onClick={() => setCurrentView('expenses')}
          >
            Expenses
          </button>
          <button 
            className={`nav-link ${currentView === 'profile' ? 'active' : ''}`}
            onClick={() => setCurrentView('profile')}
          >
            Profile
          </button>
        </nav>
        <div className="user-menu">
          <span>Welcome, {user.firstName}</span>
          <button className="btn btn-outline btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      
      <main className="main">
        {renderContent()}
      </main>
    </div>
  );
};

// Render the app using React 18's createRoot
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
