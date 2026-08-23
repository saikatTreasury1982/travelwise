// app/lib/config/theme.ts
// Client-side theme registry. Keys MUST match theme_id in the themes table
// and the data-theme blocks in globals.css.

export const THEMES = [
  {
    key: 'direction-d',
    label: 'Travelwise',
    description: 'Warm, clean, split-panel',
    swatch: ['#FCFBF9', '#16110B', '#E8A33D'],
  },
  {
    key: 'midnight-ocean',
    label: 'Midnight Ocean',
    description: 'Deep navy and teal',
    swatch: ['#0B1B2B', '#103449', '#1D9E75'],
  },
  {
    key: 'forest-expedition',
    label: 'Forest Expedition',
    description: 'Pine, moss and gold',
    swatch: ['#12211C', '#1D3A28', '#B07C18'],
  },
] as const;

export type ThemeKey = (typeof THEMES)[number]['key'];

export const DEFAULT_THEME: ThemeKey = 'direction-d';

export const THEME_KEYS = THEMES.map((t) => t.key) as readonly ThemeKey[];

export function isValidTheme(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value);
}

export function getTheme(key: string | null | undefined) {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

/* Semantic status colours — constant across all themes (safe to use in JS). */
export const semantic = {
  success: { light: '#6EE7B7', main: '#2E7D5B', dark: '#1F5A40' },
  warning: { light: '#FCD34D', main: '#D6A029', dark: '#A8721F' },
  error:   { light: '#F0A99A', main: '#B4432B', dark: '#8A3220' },
} as const;

/* Read the active theme's accent at runtime — for charts, SVG fills, canvas,
   anywhere a CSS class won't reach. Returns Direction D's accent on the server. */
export function getAccentColor(): string {
  const fallback = '#E8A33D';
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || fallback;
}