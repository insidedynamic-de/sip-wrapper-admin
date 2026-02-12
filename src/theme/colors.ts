export const colorThemes = {
  default: { main: '#6366f1', dark: '#4f46e5', light: '#818cf8' },
  ocean:   { main: '#0ea5e9', dark: '#0284c7', light: '#38bdf8' },
  forest:  { main: '#22c55e', dark: '#16a34a', light: '#4ade80' },
  sunset:  { main: '#f97316', dark: '#ea580c', light: '#fb923c' },
} as const;

export type ColorTheme = keyof typeof colorThemes;
