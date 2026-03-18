import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { getImageUrl } from '../utils/imageUrl';
import { extractSteps } from '../utils/recipeSteps';
import { clearCookProgress, loadCookProgress, pushRecentCook, saveCookProgress } from '../utils/cookStorage';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { Dialog } from '../components/ui/Dialog';

interface Recipe {
  id: number;
  title: string;
  cover_image: string | null;
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  instructions: string;
}

function formatQty(qty: number) {
  return qty % 1 === 0 ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');
}

export default function RecipeCook() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeId = Number(id);

  const [recipe, setRecipe] = React.useState<Recipe | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [stepIndex, setStepIndex] = React.useState(0);
  const [checkedIngredients, setCheckedIngredients] = React.useState<Set<number>>(new Set());
  const [checkedSteps, setCheckedSteps] = React.useState<Set<number>>(new Set());
  const [clearOpen, setClearOpen] = React.useState(false);

  const steps = React.useMemo(() => (recipe ? extractSteps(recipe.instructions) : []), [recipe]);

  React.useEffect(() => {
    let canceled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await api.get(`/recipes/${recipeId}`);
        if (canceled) return;
        setRecipe(res.data);

        const p = loadCookProgress(recipeId);
        if (p) {
          setStepIndex(Math.max(0, Math.min(p.stepIndex ?? 0, 9999)));
          setCheckedIngredients(new Set(p.checkedIngredients ?? []));
          setCheckedSteps(new Set(p.checkedSteps ?? []));
        }

        pushRecentCook(recipeId, res.data.title);
      } catch (e) {
        console.error('Error loading recipe for cook mode:', e);
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    if (Number.isFinite(recipeId) && recipeId > 0) run();
    return () => {
      canceled = true;
    };
  }, [recipeId]);

  // Clamp stepIndex once steps are known
  React.useEffect(() => {
    if (steps.length === 0) return;
    setStepIndex((i) => Math.max(0, Math.min(i, steps.length - 1)));
  }, [steps.length]);

  const currentStepRef = React.useRef<HTMLDivElement | null>(null);
  const shouldScrollRef = React.useRef(false);

  const stepsTotal = steps.length;
  const currentIsChecked = checkedSteps.has(stepIndex);

  const nextIncompleteStepIndex = React.useMemo(() => {
    if (stepsTotal === 0) return 0;
    // When completing the current step, the next target is the first unchecked step after it.
    const checked = new Set(checkedSteps);
    checked.add(stepIndex);
    for (let i = stepIndex + 1; i < stepsTotal; i += 1) {
      if (!checked.has(i)) return i;
    }
    return Math.max(0, stepsTotal - 1);
  }, [checkedSteps, stepIndex, stepsTotal]);

  React.useEffect(() => {
    if (!shouldScrollRef.current) return;
    const el = currentStepRef.current;
    if (!el) {
      shouldScrollRef.current = false;
      return;
    }

    // Avoid unnecessary scrolling if the card is already in the viewport.
    // Sticky header overlays the top area, so treat it as "visible" if the card bottom
    // is below the header.
    const headerOffsetPx = 72;
    const rect = el.getBoundingClientRect();
    const isInView = rect.top < window.innerHeight && rect.bottom > headerOffsetPx;
    if (!isInView) el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    shouldScrollRef.current = false;
  }, [stepIndex]);

  // Persist progress
  React.useEffect(() => {
    if (!recipe) return;
    const t = window.setTimeout(() => {
      saveCookProgress({
        recipeId,
        title: recipe.title,
        checkedIngredients: Array.from(checkedIngredients),
        checkedSteps: Array.from(checkedSteps),
        stepIndex,
        updatedAt: Date.now(),
      });
    }, 150);
    return () => window.clearTimeout(t);
  }, [recipe, recipeId, checkedIngredients, checkedSteps, stepIndex]);

  if (loading) {
    return (
      <div className="container-page pt-6">
        <div className="text-sm text-muted">Loading cook mode…</div>
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

  const currentStep = steps[stepIndex] ?? '';
  const doneSteps = checkedSteps.size;
  const doneIngredients = checkedIngredients.size;
  const ingredientsTotal = recipe.ingredients.length;

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-14 z-30 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
        <div className="container-page flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/recipes/${recipeId}`)}>
              ←
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{recipe.title}</div>
              <div className="text-xs text-muted">
                {stepsTotal ? `Step ${stepIndex + 1} / ${stepsTotal}` : 'Steps'}
                {stepsTotal ? ` · ${doneSteps} steps done` : null}
                {ingredientsTotal ? ` · ${doneIngredients}/${ingredientsTotal} ingredients` : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container-page pt-5 md:pt-8">
        {recipe.cover_image && (
          <div className="mb-5 overflow-hidden rounded-lg border border-border bg-surface">
            <img
              src={getImageUrl(recipe.cover_image) || ''}
              alt={recipe.title}
              className="h-44 w-full object-cover md:h-56"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {stepsTotal === 0 ? (
          <div className="rounded-lg border border-border bg-surface px-5 py-6 text-sm text-muted">
            No instructions available.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-4">
              <div className="space-y-4">
                <section aria-label="Ingredients" className="rounded-lg border border-border bg-surface">
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <div className="text-sm font-semibold">Ingredients</div>
                      <div className="text-xs text-muted">
                        {doneIngredients} / {ingredientsTotal} checked
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCheckedIngredients(new Set())}
                      disabled={doneIngredients === 0}
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="border-t border-border">
                    <ul className="divide-y divide-border">
                      {recipe.ingredients.map((ing, idx) => {
                        const checked = checkedIngredients.has(idx);
                        return (
                          <li key={idx} className="px-5 py-3">
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-[rgb(var(--primary))]"
                                checked={checked}
                                onChange={() => {
                                  setCheckedIngredients((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(idx)) next.delete(idx);
                                    else next.add(idx);
                                    return next;
                                  });
                                }}
                              />
                              <div className={cn('text-sm leading-relaxed', checked && 'text-muted line-through')}>
                                {ing.quantity != null && (
                                  <span className="font-semibold">{formatQty(ing.quantity)} </span>
                                )}
                                {ing.unit && <span className="font-semibold">{ing.unit} </span>}
                                <span>{ing.name}</span>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              </div>
            </div>

            <section className="lg:col-span-8" aria-label="Current step">
              <div
                ref={currentStepRef}
                className="rounded-lg border border-border bg-surface px-5 py-6"
                data-testid="current-step-card"
                style={{ scrollMarginTop: 72 }}
              >
                <div className="text-sm text-muted">Current step</div>
                <div className="mt-2 whitespace-pre-wrap text-lg leading-relaxed md:text-2xl" data-testid="current-step">
                  {currentStep}
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                      disabled={stepIndex <= 0}
                    >
                      Prev
                    </Button>
                  </div>

                  <Button
                    variant={currentIsChecked ? 'secondary' : 'primary'}
                    data-testid="complete-step-button"
                    onClick={() => {
                      if (currentIsChecked) {
                        // Undo: keep the user on this step.
                        setCheckedSteps((prev) => {
                          const next = new Set(prev);
                          next.delete(stepIndex);
                          return next;
                        });
                        return;
                      }

                      // Complete: mark done and advance to the next unchecked step.
                      shouldScrollRef.current = true;
                      setCheckedSteps((prev) => {
                        const next = new Set(prev);
                        next.add(stepIndex);
                        return next;
                      });
                      setStepIndex(nextIncompleteStepIndex);
                    }}
                  >
                    {currentIsChecked ? 'Undo' : 'Complete step'}
                  </Button>
                </div>

                {checkedSteps.size >= stepsTotal && (
                  <div className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
                    Finished! All steps are marked done.
                  </div>
                )}
              </div>

              <section aria-label="Step scan map" className="mt-4 rounded-lg border border-border bg-surface">
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="text-sm font-semibold">Steps</div>
                    <div className="text-xs text-muted">
                      {doneSteps} / {stepsTotal} done
                    </div>
                  </div>
                  <div className="text-xs text-muted">{currentIsChecked ? 'Current done' : 'In progress'}</div>
                </div>
                <div className="border-t border-border">
                  <ul className="max-h-[40vh] space-y-0 overflow-auto p-2">
                    {steps.map((_, idx) => {
                      const checked = checkedSteps.has(idx);
                      const active = idx === stepIndex;
                      return (
                        <li key={idx} className="px-1 py-1">
                          <button
                            type="button"
                            data-testid={`step-map-item-${idx}`}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition',
                              active
                                ? 'border-ring bg-surface2'
                                : 'border-border bg-surface hover:bg-surface2',
                              checked && 'opacity-80'
                            )}
                            onClick={() => setStepIndex(idx)}
                          >
                            <span className="font-medium">Step {idx + 1}</span>
                            {checked && <span aria-hidden="true">✓</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Link to={`/recipes/${recipeId}`}>
                  <Button variant="secondary">Back to recipe</Button>
                </Link>
                <Button variant="danger" onClick={() => setClearOpen(true)}>
                  Clear progress
                </Button>
              </div>
            </section>
          </div>
        )}

        <Dialog
          open={clearOpen}
          title="Clear cooking progress?"
          description="This will reset checked ingredients, step completion, and your current step."
          confirmText="Clear progress"
          cancelText="Cancel"
          onClose={() => setClearOpen(false)}
          onConfirm={() => {
            setClearOpen(false);
            clearCookProgress(recipeId);
            setCheckedIngredients(new Set());
            setCheckedSteps(new Set());
            setStepIndex(0);
          }}
        />
      </div>
    </div>
  );
}

