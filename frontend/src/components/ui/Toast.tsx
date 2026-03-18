/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { cn } from '../../lib/cn';

export type ToastKind = 'info' | 'success' | 'error';

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, 'id'>) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider />');
  return ctx;
}

function kindClasses(kind: ToastKind) {
  switch (kind) {
    case 'success':
      return 'border-border bg-surface';
    case 'error':
      return 'border-danger/30 bg-surface';
    default:
      return 'border-border bg-surface';
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID();
    const item: ToastItem = { id, ...t };
    setItems((prev) => [item, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-full max-w-md rounded-lg border shadow-popover px-4 py-3',
              kindClasses(t.kind)
            )}
            role="status"
            aria-live="polite"
          >
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            <div className="text-sm text-muted">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

