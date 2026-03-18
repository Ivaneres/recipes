import * as React from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';

interface MealPlan {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  recipes?: Recipe[];
}

interface Recipe {
  id: number;
  title: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
}

interface MealPlanSummary {
  total_prep_time: number | null;
  total_cook_time: number | null;
  total_servings: number | null;
  recipe_count: number;
  combined_ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
}

export default function MealPlans() {
  const [mealPlans, setMealPlans] = React.useState<MealPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newMealPlanName, setNewMealPlanName] = React.useState('');
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const { push } = useToast();

  React.useEffect(() => {
    fetchMealPlans();
  }, []);

  const fetchMealPlans = async () => {
    try {
      const response = await api.get('/meal-plans');
      setMealPlans(response.data);
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMealPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMealPlanName.trim()) return;
    setCreating(true);
    try {
      await api.post('/meal-plans', { name: newMealPlanName });
      setNewMealPlanName('');
      setShowCreateForm(false);
      fetchMealPlans();
    } catch (error) {
      console.error('Error creating meal plan:', error);
      push({ kind: 'error', title: 'Create failed', message: 'Failed to create meal plan.' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMealPlan = async (id: number) => {
    try {
      await api.delete(`/meal-plans/${id}`);
      fetchMealPlans();
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      push({ kind: 'error', title: 'Delete failed', message: 'Failed to delete meal plan.' });
    }
  };

  if (loading) {
    return (
      <div className="container-page pt-6">
        <div className="text-sm text-muted">Loading meal plans…</div>
      </div>
    );
  }

  return (
    <div className="container-page pt-6 md:pt-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Meal Plans</h1>
          <p className="mt-1 text-sm text-muted">Plan meals and keep everything in one place.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateForm((v) => !v)}>
          New
        </Button>
      </div>

      {showCreateForm && (
        <Card className="mt-4">
          <CardContent className="p-5">
            <form onSubmit={handleCreateMealPlan} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <div className="text-sm font-medium">Name</div>
                <div className="mt-2">
                  <Input
                    value={newMealPlanName}
                    onChange={(e) => setNewMealPlanName(e.target.value)}
                    placeholder="e.g., Week of Jan 1"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewMealPlanName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {mealPlans.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>No meal plans yet</CardTitle>
            <CardDescription>Create one to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {mealPlans.map((mealPlan) => (
            <MealPlanCard
              key={mealPlan.id}
              mealPlan={mealPlan}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={deleteId != null}
        title="Delete meal plan?"
        description="This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return;
          const id = deleteId;
          setDeleteId(null);
          await handleDeleteMealPlan(id);
        }}
      />
    </div>
  );
}

function MealPlanCard({ mealPlan, onDelete }: { mealPlan: MealPlan; onDelete: (id: number) => void }) {
  const [summary, setSummary] = React.useState<MealPlanSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);

  React.useEffect(() => {
    fetchMealPlanDetails();
  }, [mealPlan.id]);

  const fetchMealPlanDetails = async () => {
    try {
      setLoading(true);
      const [planRes, summaryRes] = await Promise.all([
        api.get(`/meal-plans/${mealPlan.id}`),
        api.get(`/meal-plans/${mealPlan.id}/summary`),
      ]);
      setRecipes(planRes.data.recipes || []);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching meal plan details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="hover:bg-surface2/40 transition">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{mealPlan.name}</div>
            <div className="mt-1 text-xs text-muted">Recipes: {recipes.length}</div>
          </div>
          <Button variant="danger" size="sm" onClick={() => onDelete(mealPlan.id)}>
            Delete
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-muted">Loading…</div>
        ) : (
          <>
            {summary && (
              <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <div className="font-medium">Summary</div>
                <div className="mt-1 text-muted">
                  <div>
                    {summary.recipe_count} {summary.recipe_count === 1 ? 'recipe' : 'recipes'}
                  </div>
                  {summary.total_prep_time != null && <div>⏱️ {summary.total_prep_time} min prep</div>}
                  {summary.total_cook_time != null && <div>🔥 {summary.total_cook_time} min cook</div>}
                  {summary.total_servings != null && <div>👥 {summary.total_servings} servings</div>}
                </div>
              </div>
            )}

            <div className="mt-4">
              {recipes.length === 0 ? (
                <div className="text-sm text-muted">No recipes added yet.</div>
              ) : (
                <ul className="list-disc pl-5 text-sm text-muted">
                  {recipes.slice(0, 6).map((recipe) => (
                    <li key={recipe.id}>
                      <Link to={`/recipes/${recipe.id}`} className="text-text hover:underline">
                        {recipe.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4">
              <Link to={`/meal-plans/${mealPlan.id}`}>
                <Button variant="primary" className="w-full">
                  View details
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
