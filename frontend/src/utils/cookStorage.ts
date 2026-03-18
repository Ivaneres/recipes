export type CookProgress = {
  recipeId: number;
  title: string;
  checkedIngredients: number[];
  checkedSteps: number[];
  stepIndex: number;
  updatedAt: number;
};

export type RecentCook = {
  recipeId: number;
  title: string;
  lastOpenedAt: number;
};

function progressKey(recipeId: number) {
  return `cook.progress.${recipeId}`;
}

export function loadCookProgress(recipeId: number): CookProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(recipeId));
    if (!raw) return null;
    return JSON.parse(raw) as CookProgress;
  } catch {
    return null;
  }
}

export function saveCookProgress(p: CookProgress) {
  localStorage.setItem(progressKey(p.recipeId), JSON.stringify(p));
}

export function clearCookProgress(recipeId: number) {
  localStorage.removeItem(progressKey(recipeId));
}

export function pushRecentCook(recipeId: number, title: string) {
  const now = Date.now();
  const next: RecentCook = { recipeId, title, lastOpenedAt: now };
  try {
    const raw = localStorage.getItem('cook.recents');
    const prev = raw ? (JSON.parse(raw) as RecentCook[]) : [];
    const list = Array.isArray(prev) ? prev : [];
    const merged = [next, ...list.filter((x) => x.recipeId !== recipeId)].slice(0, 20);
    localStorage.setItem('cook.recents', JSON.stringify(merged));
  } catch {
    localStorage.setItem('cook.recents', JSON.stringify([next]));
  }
}

