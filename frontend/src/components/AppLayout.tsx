import * as React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { Button } from './ui/Button';

type NavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon?: string;
  requiresAuth?: boolean;
  hidden?: boolean;
};

function usePrimaryNav(): NavItem[] {
  const { isGuest } = useAuth();

  return [
    { to: '/recipes', label: 'Recipes', shortLabel: 'Recipes', icon: '📚' },
    { to: '/cook', label: 'Cook', shortLabel: 'Cook', icon: '🍳' },
    { to: '/add', label: 'Add', shortLabel: 'Add', icon: '➕', requiresAuth: true, hidden: isGuest },
    // Meal Plans stays available, but is intentionally not primary on mobile.
  ];
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isGuest, logout } = useAuth();
  const primaryNav = usePrimaryNav();

  // Hide layout chrome on login.
  if (location.pathname === '/login') return <>{children}</>;

  return (
    <div className="min-h-full bg-bg text-text">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link to="/recipes" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-lg">🍽️</span>
            <span className="hidden sm:inline">Recipes</span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <NavLink
              to="/recipes"
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-text hover:bg-surface2',
                  isActive && 'text-text bg-surface2'
                )
              }
            >
              Recipes
            </NavLink>
            {!isGuest && (
              <NavLink
                to="/add"
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-text hover:bg-surface2',
                    isActive && 'text-text bg-surface2'
                  )
                }
              >
                Add
              </NavLink>
            )}
            {!isGuest && (
              <NavLink
                to="/meal-plans"
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-text hover:bg-surface2',
                    isActive && 'text-text bg-surface2'
                  )
                }
              >
                Meal Plans
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted">
              <span className="truncate max-w-[12ch]">{isGuest ? 'Guest' : user?.username}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              {isGuest ? 'Login' : 'Logout'}
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-20 md:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-3 px-2 py-2">
          {primaryNav
            .filter((i) => !i.hidden)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-2 text-xs font-medium text-muted',
                    'min-h-11',
                    isActive && 'text-text bg-surface2'
                  )
                }
              >
                <span aria-hidden="true" className="text-base">
                  {item.icon}
                </span>
                <span>{item.shortLabel ?? item.label}</span>
              </NavLink>
            ))}
        </div>
      </nav>
    </div>
  );
}

