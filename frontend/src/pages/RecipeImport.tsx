import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

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
  const [url, setUrl] = React.useState('');
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [step, setStep] = React.useState<1 | 2>(1);
  const [previewData, setPreviewData] = React.useState<PreviewData | null>(null);

  // Preview step state (editable)
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [ingredients, setIngredients] = React.useState<Ingredient[]>([]);
  const [instructions, setInstructions] = React.useState('');
  const [prepTime, setPrepTime] = React.useState<number | ''>('');
  const [cookTime, setCookTime] = React.useState<number | ''>('');
  const [servings, setServings] = React.useState<number | ''>('');
  const [selectedCoverUrl, setSelectedCoverUrl] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  // Raw ingredients text: from extractor (editable) or pasted by user. Re-parsing replaces the table.
  const [rawIngredientText, setRawIngredientText] = React.useState('');
  const [parsePattern, setParsePattern] = React.useState<'quantity_unit_name' | 'quantity_only' | 'name_only'>(
    'quantity_unit_name'
  );
  const [parsingIngredients, setParsingIngredients] = React.useState(false);

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
    } catch (err: unknown) {
      console.error('Error fetching preview:', err);
      const anyErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = anyErr.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not extract recipe from URL. Try another URL or create the recipe manually.'
      );
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
    } catch (err: unknown) {
      console.error('Re-parse ingredients:', err);
      const anyErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = anyErr.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to re-parse ingredients.');
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
    } catch (err: unknown) {
      console.error('Error importing recipe:', err);
      const anyErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = anyErr.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to import recipe.');
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
    <div className="container-page pt-6 md:pt-10">
      <div className="mb-5">
        <Button variant="ghost" size="sm" onClick={() => (step === 2 ? goBackToUrl() : navigate('/recipes'))}>
          ← {step === 2 ? 'Back to URL' : 'Recipes'}
        </Button>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Import from URL</CardTitle>
            <CardDescription>Paste a link, then review and fix the preview before importing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <div className="font-medium">Import failed</div>
                <div className="text-muted">{error}</div>
              </div>
            )}

            <form onSubmit={handleFetchPreview} className="space-y-4">
              <div>
                <div className="text-sm font-medium">Recipe URL</div>
                <div className="mt-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/recipe"
                    required
                    disabled={loading}
                  />
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" variant="primary" disabled={loading || !url.trim()}>
                  {loading ? 'Loading preview…' : 'Next: Preview'}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/recipes')}>
                  Cancel
                </Button>
              </div>
            </form>

            <div className="rounded-lg border border-border bg-surface2/40 px-4 py-3 text-sm text-muted">
              Tip: if preview fails, use Manual create in the “Add recipe” screen.
            </div>
          </CardContent>
        </Card>
      ) : (
        previewData && (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <div className="font-medium">Something went wrong</div>
                <div className="text-muted">{error}</div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Review & edit</CardTitle>
                <CardDescription>Fix fields, ingredients parsing, and choose a cover image.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="text-sm font-medium">Title</div>
                  <div className="mt-2">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recipe title" />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">Description (optional)</div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    placeholder="Short description"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-sm font-medium">Prep (min)</div>
                    <Input
                      type="number"
                      min={0}
                      value={prepTime}
                      onChange={(e) => setPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Cook (min)</div>
                    <Input
                      type="number"
                      min={0}
                      value={cookTime}
                      onChange={(e) => setCookTime(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Servings</div>
                    <Input
                      type="number"
                      min={1}
                      value={servings}
                      onChange={(e) => setServings(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Ingredients</div>
                      <div className="text-xs text-muted">
                        Edit the list, or paste raw lines and re-parse.
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={addIngredient}>
                      + Add
                    </Button>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-medium text-muted">Raw ingredients (one per line)</div>
                    <textarea
                      value={rawIngredientText}
                      onChange={(e) => setRawIngredientText(e.target.value)}
                      rows={6}
                      className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      placeholder="Paste ingredients here…"
                    />
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={parsePattern}
                        onChange={(e) =>
                          setParsePattern(e.target.value as 'quantity_unit_name' | 'quantity_only' | 'name_only')
                        }
                        className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
                      >
                        <option value="quantity_unit_name">Quantity + unit + name</option>
                        <option value="quantity_only">Quantity + name</option>
                        <option value="name_only">Name only</option>
                      </select>
                      <Button variant="primary" onClick={handleReparseIngredients} disabled={parsingIngredients}>
                        {parsingIngredients ? 'Re-parsing…' : 'Re-parse'}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-lg border border-border">
                    {ingredients.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-muted">No ingredients yet.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-surface2/60 text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium w-20">Qty</th>
                            <th className="px-3 py-2 text-left font-medium w-24">Unit</th>
                            <th className="px-3 py-2 text-left font-medium">Ingredient</th>
                            <th className="px-3 py-2 w-12" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {ingredients.map((ing, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={ing.quantity != null ? String(ing.quantity) : ''}
                                  onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="text"
                                  value={ing.unit ?? ''}
                                  onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="text"
                                  value={ing.name ?? ''}
                                  onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                                  placeholder="Ingredient"
                                />
                              </td>
                              <td className="px-3 py-2 align-top">
                                <Button variant="danger" size="sm" onClick={() => removeIngredient(i)}>
                                  −
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <div className="text-sm font-semibold">Instructions</div>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    rows={10}
                    className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    placeholder="Instructions / method"
                  />
                </div>

                <div className="border-t border-border pt-5">
                  <div className="text-sm font-semibold">Cover image</div>
                  <div className="mt-1 text-xs text-muted">Pick one (optional).</div>
                  {previewData.image_urls?.length ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {previewData.image_urls.slice(0, 24).map((imgUrl) => {
                        const selected = selectedCoverUrl === imgUrl;
                        return (
                          <button
                            key={imgUrl}
                            type="button"
                            onClick={() => setSelectedCoverUrl(selected ? null : imgUrl)}
                            className={`overflow-hidden rounded-md border ${selected ? 'border-ring' : 'border-border'}`}
                            aria-label={selected ? 'Selected cover image' : 'Select cover image'}
                          >
                            <img
                              src={imgUrl}
                              alt=""
                              className="h-20 w-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-muted">No images found.</div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button variant="primary" onClick={handleImportConfirm} disabled={importing}>
                    {importing ? 'Importing…' : 'Import recipe'}
                  </Button>
                  <Button variant="secondary" onClick={goBackToUrl}>
                    Back
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/recipes')}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  );
}
