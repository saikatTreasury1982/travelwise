// app/components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/app/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  pill?: boolean;
  leftIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', fullWidth = false, isLoading = false, pill = false, leftIcon, disabled, children, ...props },
  ref,
) {
  const base = cn(
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ease-in-out',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent)]',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    pill ? 'rounded-full' : 'rounded-[var(--radius-md,11px)]',
  );

  // Variants read theme tokens — theme-safe across flat + glass.
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:  'bg-[color:var(--primary)] text-[color:var(--primary-ink)] hover:opacity-90 active:scale-[0.99] shadow-sm',
    secondary:'bg-[color:var(--divider)] text-[color:var(--ink)] hover:opacity-90 active:scale-[0.99]',
    outline:  'bg-[color:var(--surface)] text-[color:var(--ink)] border border-[color:var(--border)] hover:border-[color:var(--accent)] active:scale-[0.99] font-medium',
    ghost:    'bg-transparent text-[color:var(--ink)] hover:bg-[color:var(--divider)] font-medium',
  };

  // Sizes honor the 44px tap floor (guideline 1.3): md/lg exceed it; sm = 44.
  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'px-4 text-sm h-11',        // 44px
    md: 'px-5 text-[15px] h-[52px]',
    lg: 'px-6 text-base h-[56px]',
  };

  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', isLoading && 'cursor-wait', className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Please wait…</span>
        </>
      ) : (
        <>{leftIcon}{children}</>
      )}
    </button>
  );
});

export default Button;