import { useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { buildTheme } from './theme';
import { loadPreferences } from './store/preferences';
import type { ThemeMode } from './store/preferences';
import type { ColorTheme } from './theme/colors';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Configuration from './pages/Configuration';
import RoutesPage from './pages/Routes';
import Security from './pages/Security';
import Logs from './pages/Logs';
import Profile from './pages/Profile';
import License from './pages/License';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const key = localStorage.getItem('api_key');
  if (!key) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const prefs = loadPreferences();
  const [themeMode, setThemeMode] = useState<ThemeMode>(prefs.themeMode);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(prefs.colorTheme);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const isDark = themeMode === 'auto' ? prefersDark : themeMode === 'dark';

  const theme = useMemo(
    () => buildTheme(isDark ? 'dark' : 'light', colorTheme),
    [isDark, colorTheme]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          <Route path="/login" element={
            <Login
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              colorTheme={colorTheme}
              setColorTheme={setColorTheme}
            />
          } />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout themeMode={themeMode} setThemeMode={setThemeMode} />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/configuration" element={<Configuration />} />
            <Route path="/extensions" element={<Navigate to="/configuration" replace />} />
            <Route path="/users" element={<Navigate to="/configuration" replace />} />
            <Route path="/gateways" element={<Navigate to="/configuration" replace />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/security" element={<Security />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Navigate to="/profile" replace />} />
            <Route path="/license" element={<License />} />
            <Route
              path="/profile"
              element={
                <Profile
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  colorTheme={colorTheme}
                  setColorTheme={setColorTheme}
                />
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
