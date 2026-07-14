// Frozen design tokens — source: team-build-package.md section 2.7 /
// cashflow-demo-v1.2.jsx. Nobody picks their own colors.

export const colors = {
  bg: '#0B0D11',        // app background
  surface: '#161A20',   // tiles / cards
  surface2: '#1E232B',  // sheets / elevated panels
  border: '#262C36',
  text: '#ECEEF1',
  dim: '#8A93A3',
  faint: '#5B6270',
  gold: '#D8A73D',       // accent / interactive / selection
  green: '#34D399',      // income / positive
  red: '#F87171',        // expense / negative / negative balances
} as const;

// Extra shades used by the JSX reference beyond the frozen list
// (nav bar background, outer frame, tinted gold surfaces).
export const colorsExtra = {
  bgDeep: '#05060A',
  navBg: '#0F1218',
  navBorder: '#1B1F27',
  borderLight: '#3A4150',
  goldTint: 'rgba(216, 167, 61, 0.12)',
  goldFaintTint: 'rgba(216, 167, 61, 0.05)',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const typeScale = { xs: 10, sm: 11, base: 12, md: 13, lg: 14, xl: 15 } as const; // px
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } as const;               // px
export const radii = { sm: 8, md: 12, lg: 16, full: 999 } as const;

/** Shared money formatter — locale-aware thousand separators, max 2 decimals,
 *  no currency suffix (screens append settings.currency themselves). */
export function money(n: number | null | undefined): string {
  return (n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
