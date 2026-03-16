import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sharedStyles } from '../utils/styles';

export default function Navigation() {
  const location = useLocation();
  const { user, isGuest, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close menu when navigating
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Don't show navigation on login page
  if (location.pathname === '/login') {
    return null;
  }

  const navLinks = (
    <>
      <Link
        to="/"
        className="action-button action-button-secondary"
        onClick={() => setIsOpen(false)}
        style={{ textDecoration: 'none', padding: '10px 20px', fontWeight: '600' }}
      >
        🏠 Home
      </Link>
      <Link
        to="/recipes"
        className="action-button action-button-secondary"
        onClick={() => setIsOpen(false)}
        style={{ textDecoration: 'none', padding: '10px 20px' }}
      >
        📚 Recipes
      </Link>
      {!isGuest && (
        <Link
          to="/meal-plans"
          className="action-button action-button-secondary"
          onClick={() => setIsOpen(false)}
          style={{ textDecoration: 'none', padding: '10px 20px' }}
        >
          📅 Meal Plans
        </Link>
      )}
    </>
  );

  return (
    <nav style={{
      background: 'white',
      borderBottom: '2px solid #e0e0e0',
      padding: '16px 20px',
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
      }}>
        {isMobile ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '1.4rem',
              padding: '8px 12px',
              cursor: 'pointer',
              lineHeight: 1,
              minHeight: '44px',
            }}
            aria-label="Toggle navigation"
          >
            {isOpen ? '✕' : '☰'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {navLinks}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>
            {isGuest ? 'Guest' : user?.username}
          </span>
          <button
            onClick={logout}
            className="action-button action-button-secondary"
            style={{ padding: '10px 20px', fontSize: '0.9rem' }}
          >
            {isGuest ? 'Login' : 'Logout'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {isMobile && isOpen && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingTop: '12px',
          borderTop: '1px solid #e0e0e0',
          marginTop: '12px',
        }}>
          {navLinks}
        </div>
      )}
    </nav>
  );
}
