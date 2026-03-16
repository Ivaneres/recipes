import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUrl';

interface Recipe {
  id: number;
  title: string;
  cover_image: string | null;
  description: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  tags: string[];
}

// Helper function to strip HTML and get plain text
function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export default function RecipeList() {
  const { isGuest } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipes();
  }, [search]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const params = search ? { search } : {};
      const response = await api.get('/recipes', { params });
      setRecipes(response.data);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '40px 20px', 
      maxWidth: '1400px', 
      margin: '0 auto',
      color: '#213547' 
    }}>
      <style>{`
        .recipe-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .recipe-card:hover {
          transform: translateY(-4px);
          border-color: #007bff;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
        .recipe-card-image {
          width: 100%;
          height: 240px;
          object-fit: cover;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
        .recipe-card-content {
          padding: 24px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .recipe-card-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #213547;
          margin: 0 0 12px 0;
          line-height: 1.3;
        }
        .recipe-card-description {
          color: #666;
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0 0 16px 0;
          flex: 1;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .recipe-card-meta {
          display: flex;
          gap: 16px;
          font-size: 0.875rem;
          color: #888;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #f0f0f0;
        }
        .recipe-card-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .search-input {
          width: 100%;
          max-width: 500px;
          padding: 14px 20px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.2s;
        }
        .search-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        .action-button {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 500;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
        }
        .action-button-primary {
          background: #007bff;
          color: white;
        }
        .action-button-primary:hover {
          background: #0056b3;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        }
        .action-button-secondary {
          background: #f8f9fa;
          color: #213547;
          border: 1px solid #e0e0e0;
        }
        .action-button-secondary:hover {
          background: #e9ecef;
          border-color: #d0d0d0;
        }
      `}</style>

      {/* Header Section */}
      <div style={{ 
        marginBottom: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <h1 style={{ 
              color: '#213547', 
              margin: '0 0 8px 0',
              fontSize: '2.5rem',
              fontWeight: '700'
            }}>
              Recipes
            </h1>
            <p style={{ 
              color: '#666', 
              margin: 0,
              fontSize: '1.1rem'
            }}>
              Discover and manage your favorite recipes
            </p>
          </div>
          {!isGuest && (
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <Link
                to="/recipes/new"
                className="action-button action-button-primary"
              >
                <span>+</span>
                <span>New Recipe</span>
              </Link>
              <Link
                to="/recipes/import"
                className="action-button action-button-secondary"
              >
                <span>📥</span>
                <span>Import</span>
              </Link>
            </div>
          )}

        {/* Search Bar */}
        <div>
          <input
            type="text"
            placeholder="Search recipes by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Recipes Grid */}
      {loading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          color: '#666',
          fontSize: '1.1rem'
        }}>
          Loading recipes...
        </div>
      ) : recipes.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          color: '#666'
        }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No recipes found</p>
          <p style={{ color: '#888' }}>
            {search ? 'Try a different search term' : 'Get started by creating your first recipe'}
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '32px'
        }}>
          {recipes.map((recipe) => {
            const descriptionText = stripHtml(recipe.description || '');
            const previewText = descriptionText.length > 120 
              ? descriptionText.substring(0, 120) + '...' 
              : descriptionText;

            return (
              <Link
                key={recipe.id}
                to={`/recipes/${recipe.id}`}
                className="recipe-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {recipe.cover_image && (
                  <img 
                    src={getImageUrl(recipe.cover_image) || ''} 
                    alt={recipe.title}
                    className="recipe-card-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="recipe-card-content">
                  <h3 className="recipe-card-title">{recipe.title}</h3>
                  {previewText && (
                    <p className="recipe-card-description">{previewText}</p>
                  )}
                  <div className="recipe-card-meta">
                    {recipe.prep_time_minutes && (
                      <div className="recipe-card-meta-item">
                        <span>⏱️</span>
                        <span>{recipe.prep_time_minutes}m prep</span>
                      </div>
                    )}
                    {recipe.cook_time_minutes && (
                      <div className="recipe-card-meta-item">
                        <span>🔥</span>
                        <span>{recipe.cook_time_minutes}m cook</span>
                      </div>
                    )}
                    {recipe.servings && (
                      <div className="recipe-card-meta-item">
                        <span>👥</span>
                        <span>{recipe.servings} servings</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      </div>
    </div>
  );
}
