import React, { useState, useEffect } from 'react';
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
  const paren = trimmed.search(/\s*[(\[]/);
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
        .ingredient-highlight {
          background: linear-gradient(to bottom, transparent 60%, rgba(0, 123, 255, 0.2) 60%);
          border-radius: 2px;
          cursor: default;
          padding: 0 1px;
        }
        .ingredient-highlight:hover {
          background: linear-gradient(to bottom, transparent 50%, rgba(0, 123, 255, 0.35) 50%);
        }
        .ingredient-tooltip {
          position: fixed;
          z-index: 1000;
          padding: 6px 10px;
          background: #213547;
          color: #fff;
          font-size: 0.875rem;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          white-space: nowrap;
          max-width: 90vw;
          overflow: hidden;
          text-overflow: ellipsis;
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
                        padding: '10px 16px',
                        minHeight: '44px',
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
          <div
            className="recipe-detail instructions-with-highlights"
            style={{
              color: '#213547',
              lineHeight: '1.8',
              fontSize: '1.05rem',
              whiteSpace: 'pre-wrap',
            }}
            onMouseMove={(e) => {
              const el = (e.target as HTMLElement).closest?.('.ingredient-highlight') as HTMLElement | null;
              const display = el?.getAttribute?.('data-ingredient-display') ?? '';
              const name = el?.getAttribute?.('data-ingredient-name') ?? '';
              const text = display.trim() || name.trim();
              if (text) {
                setTooltip({ display: text, x: e.clientX, y: e.clientY });
              } else {
                setTooltip(null);
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            {/<[a-z][\s\S]*>/i.test(recipe.instructions) ? (
              <div
                className="recipe-detail"
                style={{ lineHeight: '1.8', fontSize: '1.05rem' }}
                dangerouslySetInnerHTML={{
                  __html: highlightIngredientsInHtml(
                    fixImageUrls(recipe.instructions),
                    recipe.ingredients ?? [],
                    scaleFactor
                  ),
                }}
              />
            ) : (
              highlightIngredientsInPlainText(
                recipe.instructions,
                recipe.ingredients ?? [],
                scaleFactor,
                'inst'
              )
            )}
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="ingredient-tooltip"
          style={{
            left: Math.min(tooltip.x + 12, window.innerWidth - 120),
            top: Math.max(8, tooltip.y - 32),
          }}
        >
          {tooltip.display}
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
