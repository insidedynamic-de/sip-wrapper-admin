import { createTheme } from '@mui/material/styles';
import { colorThemes, type ColorTheme } from './colors';

export function buildTheme(mode: 'light' | 'dark', color: ColorTheme = 'default') {
  const palette = colorThemes[color] || colorThemes.default;

  return createTheme({
    palette: {
      mode,
      primary: { main: palette.main, dark: palette.dark, light: palette.light },
      background: mode === 'dark'
        ? { default: '#0f172a', paper: '#1e293b' }
        : { default: '#f8fafc', paper: '#ffffff' },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 12 } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'dark' ? '#0f172a' : '#1e293b',
            color: 'rgba(255,255,255,0.7)',
          },
        },
      },
    },
  });
}
