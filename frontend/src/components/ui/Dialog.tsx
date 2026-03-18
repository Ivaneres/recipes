import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export type DialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
};

export function Dialog({
  open,
  title,
  description,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Dialog'}
          className={cn('w-full max-w-md rounded-lg bg-surface shadow-popover border border-border')}
        >
          {(title || description) && (
            <div className="px-5 pt-5">
              {title && <div className="text-base font-semibold">{title}</div>}
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
          )}
          {children && <div className="px-5 py-4">{children}</div>}
          <div className="flex items-center justify-end gap-2 px-5 pb-5">
            <Button variant="ghost" onClick={onClose}>
              {cancelText}
            </Button>
            {onConfirm && (
              <Button variant="primary" onClick={onConfirm}>
                {confirmText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

