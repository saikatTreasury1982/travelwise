// app/components/auth/AuthActions.tsx
'use client';
import { useTheme } from '@/app/components/ui/ThemeProvider';
import { getTheme } from '@/app/lib/config/theme';
import Button from '@/app/components/ui/Button';
import CircleIconButton from '@/app/components/ui/CircleIconButton';

// Which themes are "glass" — those get icon-circles. (Keep in sync with globals.css.)
const GLASS_THEMES = new Set(['midnight-ocean', 'forest-expedition']);

export interface AuthAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: 'primary' | 'default';
}

export default function AuthActions({ actions }: { actions: AuthAction[] }) {
  const { theme } = useTheme();
  // getTheme keeps this safe if theme is somehow unknown.
  const isGlass = GLASS_THEMES.has(getTheme(theme).key);

  if (isGlass) {
    // labelled icon-circles, in a row
    return (
      <div className="flex flex-wrap justify-center gap-4">
        {actions.map((a) => (
          <CircleIconButton
            key={a.key}
            variant={a.variant === 'primary' ? 'primary' : 'default'}
            size="medium"
            onClick={a.onClick}
            isLoading={a.loading}
            title={a.label}
            label={a.label}
            icon={a.icon}
          />
        ))}
      </div>
    );
  }

  // flat: full-width labelled buttons, stacked
  return (
    <div className="flex flex-col gap-[10px]">
      {actions.map((a) => (
        <Button
          key={a.key}
          variant={a.variant === 'primary' ? 'primary' : 'outline'}
          isLoading={a.loading}
          onClick={a.onClick}
          leftIcon={a.icon}
          fullWidth
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}