import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sharedStyles } from '../utils/styles';

export default function Navigation() {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Don't show navigation on login page
  if (location.pathname === '/login') {
    return null;
  }

  return (
    <nav style={{
      background: 'white',
      borderBottom: '1px solid #e0e0e0',
      padding: '16px 20px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <style>{sharedStyles}</style>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <Link
            to="/"
            className="action-button action-button-secondary"
            style={{ 
              textDecoration: 'none',
              padding: '10px 20px',
              fontWeight: '600'
            }}
          >
            🏠 Home
          </Link>
          <Link
            to="/recipes"
            className="action-button action-button-secondary"
            style={{ 
              textDecoration: 'none',
              padding: '10px 20px'
            }}
          >
            📚 Recipes
          </Link>
          <Link
            to="/meal-plans"
            className="action-button action-button-secondary"
            style={{ 
              textDecoration: 'none',
              padding: '10px 20px'
            }}
          >
            📅 Meal Plans
          </Link>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>
            {user?.username}
          </span>
          <button
            onClick={logout}
            className="action-button action-button-secondary"
            style={{ padding: '10px 20px', fontSize: '0.9rem' }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
