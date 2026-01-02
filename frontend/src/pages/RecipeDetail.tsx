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
  const { isAdmin, user } = useAuth();
  
  // Check if current user is the recipe creator
  const isRecipeCreator = recipe && user && recipe.created_by === user.id;

  useEffect(() => {
    fetchRecipe();
  }, [id]);

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

      {isAdmin && (
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
              <span><strong>{recipe.servings}</strong> servings</span>
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
          <h2>Ingredients</h2>
          <ul className="ingredients-list">
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx}>
                {ing.quantity && <strong>{ing.quantity}</strong>}
                {ing.quantity && ing.unit && ' '}
                {ing.unit && <strong>{ing.unit}</strong>}
                {(ing.quantity || ing.unit) && ' '}
                {ing.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recipe.instructions && (
        <div className="recipe-section">
          <h2>Instructions</h2>
          <div 
            className="recipe-detail" 
            style={{ 
              color: '#213547',
              lineHeight: '1.8',
              fontSize: '1.05rem'
            }} 
            dangerouslySetInnerHTML={{ __html: fixImageUrls(recipe.instructions) }} 
          />
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
      {isRecipeCreator && (
        <div style={{ marginTop: '40px' }}>
          <AdminFeatures recipeId={recipe.id} />
        </div>
      )}
    </div>
  );
}
