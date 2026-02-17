/**
 * @file Sidebar — Collapsible navigation sidebar with dark/light mode toggle
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, Box, IconButton, Tooltip,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TuneIcon from '@mui/icons-material/Tune';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import TerminalIcon from '@mui/icons-material/Terminal';
import SettingsIcon from '@mui/icons-material/Settings';
import ExtensionIcon from '@mui/icons-material/Extension';
import StarIcon from '@mui/icons-material/Star';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { savePreferences } from '../../store/preferences';
import type { ThemeMode } from '../../store/preferences';
import { clearApiKey } from '../../store/keyStore';
import api from '../../api/client';
import LogoutCountdown from '../LogoutCountdown';

export const DRAWER_WIDTH = 240;
export const DRAWER_WIDTH_COLLAPSED = 64;

const baseNavItems = [
  { key: '/',              icon: <DashboardIcon />, label: 'nav.dashboard' },
  { key: '/configuration', icon: <TuneIcon />,      label: 'nav.config', requiresLicense: true },
  { key: '/integrations',  icon: <ExtensionIcon />, label: 'nav.integrations' },
  { key: '/monitoring',    icon: <MonitorHeartIcon />, label: 'nav.monitoring' },
  { key: '/logs',          icon: <TerminalIcon />,  label: 'nav.logs' },
  { key: '/profile',       icon: <SettingsIcon />,  label: 'nav.profile' },
];

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const modeOrder: ThemeMode[] = ['light', 'dark', 'auto'];

export default function Sidebar({ themeMode, setThemeMode, collapsed, onToggleCollapse }: Props) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasVip, setHasVip] = useState(false);
  const [hasLicense, setHasLicense] = useState(false);

  const checkLicenses = useCallback(async () => {
    try {
      const res = await api.get('/license');
      const features: string[] = res.data?.active_features || [];
      const lics: { license_name: string; licensed: boolean }[] = res.data?.licenses || [];
      setHasLicense(features.length > 0);
      setHasVip(lics.some((l) => l.licensed && l.license_name === 'Premium Support'));
    } catch {
      setHasLicense(false);
      setHasVip(false);
    }
  }, []);

  useEffect(() => { checkLicenses(); }, [checkLicenses]);
  // Re-check on navigation or when licenses change
  useEffect(() => { checkLicenses(); }, [location.pathname, checkLicenses]);
  useEffect(() => {
    const handler = () => checkLicenses();
    window.addEventListener('license-changed', handler);
    return () => window.removeEventListener('license-changed', handler);
  }, [checkLicenses]);

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const cycleThemeMode = () => {
    const idx = modeOrder.indexOf(themeMode);
    const next = modeOrder[(idx + 1) % modeOrder.length];
    setThemeMode(next);
    savePreferences({ themeMode: next });
  };

  const handleLogout = () => {
    // Clear session on server, then local cleanup
    api.post('/auth/logout').catch(() => {});
    clearApiKey();
    navigate('/login');
  };

  const toggleLanguage = () => {
    const next = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(next);
    savePreferences({ language: next });
  };

  const themeModeIcon = themeMode === 'dark' ? <LightModeIcon /> : themeMode === 'auto' ? <BrightnessAutoIcon /> : <DarkModeIcon />;
  const themeModeLabel = themeMode === 'dark' ? t('theme.light') : themeMode === 'auto' ? t('theme.light') : t('theme.dark');

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: 'width 0.2s ease',
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          transition: 'width 0.2s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Toolbar sx={{ justifyContent: collapsed ? 'center' : 'space-between', minHeight: 64, px: collapsed ? 0 : 2 }}>
        {!collapsed && (
          <Typography variant="h6" noWrap sx={{ color: '#fff', fontWeight: 700 }}>
            Linkify TalkHub
          </Typography>
        )}
        <IconButton
          onClick={onToggleCollapse}
          size="small"
          sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ px: collapsed ? 0.5 : 1 }}>
        {[...baseNavItems.filter((item) => !('requiresLicense' in item && item.requiresLicense) || hasLicense), ...(hasVip ? [{ key: '/vip', icon: <StarIcon sx={{ color: 'warning.main' }} />, label: 'nav.vip' }] : [])].map((item) => (
          <Tooltip key={item.key} title={collapsed ? t(item.label) : ''} placement="right" arrow>
            <ListItemButton
              selected={location.pathname === item.key}
              onClick={() => navigate(item.key)}
              sx={{
                borderRadius: 1, mb: 0.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1.5 : 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: '#fff',
                  '& .MuiListItemIcon-root': { color: '#fff' },
                  '&:hover': { bgcolor: 'primary.dark' },
                },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: collapsed ? 'unset' : 40, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && <ListItemText primary={t(item.label)} />}
            </ListItemButton>
          </Tooltip>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />

      {/* Auto-logout countdown */}
      <LogoutCountdown collapsed={collapsed} />

      {/* Theme mode toggle + Logout */}
      <Box sx={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: 1, pb: 1 }}>
        <Tooltip title={themeModeLabel} placement={collapsed ? 'right' : 'top'}>
          <IconButton
            onClick={cycleThemeMode}
            sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}
          >
            {themeModeIcon}
          </IconButton>
        </Tooltip>
        <Tooltip title={i18n.language === 'de' ? 'English' : 'Deutsch'} placement={collapsed ? 'right' : 'top'}>
          <IconButton
            onClick={toggleLanguage}
            sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' }, fontSize: 14, fontWeight: 700, width: 40, height: 40 }}
          >
            {i18n.language.toUpperCase()}
          </IconButton>
        </Tooltip>
        <Tooltip title={t('auth.logout')} placement={collapsed ? 'right' : 'top'}>
          <IconButton
            onClick={handleLogout}
            sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'error.main' } }}
          >
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      {!collapsed && (
        <Box sx={{ p: 1.5, color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' }}>
          v2.0.0
        </Box>
      )}
      {collapsed && <Box sx={{ py: 1 }} />}
    </Drawer>
  );
}
