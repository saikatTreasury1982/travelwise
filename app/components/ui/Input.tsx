// app/components/ui/Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/app/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref,
) {
  const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-faint)' }}>{leftIcon}</div>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            'w-full h-[52px] rounded-[var(--radius-md,11px)] text-[15px] transition-all focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            leftIcon ? 'pl-11' : 'px-4',
            rightIcon ? 'pr-11' : (leftIcon ? 'pr-4' : ''),
            className,
          )}
          style={{
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)'; props.onFocus?.(e); }}
          onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)'; props.onBlur?.(e); }}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-faint)' }}>{rightIcon}</div>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm font-medium animate-slide-down" style={{ color: 'var(--danger)' }}>{error}</p>}
      {helperText && !error && <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-faint)' }}>{helperText}</p>}
    </div>
  );
});

export default Input;