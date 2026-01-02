import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sharedStyles } from '../utils/styles';

export default function Home() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="page-container">
      <style>{sharedStyles}</style>
      <div className="page-header">
        <h1 className="page-title">Recipe Tracking App</h1>
        <p className="page-subtitle">Welcome back, {user?.username}!</p>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px',
        marginTop: '40px'
      }}>
        <Link
          to="/recipes"
          className="card"
          style={{ 
            textDecoration: 'none', 
            color: 'inherit',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#213547' }}>Browse Recipes</h2>
          <p style={{ margin: 0, color: '#666' }}>Explore your collection of recipes</p>
        </Link>

        {isAdmin && (
          <>
            <Link
              to="/recipes/new"
              className="card"
              style={{ 
                textDecoration: 'none', 
                color: 'inherit',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>➕</div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#213547' }}>Create Recipe</h2>
              <p style={{ margin: 0, color: '#666' }}>Add a new recipe to your collection</p>
            </Link>

            <Link
              to="/recipes/import"
              className="card"
              style={{ 
                textDecoration: 'none', 
                color: 'inherit',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📥</div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#213547' }}>Import Recipe</h2>
              <p style={{ margin: 0, color: '#666' }}>Import recipes from the web</p>
            </Link>
          </>
        )}

        <Link
          to="/meal-plans"
          className="card"
          style={{ 
            textDecoration: 'none', 
            color: 'inherit',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📅</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#213547' }}>Meal Plans</h2>
          <p style={{ margin: 0, color: '#666' }}>Plan your meals and shopping lists</p>
        </Link>
      </div>
    </div>
  );
}
