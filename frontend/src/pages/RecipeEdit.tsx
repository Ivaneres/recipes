import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import { getImageUrl } from '../utils/imageUrl';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

/** If instructions are plain text (e.g. from import), convert newlines to HTML so the rich editor preserves them on save. */
function instructionsForEditor(instructions: string): string {
  if (!instructions?.trim()) return instructions ?? '';
  const trimmed = instructions.trim();
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const paragraphs = trimmed.split(/\n\n+/);
  const html = paragraphs
    .map((p) => {
      const lineBreaks = p.split(/\n/).map((line) => escape(line)).join('<br>');
      return lineBreaks ? `<p>${lineBreaks}</p>` : '';
    })
    .filter(Boolean)
    .join('');
  return html || '<p></p>';
}

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
  const { push } = useToast();

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
      setInstructions(instructionsForEditor(recipe.instructions || ''));
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
      push({ kind: 'error', title: 'Upload failed', message: 'Failed to upload cover image.' });
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

      push({ kind: 'success', title: 'Saved', message: isNew ? 'Recipe created.' : 'Changes saved.' });
      navigate('/recipes');
    } catch (err: unknown) {
      console.error('Error saving recipe:', err);
      const anyErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = anyErr.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to save recipe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-page pt-6 md:pt-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/recipes')}>
          ← Recipes
        </Button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{isNew ? 'Create recipe' : 'Edit recipe'}</h1>
      <p className="mt-1 text-sm text-muted">Focus on clarity: ingredients, steps, and a strong cover image.</p>

      {error && (
        <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <div className="font-medium">Could not save</div>
          <div className="text-muted">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="text-sm font-medium">Title *</div>
              <div className="mt-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Recipe title"
                  data-testid="recipe-title"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Cover image</div>
              {coverImage && (
                <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
                  <img
                    src={getImageUrl(coverImage) || ''}
                    alt="Cover preview"
                    className="h-56 w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverImageUpload(file);
                    }}
                    disabled={uploadingCover}
                    className="hidden"
                  />
                  <span>
                    <Button variant="secondary" disabled={uploadingCover}>
                      {uploadingCover ? 'Uploading…' : coverImage ? 'Change image' : 'Upload image'}
                    </Button>
                  </span>
                </label>
                {coverImage && (
                  <Button variant="danger" onClick={() => setCoverImage(null)}>
                    Remove
                  </Button>
                )}
              </div>
              <div className="mt-2 text-xs text-muted">Used on cards and at the top of the recipe page.</div>
            </div>

            <div>
              <div className="text-sm font-medium">Description</div>
              <div className="mt-2">
                <RichTextEditor content={description} onChange={setDescription} placeholder="Short intro…" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Ingredients</div>
                <div className="text-xs text-muted">One per line. Keep names short and consistent.</div>
              </div>
              <Button variant="secondary" size="sm" onClick={addIngredient} data-testid="add-ingredient">
                + Add
              </Button>
            </div>

            <div className="space-y-2">
              {ingredients.map((ing, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={ing.quantity ?? ''}
                      onChange={(e) =>
                        updateIngredient(index, 'quantity', e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="text"
                      placeholder="Unit"
                      value={ing.unit || ''}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-7">
                    <Input
                      type="text"
                      placeholder="Ingredient"
                      value={ing.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-1">
                    <Button variant="danger" size="sm" onClick={() => removeIngredient(index)} className="w-full">
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {ingredients.length === 0 && <div className="text-sm text-muted">No ingredients yet.</div>}
            </div>

            <div>
              <div className="text-sm font-medium">Instructions</div>
              <div className="mt-2">
                <RichTextEditor content={instructions} onChange={setInstructions} placeholder="Step-by-step…" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-sm font-medium">Prep (min)</div>
                <Input
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-sm font-medium">Cook (min)</div>
                <Input
                  type="number"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-sm font-medium">Servings</div>
                <Input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Source URL</div>
              <div className="mt-2">
                <Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(var(--primary))]"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span>Make private (only visible to you)</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="text-sm font-semibold">Tags</div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag"
              />
              <Button variant="secondary" onClick={addTag}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => removeTag(tag, e)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted hover:bg-surface2"
                >
                  {tag} <span aria-hidden="true">×</span>
                </button>
              ))}
              {tags.length === 0 && <div className="text-sm text-muted">No tags.</div>}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="primary" disabled={loading} data-testid="recipe-submit">
            {loading ? 'Saving…' : isNew ? 'Create recipe' : 'Save changes'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/recipes')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
