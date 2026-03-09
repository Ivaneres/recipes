import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AdminFeatures from '../components/AdminFeatures';
import { RecipeInteractions } from '../components/AdminFeatures';
import { fixImageUrls, getImageUrl } from '../utils/imageUrl';
import { sharedStyles } from '../utils/styles';

interface Recipe {
  id: number;
  title: string;
  cover_image: string | null;
  description: string;
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  instructions: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  source_url: string | null;
  tags: string[];
  created_by: number;
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [scaleInputValue, setScaleInputValue] = useState('1');
  const { isAdmin, isGuest, user } = useAuth();
  
  // Check if current user is the recipe creator
  const isRecipeCreator = recipe && user && recipe.created_by === user.id;

  useEffect(() => {
    fetchRecipe();
  }, [id]);

  // Sync input value when scaleFactor changes (e.g., from preset buttons)
  useEffect(() => {
    setScaleInputValue(scaleFactor % 1 === 0 ? scaleFactor.toString() : scaleFactor.toFixed(2).replace(/\.?0+$/, ''));
  }, [scaleFactor]);

  const fetchRecipe = async () => {
    try {
      const response = await api.get(`/recipes/${id}`);
      setRecipe(response.data);
    } catch (error) {
      console.error('Error fetching recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) {
      return;
    }
    try {
      await api.delete(`/recipes/${id}`);
      navigate('/recipes');
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Failed to delete recipe');
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', color: '#213547' }}>Loading...</div>;
  }

  if (!recipe) {
    return <div style={{ padding: '20px', color: '#213547' }}>Recipe not found</div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <style>{`
        ${sharedStyles}
        .recipe-detail img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 16px 0;
          display: block;
        }
        .recipe-meta {
          display: flex;
          gap: 24px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .recipe-meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #666;
          font-size: 0.95rem;
        }
        .recipe-section {
          margin-bottom: 32px;
        }
        .recipe-section h2 {
          font-size: 1.75rem;
          font-weight: 600;
          color: #213547;
          margin: 0 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e9ecef;
        }
        .ingredients-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .ingredients-list li {
          padding: 12px 16px;
          margin-bottom: 8px;
          background: #f8f9fa;
          border-radius: 8px;
          color: #213547;
          border-left: 3px solid #007bff;
        }
        .recipe-cover-image {
          width: 100%;
          max-height: 500px;
          object-fit: cover;
          border-radius: 12px;
          margin: 24px 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      
      <div style={{ marginBottom: '24px' }}>
        <Link 
          to="/recipes" 
          className="action-button action-button-secondary"
          style={{ textDecoration: 'none' }}
        >
          ← Back to Recipes
        </Link>
      </div>

      {!isGuest && (isAdmin || isRecipeCreator) && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <Link
            to={`/recipes/${id}/edit`}
            className="action-button action-button-primary"
            style={{ textDecoration: 'none' }}
          >
            ✏️ Edit
          </Link>
          <button
            onClick={handleDelete}
            className="action-button action-button-danger"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '32px' }}>
        <h1 className="page-title" style={{ fontSize: '2.25rem', marginBottom: '16px' }}>
          {recipe.title}
        </h1>
        
        {recipe.cover_image && (
          <img 
            src={getImageUrl(recipe.cover_image) || ''} 
            alt={recipe.title}
            className="recipe-cover-image"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        
        {recipe.tags && recipe.tags.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {recipe.tags.map((tag, idx) => (
              <span key={idx} className="tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="recipe-meta">
          {recipe.prep_time_minutes && (
            <div className="recipe-meta-item">
              <span>⏱️</span>
              <span><strong>{recipe.prep_time_minutes}</strong> min prep</span>
            </div>
          )}
          {recipe.cook_time_minutes && (
            <div className="recipe-meta-item">
              <span>🔥</span>
              <span><strong>{recipe.cook_time_minutes}</strong> min cook</span>
            </div>
          )}
          {recipe.servings && (
            <div className="recipe-meta-item">
              <span>👥</span>
              <span>
                <strong>
                  {scaleFactor === 1 
                    ? recipe.servings 
                    : (recipe.servings * scaleFactor) % 1 === 0
                      ? (recipe.servings * scaleFactor).toString()
                      : (recipe.servings * scaleFactor).toFixed(1).replace(/\.?0+$/, '')
                  }
                </strong> servings
                {scaleFactor !== 1 && (
                  <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '4px' }}>
                    (original: {recipe.servings})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {recipe.description && (
          <div
            className="recipe-detail"
            style={{ 
              marginBottom: '32px', 
              color: '#213547',
              lineHeight: '1.7',
              fontSize: '1.05rem'
            }}
            dangerouslySetInnerHTML={{ __html: fixImageUrls(recipe.description) }}
          />
        )}
      </div>

      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div className="recipe-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ margin: 0 }}>Ingredients</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.95rem', color: '#666', fontWeight: '500' }}>Scale:</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[0.5, 0.75, 1, 1.5, 2].map((factor) => {
                  const isActive = Math.abs(scaleFactor - factor) < 0.01; // Account for floating point precision
                  return (
                    <button
                      key={factor}
                      onClick={() => {
                        setScaleFactor(factor);
                        setScaleInputValue(factor.toString());
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: isActive ? '2px solid #007bff' : '1px solid #e0e0e0',
                        background: isActive ? '#e7f3ff' : 'white',
                        color: isActive ? '#007bff' : '#213547',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: isActive ? '600' : '400',
                        transition: 'all 0.2s'
                      }}
                    >
                      {factor}x
                    </button>
                  );
                })}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                  <input
                    type="number"
                    min="0.01"
                    max="10"
                    step="0.01"
                    value={scaleInputValue}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setScaleInputValue(inputValue);
                      // Allow empty input while typing
                      if (inputValue === '' || inputValue === '.') {
                        return;
                      }
                      const value = parseFloat(inputValue);
                      if (!isNaN(value) && value > 0 && value <= 10) {
                        setScaleFactor(value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (isNaN(value) || value <= 0 || e.target.value === '' || e.target.value === '.') {
                        setScaleFactor(1);
                        setScaleInputValue('1');
                      } else if (value > 10) {
                        setScaleFactor(10);
                        setScaleInputValue('10');
                      } else {
                        // Format the value to remove unnecessary decimals
                        setScaleInputValue(value % 1 === 0 ? value.toString() : value.toFixed(2).replace(/\.?0+$/, ''));
                      }
                    }}
                    style={{
                      width: '70px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: ![0.5, 0.75, 1, 1.5, 2].some(f => Math.abs(scaleFactor - f) < 0.01) 
                        ? '2px solid #007bff' 
                        : '1px solid #e0e0e0',
                      background: ![0.5, 0.75, 1, 1.5, 2].some(f => Math.abs(scaleFactor - f) < 0.01)
                        ? '#e7f3ff'
                        : 'white',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                    placeholder="Custom"
                  />
                  <span style={{ fontSize: '0.875rem', color: '#666' }}>x</span>
                </div>
              </div>
            </div>
          </div>
          <ul className="ingredients-list">
            {recipe.ingredients.map((ing, idx) => {
              const scaledQuantity = ing.quantity ? (ing.quantity * scaleFactor) : null;
              // Format the scaled quantity to avoid unnecessary decimals
              const formattedQuantity = scaledQuantity !== null 
                ? scaledQuantity % 1 === 0 
                  ? scaledQuantity.toString() 
                  : scaledQuantity.toFixed(2).replace(/\.?0+$/, '')
                : null;
              
              return (
                <li key={idx}>
                  {formattedQuantity && <strong>{formattedQuantity}</strong>}
                  {formattedQuantity && ing.unit && ' '}
                  {ing.unit && <strong>{ing.unit}</strong>}
                  {(formattedQuantity || ing.unit) && ' '}
                  {ing.name}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {recipe.instructions && (
        <div className="recipe-section">
          <h2>Instructions</h2>
          {/<[a-z][\s\S]*>/i.test(recipe.instructions) ? (
            <div
              className="recipe-detail"
              style={{
                color: '#213547',
                lineHeight: '1.8',
                fontSize: '1.05rem',
              }}
              dangerouslySetInnerHTML={{ __html: fixImageUrls(recipe.instructions) }}
            />
          ) : (
            <div
              className="recipe-detail"
              style={{
                color: '#213547',
                lineHeight: '1.8',
                fontSize: '1.05rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {recipe.instructions}
            </div>
          )}
        </div>
      )}

      {recipe.source_url && (
        <div style={{ marginTop: '32px' }}>
          <a 
            href={recipe.source_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="action-button action-button-secondary"
            style={{ textDecoration: 'none' }}
          >
            🔗 View Original Source
          </a>
        </div>
      )}

      {/* Ratings and Comments - Available to everyone */}
      <RecipeInteractions recipeId={recipe.id} />

      {/* Private Notes - Only visible to recipe creator */}
      {!isGuest && isRecipeCreator && (
        <div style={{ marginTop: '40px' }}>
          <AdminFeatures recipeId={recipe.id} />
        </div>
      )}
    </div>
  );
}
