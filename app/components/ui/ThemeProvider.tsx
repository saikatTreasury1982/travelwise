// app/components/ThemeProvider.tsx
'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DEFAULT_THEME, isValidTheme, type ThemeKey } from '@/app/lib/config/theme';

const STORAGE_KEY = 'tw-theme';

type ThemeContextValue = {
  theme: ThemeKey;
  setTheme: (next: ThemeKey) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function ThemeProvider({ children, initialTheme }: { children: React.ReactNode; initialTheme?: string }) {
  const [theme, setThemeState] = useState<ThemeKey>(isValidTheme(initialTheme) ? initialTheme : DEFAULT_THEME);

  // On mount, prefer a locally-stored choice (per-viewer convenience).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isValidTheme(stored) && stored !== theme) setThemeState(stored);
    } catch { /* storage unavailable — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeKey) => {
    if (!isValidTheme(next)) return;
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}