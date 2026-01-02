import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import { sharedStyles } from '../utils/styles';
import { getImageUrl } from '../utils/imageUrl';

interface Ingredient {
  name: string;
  quantity?: number;
  unit?: string;
}

export default function RecipeEdit() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const isNew = !id;

  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [instructions, setInstructions] = useState('');
  const [prepTime, setPrepTime] = useState<number | ''>('');
  const [cookTime, setCookTime] = useState<number | ''>('');
  const [servings, setServings] = useState<number | ''>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!isNew) {
      fetchRecipe();
    }
  }, [id, isNew]);

  const fetchRecipe = async () => {
    try {
      const response = await api.get(`/recipes/${id}`);
      const recipe = response.data;
      
      // Check if user can edit this recipe
      if (!isAdmin && recipe.created_by !== user?.id) {
        setError('You do not have permission to edit this recipe');
        setTimeout(() => navigate('/recipes'), 2000);
        return;
      }
      
      setTitle(recipe.title || '');
      setCoverImage(recipe.cover_image || null);
      setDescription(recipe.description || '');
      setIngredients(recipe.ingredients || []);
      setInstructions(recipe.instructions || '');
      setPrepTime(recipe.prep_time_minutes || '');
      setCookTime(recipe.cook_time_minutes || '');
      setServings(recipe.servings || '');
      setSourceUrl(recipe.source_url || '');
      setTags(recipe.tags || []);
      setIsPrivate(recipe.is_private || false);
    } catch (err) {
      console.error('Error fetching recipe:', err);
      setError('Failed to load recipe');
    }
  };

  const handleCoverImageUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/recipes/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Store just the path (e.g., /uploads/...), not the full URL
      const imagePath = response.data.image_url;
      setCoverImage(imagePath);
    } catch (error) {
      console.error('Error uploading cover image:', error);
      alert('Failed to upload cover image');
    } finally {
      setUploadingCover(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: undefined, unit: '' }]);
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number | undefined) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const recipeData = {
        title,
        cover_image: coverImage || null,
        description: description || null,
        ingredients: ingredients.filter(ing => ing.name.trim()),
        instructions: instructions || null,
        prep_time_minutes: prepTime ? Number(prepTime) : null,
        cook_time_minutes: cookTime ? Number(cookTime) : null,
        servings: servings ? Number(servings) : null,
        source_url: sourceUrl || null,
        tags: tags || [], // Always send tags array, even if empty
        is_private: isPrivate,
      };

      if (isNew) {
        await api.post('/recipes', recipeData);
      } else {
        await api.put(`/recipes/${id}`, recipeData);
      }

      navigate('/recipes');
    } catch (err: any) {
      console.error('Error saving recipe:', err);
      setError(err.response?.data?.detail || 'Failed to save recipe');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <style>{sharedStyles}</style>
      
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/recipes')}
          className="action-button action-button-secondary"
        >
          ← Back to Recipes
        </button>
      </div>

      <div className="page-header">
        <h1 className="page-title" style={{ fontSize: '2rem' }}>
          {isNew ? 'Create New Recipe' : 'Edit Recipe'}
        </h1>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="form-input"
              placeholder="Enter recipe title"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Cover Image</label>
            {coverImage && (
              <div style={{ marginBottom: '12px' }}>
                <img 
                  src={getImageUrl(coverImage) || ''} 
                  alt="Cover preview" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '300px', 
                    borderRadius: '8px',
                    objectFit: 'cover',
                    display: 'block',
                    marginBottom: '12px'
                  }} 
                />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="action-button action-button-danger"
                  style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                >
                  Remove Cover Image
                </button>
              </div>
            )}
            <label
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: uploadingCover ? '#6c757d' : '#007bff',
                color: 'white',
                borderRadius: '8px',
                cursor: uploadingCover ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                border: 'none'
              }}
            >
              {uploadingCover ? 'Uploading...' : coverImage ? 'Change Cover Image' : 'Upload Cover Image'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleCoverImageUpload(file);
                  }
                }}
                disabled={uploadingCover}
                style={{ display: 'none' }}
              />
            </label>
            <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#666' }}>
              This image will be displayed on recipe cards and at the top of the recipe page.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Enter recipe description..."
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">Ingredients</label>
            <div>
              {ingredients.map((ing, index) => (
                <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={ing.quantity || ''}
                    onChange={(e) => updateIngredient(index, 'quantity', e.target.value ? Number(e.target.value) : undefined)}
                    className="form-input"
                    style={{ width: '100px' }}
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={ing.unit || ''}
                    onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                    className="form-input"
                    style={{ width: '120px' }}
                  />
                  <input
                    type="text"
                    placeholder="Ingredient name"
                    value={ing.name}
                    onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                    required
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="action-button action-button-danger"
                    style={{ padding: '12px 16px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addIngredient}
                className="action-button action-button-success"
              >
                + Add Ingredient
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Instructions</label>
            <RichTextEditor
              content={instructions}
              onChange={setInstructions}
              placeholder="Enter step-by-step instructions..."
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Prep Time (minutes)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : '')}
                className="form-input"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cook Time (minutes)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value ? Number(e.target.value) : '')}
                className="form-input"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Servings</label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value ? Number(e.target.value) : '')}
                className="form-input"
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source URL</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="form-input"
              placeholder="https://example.com/recipe"
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
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">Tags</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag"
                className="form-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={addTag}
                className="action-button action-button-secondary"
              >
                Add Tag
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.map((tag, idx) => (
                <span key={idx} className="tag" style={{ position: 'relative', paddingRight: '28px' }}>
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => removeTag(tag, e)}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      lineHeight: 1,
                      color: '#dc3545',
                      padding: '0',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8d7da';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="submit"
            disabled={loading}
            className="action-button action-button-primary"
            style={{ 
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Saving...' : isNew ? '✨ Create Recipe' : '💾 Save Changes'}
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
  );
}
