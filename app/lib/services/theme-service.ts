// app/lib/theme/theme-service.ts
// Loads the active/default theme's tokens from the themes table, and turns
// them into a CSS-variable string the layout injects into :root.
import { rawQuery } from '../db/client';

export interface ThemeTokens {
  color?: Record<string, string>;
  type?: Record<string, string>;
  radius?: Record<string, string>;
  space?: Record<string, string>;
  'surface-style'?: string;
}

export async function getDefaultTheme(): Promise<{ themeId: string; tokens: ThemeTokens } | null> {
  try {
    const rows = await rawQuery<{ theme_id: string; tokens: string }>(
      `SELECT theme_id, tokens FROM themes WHERE is_default = 1 AND is_active = 1 LIMIT 1`,
    );
    if (rows.length === 0) return null;
    return { themeId: rows[0].theme_id, tokens: JSON.parse(rows[0].tokens) as ThemeTokens };
  } catch {
    return null;
  }
}

/** Turns theme tokens into a `:root{...}` CSS string for injection.
 *  Our themes table stores minimal tokens (mainly surface-style); the full
 *  token values live in globals.css per data-theme block. So this mostly
 *  returns empty — the data-theme attribute does the real work. It exists so
 *  a theme CAN override specific vars from the DB later if we choose. */
export function tokensToCssVars(tokens: ThemeTokens): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(tokens.color ?? {})) lines.push(`--${k}: ${v};`);
  if (tokens.type?.display) lines.push(`--font-display: ${tokens.type.display};`);
  if (tokens.type?.body) lines.push(`--font-body: ${tokens.type.body};`);
  for (const [k, v] of Object.entries(tokens.radius ?? {})) lines.push(`--radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.space ?? {})) lines.push(`--space-${k}: ${v};`);
  return lines.length ? `:root{${lines.join('')}}` : '';
}