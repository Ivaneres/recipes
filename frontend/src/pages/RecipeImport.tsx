import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { sharedStyles } from '../utils/styles';

export default function RecipeImport() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importedRecipe, setImportedRecipe] = useState<any>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setImportedRecipe(null);

    try {
      const response = await api.post(`/recipes/import?url=${encodeURIComponent(url)}&is_private=${isPrivate}`);
      setImportedRecipe(response.data);
      // Navigate to the imported recipe after a short delay
      setTimeout(() => {
        navigate(`/recipes/${response.data.id}`);
      }, 2000);
    } catch (err: any) {
      console.error('Error importing recipe:', err);
      setError(err.response?.data?.detail || 'Failed to import recipe. Please try again or create the recipe manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '700px' }}>
      <style>{sharedStyles}</style>
      
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/recipes')}
          className="action-button action-button-secondary"
        >
          ← Back to Recipes
        </button>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: '24px' }}>
          <h1 className="page-title" style={{ fontSize: '2rem' }}>Import Recipe from URL</h1>
          <p className="page-subtitle" style={{ fontSize: '1rem' }}>
            Paste a URL from any recipe website to automatically import the recipe
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {importedRecipe && (
          <div className="alert alert-success">
            <strong>Success!</strong> Recipe "{importedRecipe.title}" has been imported. Redirecting...
          </div>
        )}

        <form onSubmit={handleImport}>
          <div className="form-group">
            <label className="form-label">Recipe URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com/recipe"
              required
              disabled={loading}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <span className="form-label" style={{ margin: 0 }}>
                Make this recipe private (only visible to you)
              </span>
            </label>
            <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#666', marginLeft: '32px' }}>
              Private recipes will only be visible to you and won't appear in other users' recipe lists.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="action-button action-button-primary"
              style={{ 
                opacity: (loading || !url.trim()) ? 0.6 : 1,
                cursor: (loading || !url.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '⏳ Importing...' : '📥 Import Recipe'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/recipes')}
              className="action-button action-button-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: '32px', background: '#f8f9fa' }}>
        <h3 style={{ color: '#213547', marginTop: 0, marginBottom: '12px', fontSize: '1.25rem' }}>💡 Tips</h3>
        <ul style={{ color: '#666', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
          <li>Supported sites include most recipe websites with structured data</li>
          <li>If import fails, you can manually create the recipe instead</li>
          <li>After importing, you can edit the recipe to add images or make adjustments</li>
        </ul>
      </div>
    </div>
  );
}
