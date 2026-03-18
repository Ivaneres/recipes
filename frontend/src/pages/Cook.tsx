import * as React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type RecentCook = {
  recipeId: number;
  title: string;
  lastOpenedAt: number;
};

function loadRecents(): RecentCook[] {
  try {
    const raw = localStorage.getItem('cook.recents');
    const parsed = raw ? (JSON.parse(raw) as RecentCook[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Cook() {
  const [recents, setRecents] = React.useState<RecentCook[]>(() => loadRecents());

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cook.recents') setRecents(loadRecents());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div className="container-page pt-6 md:pt-10">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cook</h1>
          <p className="mt-1 text-sm text-muted">Resume a recipe where you left off.</p>
        </div>
        <Link to="/recipes">
          <Button variant="secondary" size="sm">
            Browse recipes
          </Button>
        </Link>
      </div>

      {recents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No recents yet</CardTitle>
            <CardDescription>Start cooking any recipe and it’ll show up here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/recipes">
              <Button variant="primary">Find a recipe</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {recents
            .slice()
            .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
            .map((r) => (
              <Card key={r.recipeId} className="hover:bg-surface2/40 transition">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.title}</div>
                    <div className="text-xs text-muted">
                      Last opened {new Date(r.lastOpenedAt).toLocaleString()}
                    </div>
                  </div>
                  <Link to={`/recipes/${r.recipeId}/cook`}>
                    <Button variant="primary" size="sm">
                      Resume
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

