/**
 * @file MainLayout — Main app layout with collapsible sidebar and content area
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar, { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from './Sidebar';
import ErrorBoundary from '../ErrorBoundary';
import SetupWizard from '../SetupWizard';
import LicenseOverlay from '../LicenseOverlay';
import DemoRibbon from '../DemoRibbon';
import api from '../../api/client';
import { loadPreferences, savePreferences, isDemoMode } from '../../store/preferences';
import type { ThemeMode } from '../../store/preferences';

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
}

export default function MainLayout({ themeMode, setThemeMode }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => loadPreferences().sidebarCollapsed);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const [licenseExpired, setLicenseExpired] = useState(false);

  const checkSetup = useCallback(async () => {
    try {
      const res = await api.get('/company');
      const companyId = res.data?.company_id || '';
      setSetupRequired(!companyId);
    } catch {
      // If API fails, don't block — user can't do setup without backend anyway
      setSetupRequired(false);
    }
    setSetupChecked(true);
  }, []);

  useEffect(() => { checkSetup(); }, [checkSetup]);

  // Listen for license status from Sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLicenseExpired(detail?.hasExpired === true);
    };
    window.addEventListener('license-status', handler);
    return () => window.removeEventListener('license-status', handler);
  }, []);

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    savePreferences({ sidebarCollapsed: next });
  };

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 3,
          pb: 3,
          pt: 4,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
          transition: 'width 0.2s ease',
        }}
      >
        <ErrorBoundary
          resetKey={`${location.pathname}-${contentKey}`}
          labels={{
            title: t('error.boundary_title'),
            message: t('error.boundary_message'),
            showDetails: t('error.show_details'),
            hideDetails: t('error.hide_details'),
            reload: t('error.reload'),
            sendReport: t('error.send_report'),
            goDashboard: t('error.go_dashboard'),
          }}
        >
          <Outlet key={contentKey} />
        </ErrorBoundary>
      </Box>

      {setupChecked && (
        <SetupWizard
          open={setupRequired}
          onComplete={() => {
            setSetupRequired(false);
            setContentKey((k) => k + 1);
          }}
        />
      )}

      <LicenseOverlay active={licenseExpired} />
      {isDemoMode() && <DemoRibbon />}
    </Box>
  );
}
