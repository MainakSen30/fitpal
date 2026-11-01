/**
 * FitPal design tokens.
 * Source of truth: documents/design.md + apps/web/app/globals.css
 * Do not introduce colors outside this system.
 */

export const colors = {
  // Base
  bg: '#060709',
  card: '#0d0f14',
  surface: '#13161f',

  // Brand (orange)
  brandGlow: '#ff6200',
  brand50: '#fff7ed',
  brand100: '#ffedd5',
  brand400: '#fb923c',
  brand500: '#f97316',
  brand600: '#ea580c',
  brand700: '#c2410c',

  // Text
  text: '#f3f4f6',
  textSecondary: '#d1d5db',
  textMuted: '#9ca3af',
  textFaint: '#6b7280',

  // Semantic
  error: '#ef4444',
  success: '#34d399',
  warning: '#fbbf24',

  // Borders (subtle white/8-10)
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  borderBrand: 'rgba(249, 115, 22, 0.25)',
} as const;

export const gradients = {
  brand: ['#f97316', '#ea580c'] as const,
  brandHero: ['#fb923c', '#f97316', '#ea580c'] as const,
  heroText: ['#fb923c', '#f97316', '#ea580c'] as const,
} as const;

export const glow = {
  orange: {
    shadowColor: '#f97316',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  orangeSm: {
    shadowColor: '#f97316',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
  },
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const typography = {
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 } as const,
  heading: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 } as const,
  sectionTitle: { fontSize: 18, fontWeight: '600', letterSpacing: -0.2 } as const,
  body: { fontSize: 15, fontWeight: '400' } as const,
  label: { fontSize: 14, fontWeight: '600' } as const,
  caption: { fontSize: 12, fontWeight: '500' } as const,
  mono: { fontSize: 14, fontVariant: ['tabular-nums'] } as const,
} as const;

export const fontFamily = {
  mono: 'JetBrains Mono, SF Mono, Menlo',
};
