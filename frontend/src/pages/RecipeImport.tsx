import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { sharedStyles } from '../utils/styles';

interface Ingredient {
  name: string;
  quantity?: number;
  unit?: string;
}

interface PreviewRecipe {
  title: string;
  description?: string | null;
  ingredients?: Ingredient[] | null;
  instructions?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  servings?: number | null;
  source_url?: string | null;
}

interface PreviewData {
  recipe: PreviewRecipe;
  raw_ingredient_lines: string[];
  image_urls: string[];
  instructions_raw?: string | null;
}

export default function RecipeImport() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Preview step state (editable)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [instructions, setInstructions] = useState('');
  const [prepTime, setPrepTime] = useState<number | ''>('');
  const [cookTime, setCookTime] = useState<number | ''>('');
  const [servings, setServings] = useState<number | ''>('');
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  // Raw ingredients text: from extractor (editable) or pasted by user. Re-parsing replaces the table.
  const [rawIngredientText, setRawIngredientText] = useState('');
  const [parsePattern, setParsePattern] = useState<'quantity_unit_name' | 'quantity_only' | 'name_only'>('quantity_unit_name');
  const [parsingIngredients, setParsingIngredients] = useState(false);

  const handleFetchPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/recipes/import/preview`, {
        params: { url: url.trim() },
      });
      const data = response.data as PreviewData;
      setPreviewData(data);
      setTitle(data.recipe.title || '');
      setDescription(data.recipe.description ?? '');
      setIngredients(data.recipe.ingredients ?? []);
      setRawIngredientText((data.raw_ingredient_lines ?? []).join('\n'));
      setInstructions(data.instructions_raw ?? data.recipe.instructions ?? '');
      setPrepTime(data.recipe.prep_time_minutes ?? '');
      setCookTime(data.recipe.cook_time_minutes ?? '');
      setServings(data.recipe.servings ?? '');
      setSelectedCoverUrl(null);
      setStep(2);
    } catch (err: any) {
      console.error('Error fetching preview:', err);
      setError(err.response?.data?.detail || 'Could not extract recipe from URL. Try another URL or create the recipe manually.');
    } finally {
      setLoading(false);
    }
  };

  const updateIngredient = (index: number, field: 'quantity' | 'unit' | 'name', value: number | string) => {
    const next = [...ingredients];
    if (index < 0 || index >= next.length) return;
    if (field === 'quantity') {
      next[index] = { ...next[index], quantity: value === '' || value == null ? undefined : Number(value) };
    } else if (field === 'unit') {
      next[index] = { ...next[index], unit: (value as string).trim() || undefined };
    } else {
      next[index] = { ...next[index], name: (value as string).trim() || '' };
    }
    setIngredients(next);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '' }]);
  };

  const handleReparseIngredients = async () => {
    const lines = rawIngredientText
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setIngredients([]);
      return;
    }
    setParsingIngredients(true);
    setError('');
    try {
      const response = await api.post<{ ingredients: Ingredient[] }>('/recipes/import/parse-ingredients', {
        raw_lines: lines,
        pattern: parsePattern,
      });
      setIngredients(response.data.ingredients ?? []);
    } catch (err: any) {
      console.error('Re-parse ingredients:', err);
      setError(err.response?.data?.detail || 'Failed to re-parse ingredients.');
    } finally {
      setParsingIngredients(false);
    }
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    setError('');
    try {
      const ingredientsToSend = ingredients.filter((ing) => (ing.name ?? '').trim());
      const response = await api.post('/recipes/import/confirm', {
        recipe: {
          title: title.trim() || 'Imported Recipe',
          description: description || null,
          ingredients: ingredientsToSend.length ? ingredientsToSend : null,
          instructions: instructions || null,
          prep_time_minutes: prepTime === '' ? null : Number(prepTime),
          cook_time_minutes: cookTime === '' ? null : Number(cookTime),
          servings: servings === '' ? null : Number(servings),
          source_url: previewData?.recipe?.source_url || url || null,
        },
        is_private: isPrivate,
        cover_image_url: selectedCoverUrl || undefined,
      });
      navigate(`/recipes/${response.data.id}`);
    } catch (err: any) {
      console.error('Error importing recipe:', err);
      setError(err.response?.data?.detail || 'Failed to import recipe.');
    } finally {
      setImporting(false);
    }
  };

  const goBackToUrl = () => {
    setStep(1);
    setError('');
    setPreviewData(null);
  };

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <style>{sharedStyles}</style>

      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => (step === 2 ? goBackToUrl() : navigate('/recipes'))}
          className="action-button action-button-secondary"
        >
          ← {step === 2 ? 'Back to URL' : 'Back to Recipes'}
        </button>
      </div>

      {step === 1 && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: '24px' }}>
            <h1 className="page-title" style={{ fontSize: '2rem' }}>Import Recipe from URL</h1>
            <p className="page-subtitle" style={{ fontSize: '1rem' }}>
              Paste a URL from any recipe website. You’ll get a preview where you can fix parsing and pick a cover image before importing.
            </p>
          </div>

          {error && (
            <div className="alert alert-error">{error}</div>
          )}

          <form onSubmit={handleFetchPreview}>
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
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="action-button action-button-primary"
                style={{
                  opacity: loading || !url.trim() ? 0.6 : 1,
                  cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '⏳ Loading preview…' : 'Next: Preview & edit'}
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
      )}

      {step === 2 && previewData && (
        <>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.5rem' }}>Edit before importing</h2>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.95rem' }}>
              Adjust title, sections, and quantity parsing. Your choices are reflected in the preview below.
            </p>

            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
                placeholder="Recipe title"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
                rows={3}
                placeholder="Short description"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prep time (minutes)</label>
              <input
                type="number"
                min={0}
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                className="form-input"
                style={{ maxWidth: '120px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cook time (minutes)</label>
              <input
                type="number"
                min={0}
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value === '' ? '' : Number(e.target.value))}
                className="form-input"
                style={{ maxWidth: '120px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Servings</label>
              <input
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(e.target.value === '' ? '' : Number(e.target.value))}
                className="form-input"
                style={{ maxWidth: '120px' }}
              />
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '24px 0' }} />

            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem' }}>Ingredients</h3>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '12px' }}>
              Edit quantity, unit, or name in the table below. If parsing is wrong, adjust the raw text (remove junk lines or paste your own list) and click Re-parse.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Raw ingredients (one per line)</label>
              <textarea
                value={rawIngredientText}
                onChange={(e) => setRawIngredientText(e.target.value)}
                className="form-input"
                rows={6}
                placeholder="Paste ingredients here, one per line (e.g. 200 g flour, 1 tsp salt). Remove header lines if the parser started in the wrong place, then click Re-parse."
                style={{ resize: 'vertical', width: '100%', fontFamily: 'inherit', fontSize: '0.9rem' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                <select
                  value={parsePattern}
                  onChange={(e) => setParsePattern(e.target.value as 'quantity_unit_name' | 'quantity_only' | 'name_only')}
                  className="form-input"
                  style={{ width: 'auto', minWidth: '180px', margin: 0 }}
                >
                  <option value="quantity_unit_name">Quantity + unit + name</option>
                  <option value="quantity_only">Quantity + name (no unit)</option>
                  <option value="name_only">Name only</option>
                </select>
                <button
                  type="button"
                  onClick={handleReparseIngredients}
                  disabled={parsingIngredients}
                  className="action-button action-button-primary"
                  style={{ padding: '8px 16px' }}
                >
                  {parsingIngredients ? '⏳ Re-parsing…' : 'Re-parse ingredients'}
                </button>
              </div>
            </div>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '12px' }}>
              Parsed list — edit, add, or remove rows as needed.
            </p>

            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
              {ingredients.length === 0 ? (
                <p style={{ color: '#888', fontSize: '0.9rem', margin: '12px 10px' }}>No ingredients extracted. Add them below.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555', width: '72px' }}>Qty</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555', width: '88px' }}>Unit</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555' }}>Ingredient</th>
                      <th style={{ width: '36px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing, i) => (
                      <tr key={i} style={{ borderBottom: i < ingredients.length - 1 ? '1px solid #eee' : 'none' }}>
                        <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ing.quantity != null ? String(ing.quantity) : ''}
                            onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                            placeholder="—"
                            className="form-input"
                            style={{ width: '100%', maxWidth: '64px', margin: 0, padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}
                          />
                        </td>
                        <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={ing.unit ?? ''}
                            onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                            placeholder="—"
                            className="form-input"
                            style={{ width: '100%', maxWidth: '96px', margin: 0, padding: '6px 8px' }}
                          />
                        </td>
                        <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            value={ing.name ?? ''}
                            onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                            placeholder="Ingredient name"
                            className="form-input"
                            style={{ width: '100%', margin: 0, padding: '6px 8px' }}
                          />
                        </td>
                        <td style={{ padding: '4px 8px', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => removeIngredient(i)}
                            className="action-button action-button-danger"
                            style={{ padding: '6px 10px' }}
                            title="Remove ingredient"
                          >
                            −
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ padding: '8px 10px', borderTop: '1px solid #eee' }}>
                <button
                  type="button"
                  onClick={addIngredient}
                  className="action-button action-button-secondary"
                  style={{ padding: '6px 12px' }}
                >
                  + Add ingredient
                </button>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '24px 0' }} />

            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem' }}>Instructions</h3>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '8px' }}>
              If we captured the wrong section (e.g. abbreviated instead of full), trim the text below to the start and end you want, or paste the full method. You can delete lines at the top or bottom that don’t belong.
            </p>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="form-input"
              rows={10}
              placeholder="Instructions / method"
              style={{ resize: 'vertical' }}
            />

            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '24px 0' }} />

            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem' }}>Cover image</h3>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '12px' }}>
              Choose an image from the recipe page to use as the cover (optional).
            </p>
            {previewData.image_urls?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {previewData.image_urls.slice(0, 24).map((imgUrl) => (
                  <button
                    key={imgUrl}
                    type="button"
                    onClick={() => setSelectedCoverUrl(selectedCoverUrl === imgUrl ? null : imgUrl)}
                    style={{
                      padding: 0,
                      border: selectedCoverUrl === imgUrl ? '3px solid #007bff' : '2px solid #e0e0e0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#f0f0f0',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      style={{ display: 'block', width: '100px', height: '100px', objectFit: 'cover' }}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </button>
                ))}
                {selectedCoverUrl && (
                  <span style={{ alignSelf: 'center', color: '#007bff', fontSize: '0.9rem' }}>
                    Selected as cover
                  </span>
                )}
              </div>
            ) : (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>No images found on the page.</p>
            )}
          </div>

          <div className="card" style={{ marginBottom: '24px', background: '#f8f9fa' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>Preview: how it will look</h3>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', background: 'white' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>{title || 'Untitled'}</h4>
              {description && <p style={{ color: '#666', margin: '0 0 12px 0', fontSize: '0.95rem' }}>{description.slice(0, 150)}{description.length > 150 ? '…' : ''}</p>}
              {(prepTime !== '' || cookTime !== '' || servings !== '') && (
                <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#555' }}>
                  {prepTime !== '' && `Prep: ${prepTime} min`}
                  {prepTime !== '' && (cookTime !== '' || servings !== '') && ' · '}
                  {cookTime !== '' && `Cook: ${cookTime} min`}
                  {servings !== '' && (prepTime !== '' || cookTime !== '') && ' · '}
                  {servings !== '' && `Servings: ${servings}`}
                </p>
              )}
              <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>Ingredients:</strong> {ingredients.length} item(s)</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{instructions ? instructions.slice(0, 200) + (instructions.length > 200 ? '…' : '') : '—'}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleImportConfirm}
              disabled={importing}
              className="action-button action-button-primary"
            >
              {importing ? '⏳ Importing…' : 'Import recipe'}
            </button>
            <button onClick={goBackToUrl} className="action-button action-button-secondary">
              Back to URL
            </button>
            <button onClick={() => navigate('/recipes')} className="action-button action-button-secondary">
              Cancel
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <div className="card" style={{ marginTop: '32px', background: '#f8f9fa' }}>
          <h3 style={{ color: '#213547', marginTop: 0, marginBottom: '12px', fontSize: '1.25rem' }}>Tips</h3>
          <ul style={{ color: '#666', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
            <li>Supported sites include most recipe websites with structured data.</li>
            <li>On the next screen you can fix quantity parsing, trim sections, and pick a cover image.</li>
            <li>If preview fails, try creating the recipe manually.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
