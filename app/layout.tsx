// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { getDefaultTheme, tokensToCssVars } from '@/app/lib/services/theme-service';
import { ThemeProvider } from '@/app/components/ui/ThemeProvider';
import { DEFAULT_THEME } from '@/app/lib/config/theme';

export const metadata: Metadata = {
  title: 'Travelwise',
  description: 'Plan unforgettable journeys, on a budget that works.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getDefaultTheme();
  const themeCss = theme ? tokensToCssVars(theme.tokens) : '';
  const initialTheme = theme?.themeId ?? DEFAULT_THEME;

  return (
    <html lang="en" data-theme={initialTheme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      </head>
      <body>
        <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}