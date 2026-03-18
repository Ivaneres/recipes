import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AdminFeatures from '../components/AdminFeatures';
import { RecipeInteractions } from '../components/AdminFeatures';
import { fixImageUrls, getImageUrl } from '../utils/imageUrl';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';

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

type IngredientEntry = { name: string; quantity?: number; unit?: string };

function getIngredientDisplay(ing: IngredientEntry, scaleFactor: number): string {
  const qty = ing.quantity != null ? ing.quantity * scaleFactor : null;
  const formatted =
    qty != null
      ? qty % 1 === 0
        ? qty.toString()
        : qty.toFixed(2).replace(/\.?0+$/, '')
      : null;
  if (formatted && ing.unit) return `${formatted} ${ing.unit}`;
  if (formatted) return formatted;
  if (ing.unit) return ing.unit;
  return '';
}

function isWordBoundary(str: string, start: number, end: number): boolean {
  const before = start <= 0 ? null : str[start - 1];
  const after = end >= str.length ? null : str[end];
  const isLetter = (c: string) => /[\p{L}\d]/u.test(c);
  return (before == null || !isLetter(before)) && (after == null || !isLetter(after));
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Core name without parenthetical or trailing " - ..." (e.g. "tamarind pulp (soaked)" → "tamarind pulp") */
function getIngredientCoreName(name: string): string {
  const trimmed = name.trim();
  const paren = trimmed.search(/\s*[[(]/);
  const dash = trimmed.search(/\s+-\s+/);
  let end = trimmed.length;
  if (paren > 0) end = Math.min(end, paren);
  if (dash > 0) end = Math.min(end, dash);
  return trimmed.slice(0, end).trim();
}

/** Preparation/descriptor words we never use as a fallback pattern (avoids "blanched" → okra, "wedges" instead of "tomatoes"). */
const PREPARATION_SKIP = new Set([
  'blanched', 'diced', 'chopped', 'minced', 'sliced', 'grated', 'crushed', 'dried', 'toasted',
  'peeled', 'pounded', 'soaked', 'drained', 'optional', 'garnish', 'wedges', 'halved',
  'quartered', 'julienned', 'cubed', 'whole', 'ground', 'fresh', 'finely', 'roughly',
  'cut', 'into', 'for', 'and', 'or', 'the', 'set', 'aside', 'taste', 'sautéing', 'to',
]);

/** Last ingredient-like word in core, skipping prep words (e.g. "...okra, blanched" → "okra"; "...tomatoes cut into wedges" → "tomatoes"). */
function getLastMeaningfulWord(core: string): string | null {
  const tokens = core.split(/\s+|,\s*/).filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  for (let i = tokens.length - 1; i >= 0; i--) {
    const w = tokens[i].toLowerCase();
    if (!PREPARATION_SKIP.has(w)) return tokens[i];
  }
  return null;
}

/** First ingredient-like word in core, skipping prep (e.g. "ladyfingers or okra, blanched" → "ladyfingers"). */
function getFirstMeaningfulWord(core: string): string | null {
  const tokens = core.split(/\s+|,\s*/).filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i].toLowerCase();
    if (!PREPARATION_SKIP.has(w)) return tokens[i];
  }
  return null;
}

/** Match strings per ingredient: full name, core name, last meaningful word, and first (e.g. "ladyfingers or okra" → both). */
function getMatchPatterns(ingredients: IngredientEntry[]): { pattern: string; ing: IngredientEntry }[] {
  const seenLong = new Set<string>();
  const out: { pattern: string; ing: IngredientEntry }[] = [];
  for (const ing of ingredients) {
    const full = ing.name.trim();
    const core = getIngredientCoreName(ing.name);
    for (const p of [full, core]) {
      if (!p || seenLong.has(p.toLowerCase())) continue;
      seenLong.add(p.toLowerCase());
      out.push({ pattern: p, ing });
    }
    const lastWord = getLastMeaningfulWord(core);
    const firstWord = getFirstMeaningfulWord(core);
    for (const word of [lastWord, firstWord]) {
      if (!word) continue;
      const w = word.toLowerCase();
      if (w === full.toLowerCase() || w === core.toLowerCase()) continue;
      out.push({ pattern: word, ing });
    }
  }
  return out;
}

type Match = { start: number; end: number; ing: IngredientEntry };

/** Find all word-boundary occurrences of each pattern in text; merge overlapping (keep longer). */
function findIngredientMatches(text: string, patterns: { pattern: string; ing: IngredientEntry }[]): Match[] {
  const matches: Match[] = [];
  const lower = text.toLowerCase();
  for (const { pattern, ing } of patterns) {
    const pat = pattern.toLowerCase();
    let pos = 0;
    while (true) {
      const idx = lower.indexOf(pat, pos);
      if (idx === -1) break;
      if (isWordBoundary(text, idx, idx + pat.length)) {
        matches.push({ start: idx, end: idx + pat.length, ing });
      }
      pos = idx + 1;
    }
  }
  matches.sort(
    (a, b) =>
      a.start - b.start ||
      b.end - b.start - (a.end - a.start) ||
      b.ing.name.length - a.ing.name.length
  );
  const merged: Match[] = [];
  for (const m of matches) {
    if (merged.length > 0 && m.start < merged[merged.length - 1].end) {
      const prev = merged[merged.length - 1];
      const mLen = m.end - m.start;
      const prevLen = prev.end - prev.start;
      if (mLen > prevLen || (mLen === prevLen && m.ing.name.length > prev.ing.name.length)) {
        merged[merged.length - 1] = m;
      }
      continue;
    }
    merged.push(m);
  }
  return merged;
}

/** Build React segments for plain-text instructions with highlighted ingredients */
function highlightIngredientsInPlainText(
  text: string,
  ingredients: IngredientEntry[],
  scaleFactor: number,
  segmentKeyPrefix: string
): (string | React.ReactNode)[] {
  if (!ingredients.length) return [text];
  const patterns = getMatchPatterns(ingredients);
  const matches = findIngredientMatches(text, patterns);
  const segments: (string | React.ReactNode)[] = [];
  let last = 0;
  matches.forEach((m, keyIndex) => {
    if (m.start > last) segments.push(text.slice(last, m.start));
    const display = getIngredientDisplay(m.ing, scaleFactor);
    segments.push(
      <span
        key={`${segmentKeyPrefix}-${keyIndex}`}
        className="ingredient-highlight"
        data-ingredient-display={display}
        data-ingredient-name={m.ing.name}
        title={display || m.ing.name || undefined}
      >
        {text.slice(m.start, m.end)}
      </span>
    );
    last = m.end;
  });
  if (last < text.length) segments.push(text.slice(last));
  return segments;
}

/** Return HTML string with ingredient spans for instructions that are HTML */
function highlightIngredientsInHtml(
  html: string,
  ingredients: IngredientEntry[],
  scaleFactor: number
): string {
  if (!ingredients.length) return html;
  const patterns = getMatchPatterns(ingredients);
  const parts = html.split(/(<[^>]+>)/g);
  return parts
    .map((part) => {
      if (part.startsWith('<') && part.endsWith('>')) return part;
      const matches = findIngredientMatches(part, patterns);
      let result = '';
      let last = 0;
      for (const m of matches) {
        if (m.start > last) result += part.slice(last, m.start);
        const display = getIngredientDisplay(m.ing, scaleFactor);
        const tooltipText = display || m.ing.name;
        const escaped = escapeHtmlAttr(tooltipText);
        const nameEscaped = escapeHtmlAttr(m.ing.name);
        const sub = part.slice(m.start, m.end);
        result += `<span class="ingredient-highlight" data-ingredient-display="${escapeHtmlAttr(display)}" data-ingredient-name="${nameEscaped}" title="${escaped}">${sub}</span>`;
        last = m.end;
      }
      if (last < part.length) result += part.slice(last);
      return result;
    })
    .join('');
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [scaleInputValue, setScaleInputValue] = useState('1');
  const [tooltip, setTooltip] = useState<{ display: string; x: number; y: number } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    try {
      await api.delete(`/recipes/${id}`);
      navigate('/recipes');
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  };

  if (loading) {
    return (
      <div className="container-page pt-6">
        <div className="text-sm text-muted">Loading recipe…</div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="container-page pt-6">
        <div className="text-sm text-muted">Recipe not found.</div>
      </div>
    );
  }

  return (
    <div className="container-page pt-6 md:pt-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Link to="/recipes">
            <Button variant="ghost" size="sm">
              ← Recipes
            </Button>
          </Link>
          <Link to={`/recipes/${id}/cook`}>
            <Button variant="primary" size="sm">
              Cook mode
            </Button>
          </Link>
        </div>

        {!isGuest && (isAdmin || isRecipeCreator) && (
          <div className="flex items-center gap-2">
            <Link to={`/recipes/${id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={deleteOpen}
        title="Delete recipe?"
        description="This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleteOpen(false);
          await handleDelete();
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {recipe.cover_image && (
              <img
                src={getImageUrl(recipe.cover_image) || ''}
                alt={recipe.title}
                className="h-56 w-full object-cover md:h-72"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <CardContent className="p-5">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{recipe.title}</h1>

              {recipe.tags && recipe.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recipe.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                {recipe.prep_time_minutes != null && (
                  <span className="rounded-md border border-border bg-surface px-2 py-1">
                    ⏱️ {recipe.prep_time_minutes}m prep
                  </span>
                )}
                {recipe.cook_time_minutes != null && (
                  <span className="rounded-md border border-border bg-surface px-2 py-1">
                    🔥 {recipe.cook_time_minutes}m cook
                  </span>
                )}
                {recipe.servings != null && (
                  <span className="rounded-md border border-border bg-surface px-2 py-1">
                    👥 {recipe.servings} servings
                  </span>
                )}
              </div>

              {recipe.description && (
                <div
                  className="recipe-content mt-5 text-sm leading-relaxed text-text"
                  dangerouslySetInnerHTML={{ __html: fixImageUrls(recipe.description) }}
                />
              )}
            </CardContent>
          </Card>

          {recipe.instructions && (
            <Card className="mt-5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Instructions</h2>
                  <Link to={`/recipes/${id}/cook`}>
                    <Button variant="primary" size="sm">
                      Start cooking
                    </Button>
                  </Link>
                </div>

                <div
                  className="recipe-content mt-4 text-sm leading-relaxed text-text"
                  onMouseMove={(e) => {
                    const el = (e.target as HTMLElement).closest?.('.ingredient-highlight') as HTMLElement | null;
                    const display = el?.getAttribute?.('data-ingredient-display') ?? '';
                    const name = el?.getAttribute?.('data-ingredient-name') ?? '';
                    const text = display.trim() || name.trim();
                    if (text) setTooltip({ display: text, x: e.clientX, y: e.clientY });
                    else setTooltip(null);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/<[a-z][\s\S]*>/i.test(recipe.instructions) ? (
                    <div
                      className="recipe-content"
                      dangerouslySetInnerHTML={{
                        __html: highlightIngredientsInHtml(
                          fixImageUrls(recipe.instructions),
                          recipe.ingredients ?? [],
                          scaleFactor
                        ),
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {highlightIngredientsInPlainText(
                        recipe.instructions,
                        recipe.ingredients ?? [],
                        scaleFactor,
                        'inst'
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-1">
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <Card className="sticky top-24">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Ingredients</h2>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">Scale</span>
                  {[0.5, 1, 1.5, 2].map((factor) => {
                    const active = Math.abs(scaleFactor - factor) < 0.01;
                    return (
                      <Button
                        key={factor}
                        variant={active ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                          setScaleFactor(factor);
                          setScaleInputValue(factor.toString());
                        }}
                      >
                        {factor}x
                      </Button>
                    );
                  })}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.01"
                      max="10"
                      step="0.01"
                      value={scaleInputValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        setScaleInputValue(v);
                        if (v === '' || v === '.') return;
                        const f = parseFloat(v);
                        if (!isNaN(f) && f > 0 && f <= 10) setScaleFactor(f);
                      }}
                      onBlur={(e) => {
                        const f = parseFloat(e.target.value);
                        if (isNaN(f) || f <= 0 || e.target.value === '' || e.target.value === '.') {
                          setScaleFactor(1);
                          setScaleInputValue('1');
                        } else if (f > 10) {
                          setScaleFactor(10);
                          setScaleInputValue('10');
                        } else {
                          setScaleInputValue(f % 1 === 0 ? f.toString() : f.toFixed(2).replace(/\.?0+$/, ''));
                        }
                      }}
                      className="h-9 w-20 rounded-md border border-border bg-surface px-2 text-sm"
                      aria-label="Custom scale"
                    />
                    <span className="text-xs text-muted">x</span>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {recipe.ingredients.map((ing, idx) => {
                    const scaledQuantity = ing.quantity != null ? ing.quantity * scaleFactor : null;
                    const formattedQuantity =
                      scaledQuantity != null ? (scaledQuantity % 1 === 0 ? scaledQuantity.toString() : scaledQuantity.toFixed(2).replace(/\.?0+$/, '')) : null;
                    return (
                      <li key={idx} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
                        {formattedQuantity && <span className="font-semibold">{formattedQuantity} </span>}
                        {ing.unit && <span className="font-semibold">{ing.unit} </span>}
                        <span>{ing.name}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 rounded-md bg-text px-2.5 py-1.5 text-xs text-white shadow-popover"
          style={{
            left: Math.min(tooltip.x + 12, window.innerWidth - 120),
            top: Math.max(8, tooltip.y - 32),
          }}
        >
          {tooltip.display}
        </div>
      )}

      {recipe.source_url && (
        <div className="mt-6">
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              View original source
            </Button>
          </a>
        </div>
      )}

      {/* Ratings and Comments */}
      <div className="mt-8">
        <RecipeInteractions recipeId={recipe.id} />
      </div>

      {/* Private Notes - Only visible to recipe creator */}
      {!isGuest && isRecipeCreator && (
        <div className="mt-8">
          <AdminFeatures recipeId={recipe.id} />
        </div>
      )}
    </div>
  );
}
