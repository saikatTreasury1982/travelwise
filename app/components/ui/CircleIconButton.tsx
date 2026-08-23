// app/components/ui/CircleIconButton.tsx
'use client';
import { cn } from '@/app/lib/utils';

interface CircleIconButtonProps {
  type?: 'button' | 'submit';
  variant?: 'default' | 'primary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  title?: string;
  label?: string;            // optional visible label beneath the circle
  icon: React.ReactNode;
  className?: string;
}

export default function CircleIconButton({
  type = 'button', variant = 'default', size = 'medium',
  onClick, disabled = false, isLoading = false, title, label, icon, className,
}: CircleIconButtonProps) {
  // Tokenized variants (work on flat + glass; glass frosts via backdrop-blur).
  const variants = {
    default: 'bg-[color:var(--surface)] border-[color:var(--border)] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:border-[color:var(--accent)]',
    primary: 'bg-[color:var(--primary)] border-transparent text-[color:var(--primary-ink)] hover:opacity-90',
    danger:  'bg-[color:var(--danger-bg)] border-[color:var(--danger)] text-[color:var(--danger)] hover:opacity-90',
  };
  // small bumped to 44px (tap floor); medium 60; large 72.
  const sizes = { small: 'w-11 h-11', medium: 'w-[60px] h-[60px]', large: 'w-[72px] h-[72px]' };
  const spinners = { small: 'w-4 h-4', medium: 'w-5 h-5', large: 'w-6 h-6' };

  const button = (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      title={title}
      className={cn(
        sizes[size],
        'rounded-full border flex items-center justify-center backdrop-blur-sm',
        'transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
    >
      {isLoading ? (
        <div className={cn(spinners[size], 'border-2 border-current border-t-transparent rounded-full animate-spin')} />
      ) : icon}
    </button>
  );

  if (!label) return button;
  return (
    <div className="flex flex-col items-center gap-[9px]">
      {button}
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{label}</span>
    </div>
  );
}