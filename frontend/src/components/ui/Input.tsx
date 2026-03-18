import * as React from 'react';
import { cn } from '../../lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text',
        'placeholder:text-muted focus:border-ring focus:ring-2 focus:ring-ring/20',
        'disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
      {...props}
    />
  );
});

