import { useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme } from './theme';
import { loadPreferences } from './store/preferences';
import type { ColorTheme } from './theme/colors';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Gateways from './pages/Gateways';
import RoutesPage from './pages/Routes';
import Security from './pages/Security';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const key = localStorage.getItem('api_key');
  if (!key) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const prefs = loadPreferences();
  const [darkMode, setDarkMode] = useState(prefs.darkMode);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(prefs.colorTheme);

  const theme = useMemo(
    () => buildTheme(darkMode ? 'dark' : 'light', colorTheme),
    [darkMode, colorTheme]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/gateways" element={<Gateways />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/security" element={<Security />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/profile"
              element={
                <Profile
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                  colorTheme={colorTheme}
                  setColorTheme={setColorTheme}
                />
              }
            />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
