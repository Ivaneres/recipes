import * as React from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUrl';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

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
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);

    const t = window.setTimeout(async () => {
      try {
        const params = search.trim() ? { search: search.trim() } : {};
        const response = await api.get('/recipes', { params });
        if (!canceled) setRecipes(response.data);
      } catch (e) {
        console.error('Error fetching recipes:', e);
        if (!canceled) setError('Could not load recipes.');
      } finally {
        if (!canceled) setLoading(false);
      }
    }, 250);

    return () => {
      canceled = true;
      window.clearTimeout(t);
    };
  }, [search]);

  return (
    <div className="container-page pt-4 md:pt-8">
      <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-bg/85 px-4 py-4 backdrop-blur md:top-14 md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Recipes</h1>
            <p className="mt-1 text-sm text-muted">Search, open, and start cooking.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-[360px]">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipes…"
                aria-label="Search recipes"
              />
            </div>
            {!isGuest && (
              <Link to="/add" className="shrink-0">
                <Button variant="primary">Add</Button>
              </Link>
            )}
          </div>
        </div>

        <div className="mt-3 text-xs text-muted">{loading ? 'Loading…' : `${recipes.length} recipes`}</div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <div className="font-medium">Something went wrong</div>
          <div className="text-muted">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border bg-surface">
              <div className="h-40 w-full rounded-t-lg bg-surface2" />
              <div className="p-4">
                <div className="h-4 w-2/3 rounded bg-surface2" />
                <div className="mt-3 h-3 w-full rounded bg-surface2" />
                <div className="mt-2 h-3 w-5/6 rounded bg-surface2" />
                <div className="mt-4 flex gap-2">
                  <div className="h-9 w-24 rounded bg-surface2" />
                  <div className="h-9 w-20 rounded bg-surface2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="mt-10 rounded-lg border border-border bg-surface px-5 py-10 text-center">
          <div className="text-base font-semibold">No recipes found</div>
          <div className="mt-1 text-sm text-muted">
            {search.trim() ? 'Try a different search term.' : 'Add your first recipe to get started.'}
          </div>
          {!isGuest && !search.trim() && (
            <div className="mt-5">
              <Link to="/add">
                <Button variant="primary">Add a recipe</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => {
            const descriptionText = stripHtml(recipe.description || '');
            const previewText =
              descriptionText.length > 140 ? `${descriptionText.substring(0, 140).trim()}…` : descriptionText;

            return (
              <Card key={recipe.id} className="overflow-hidden hover:bg-surface2/40 transition">
                <Link to={`/recipes/${recipe.id}`} className="block">
                  <div className="relative h-44 w-full bg-surface2">
                    {recipe.cover_image ? (
                      <img
                        src={getImageUrl(recipe.cover_image) || ''}
                        alt={recipe.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">No image</div>
                    )}
                  </div>
                </Link>

                <CardContent className="p-4">
                  <div className="min-h-[3rem]">
                    <Link to={`/recipes/${recipe.id}`} className="block">
                      <h3 className="line-clamp-2 text-base font-semibold leading-snug">{recipe.title}</h3>
                    </Link>
                    {previewText && <p className="mt-1 line-clamp-2 text-sm text-muted">{previewText}</p>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                    {recipe.prep_time_minutes != null && (
                      <span className="rounded-md border border-border bg-surface px-2 py-1">⏱️ {recipe.prep_time_minutes}m</span>
                    )}
                    {recipe.cook_time_minutes != null && (
                      <span className="rounded-md border border-border bg-surface px-2 py-1">🔥 {recipe.cook_time_minutes}m</span>
                    )}
                    {recipe.servings != null && (
                      <span className="rounded-md border border-border bg-surface px-2 py-1">👥 {recipe.servings}</span>
                    )}
                  </div>

                  {/* Intentionally no "Open"/"Cook" buttons here.
                      Users can click the recipe card/title to enter Recipe Detail,
                      then start cook mode from there. */}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
