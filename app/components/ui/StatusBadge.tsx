// app/components/ui/StatusBadge.tsx
interface StatusBadgeProps {
  status: 'draft' | 'shortlisted' | 'confirmed' | 'not_selected';
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  // Status colors use theme tokens where they map (confirmed→success, not_selected→danger)
  // and readable neutrals/warnings otherwise. color-mix keeps them legible on flat + glass.
  const statusConfig: Record<StatusBadgeProps['status'], { label: string; color: string }> = {
    draft:        { label: 'Draft',        color: 'var(--ink-soft)' },
    shortlisted:  { label: 'Shortlisted',  color: 'var(--accent-deep)' },
    confirmed:    { label: 'Confirmed',    color: 'var(--success)' },
    not_selected: { label: 'Not selected', color: 'var(--danger)' },
  };

  const { label, color } = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses[size]}`}
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        color,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}