import * as React from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClasses: Record<Variant, string> = {
  primary:
    // Soft modern primary: tinted background + colored text + subtle border.
    // Avoids a harsh fully-filled button while keeping clear affordance.
    'bg-primary/10 text-primary border border-primary/30 shadow-sm hover:bg-primary/15 active:bg-primary/20 disabled:opacity-50 disabled:pointer-events-none',
  secondary:
    'bg-surface text-text border border-border hover:bg-surface2 active:bg-surface2 disabled:opacity-50 disabled:pointer-events-none',
  ghost:
    'bg-transparent text-text hover:bg-surface2 active:bg-surface2 disabled:opacity-50 disabled:pointer-events-none',
  danger:
    // Soft modern danger: tinted red + subtle border.
    'bg-danger/10 text-danger border border-danger/30 shadow-sm hover:bg-danger/15 active:bg-danger/20 disabled:opacity-50 disabled:pointer-events-none',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', type, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none',
        'min-h-11 select-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});

