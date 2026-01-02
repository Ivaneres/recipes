import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sharedStyles } from '../utils/styles';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register, loginAsGuest } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        // Validate password confirmation
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        await register(username, email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: '#ffffff'
    }}>
      <style>{sharedStyles}</style>
      <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '8px' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="page-subtitle" style={{ fontSize: '1rem' }}>
            {isLogin ? 'Sign in to continue' : 'Get started with recipe tracking'}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="form-input"
              placeholder="Enter your username"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                placeholder="Enter your email"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="Enter your password"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="form-input"
                placeholder="Confirm your password"
              />
            </div>
          )}

          <button
            type="submit"
            className="action-button action-button-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '20px' }}
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {isLogin && (
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ 
              margin: '20px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              color: '#666'
            }}>
              <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
              <span style={{ fontSize: '0.875rem' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: '#e0e0e0' }}></div>
            </div>
            <button
              type="button"
              onClick={() => {
                loginAsGuest();
                navigate('/');
              }}
              className="action-button action-button-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              👤 Login as Guest
            </button>
            <p style={{ 
              marginTop: '12px', 
              fontSize: '0.875rem', 
              color: '#888',
              lineHeight: '1.5'
            }}>
              Browse public recipes without creating an account
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', margin: 0, color: '#666' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setPassword('');
              setConfirmPassword('');
            }}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#007bff', 
              cursor: 'pointer',
              fontWeight: '500',
              textDecoration: 'underline'
            }}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}
