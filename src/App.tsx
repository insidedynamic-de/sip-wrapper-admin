import { useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { buildTheme } from './theme';
import { loadPreferences } from './store/preferences';
import type { ThemeMode } from './store/preferences';
import type { ColorTheme } from './theme/colors';
import { isAuthenticated } from './store/auth';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import SaasDashboard from './pages/SaasDashboard';
import ProductCatalog from './pages/ProductCatalog';
import AdminClients from './pages/AdminClients';
import AdminUsers from './pages/AdminUsers';
import Configuration from './pages/Configuration';
import Logs from './pages/Logs';
import Profile from './pages/Profile';
import Monitoring from './pages/Monitoring';
import Integrations from './pages/Integrations';
import VIP from './pages/VIP';
import LicenseManagement from './pages/LicenseManagement';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
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
          {/* Public routes */}
          <Route path="/login" element={
            <Login themeMode={themeMode} setThemeMode={setThemeMode} colorTheme={colorTheme} setColorTheme={setColorTheme} />
          } />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route element={
            <ProtectedRoute>
              <MainLayout themeMode={themeMode} setThemeMode={setThemeMode} />
            </ProtectedRoute>
          }>
            <Route path="/" element={<SaasDashboard />} />
            <Route path="/catalog" element={<ProductCatalog />} />

            {/* Superadmin */}
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/users" element={<AdminUsers />} />

            {/* TalkHub product config (legacy pages, kept working) */}
            <Route path="/configuration" element={<Configuration />} />
            <Route path="/products/talkhub" element={<Configuration />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/vip" element={<VIP />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/licenses" element={<LicenseManagement />} />
            <Route path="/profile" element={
              <Profile themeMode={themeMode} setThemeMode={setThemeMode} colorTheme={colorTheme} setColorTheme={setColorTheme} />
            } />

            {/* Legacy redirects */}
            <Route path="/extensions" element={<Navigate to="/configuration" replace />} />
            <Route path="/users" element={<Navigate to="/configuration" replace />} />
            <Route path="/gateways" element={<Navigate to="/configuration" replace />} />
            <Route path="/routes" element={<Navigate to="/configuration" replace />} />
            <Route path="/security" element={<Navigate to="/configuration" replace />} />
            <Route path="/settings" element={<Navigate to="/configuration" replace />} />
            <Route path="/license" element={<Navigate to="/licenses" replace />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}
