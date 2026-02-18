/**
 * @file Sidebar — Collapsible navigation sidebar with dark/light mode toggle
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, Box, IconButton, Tooltip, Collapse,
} from '@mui/material';
import { useEffect, useState, useCallback, useMemo, type ReactElement } from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import TerminalIcon from '@mui/icons-material/Terminal';
import SettingsIcon from '@mui/icons-material/Settings';
import ExtensionIcon from '@mui/icons-material/Extension';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

import SmartToyIcon from '@mui/icons-material/SmartToy';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import HubIcon from '@mui/icons-material/Hub';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LogoutIcon from '@mui/icons-material/Logout';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { savePreferences } from '../../store/preferences';
import type { ThemeMode } from '../../store/preferences';
import { clearApiKey } from '../../store/keyStore';
import api from '../../api/client';
import LogoutCountdown from '../LogoutCountdown';

export const DRAWER_WIDTH = 240;
export const DRAWER_WIDTH_COLLAPSED = 64;

const baseNavItems = [
  { key: '/configuration', icon: <TuneIcon />,      label: 'nav.config',       requiresHub: true },
  { key: '/integrations',  icon: <ExtensionIcon />, label: 'nav.integrations', requiresHub: false },
  { key: '/licenses',      icon: <VpnKeyIcon />,    label: 'nav.licenses',     requiresHub: false },
  { key: '/monitoring',    icon: <MonitorHeartIcon />, label: 'nav.monitoring', requiresHub: true },
  { key: '/logs',          icon: <TerminalIcon />,  label: 'nav.logs',         requiresHub: true },
  { key: '/profile',       icon: <SettingsIcon />,  label: 'nav.profile',      requiresHub: false },
];

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/** Integration licenses that get their own sidebar menu item when active */
const INTEGRATION_NAV: Record<string, { key: string; icon: ReactElement; label: string }> = {
  'VAPI':            { key: '/integrations#vapi',    icon: <SmartToyIcon />,     label: 'VAPI' },
  'Odoo':            { key: '/integrations#odoo',    icon: <StorefrontIcon />,   label: 'Odoo' },
  'Zoho':            { key: '/integrations#zoho',    icon: <HubIcon />,          label: 'Zoho' },
  'Retell':          { key: '/integrations#retell',  icon: <SmartToyIcon />,     label: 'Retell AI' },
  'Bland':           { key: '/integrations#bland',   icon: <SmartToyIcon />,     label: 'Bland AI' },
  'HubSpot':         { key: '/integrations#hubspot', icon: <HubIcon />,          label: 'HubSpot' },
  'Premium Support': { key: '/vip',                  icon: <SupportAgentIcon />, label: 'Premium Support' },
};

const modeOrder: ThemeMode[] = ['light', 'dark', 'auto'];

export default function Sidebar({ themeMode, setThemeMode, collapsed, onToggleCollapse }: Props) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasLicense, setHasLicense] = useState(false);
  const [hasHub, setHasHub] = useState(false);
  const [activeLicenseNames, setActiveLicenseNames] = useState<string[]>([]);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  const checkLicenses = useCallback(async () => {
    try {
      const res = await api.get('/license');
      const features: string[] = res.data?.active_features || [];
      const lics: { license_name: string; licensed: boolean; valid_until?: string }[] = res.data?.licenses || [];
      const hasActive = features.length > 0;
      setHasLicense(hasActive);
      setHasHub(lics.some((l) => l.licensed && l.license_name === 'Basic'));
      setActiveLicenseNames(lics.filter((l) => l.licensed).map((l) => l.license_name));

      // Detect expired: licenses exist but none are active
      const hasExpired = lics.length > 0 && !hasActive && lics.some((l) => {
        if (!l.valid_until) return false;
        return new Date(l.valid_until) < new Date();
      });
      // Dispatch license status for overlay
      window.dispatchEvent(new CustomEvent('license-status', {
        detail: { hasLicense: hasActive, hasExpired, licenseCount: lics.length },
      }));
    } catch {
      setHasLicense(false);
      setHasHub(false);
      setActiveLicenseNames([]);
      window.dispatchEvent(new CustomEvent('license-status', {
        detail: { hasLicense: false, hasExpired: false, licenseCount: 0 },
      }));
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

  // Build dynamic integration nav items from active licenses
  const integrationNavItems = useMemo(() => {
    return activeLicenseNames
      .filter((name) => name !== 'Basic' && INTEGRATION_NAV[name])
      .map((name) => INTEGRATION_NAV[name]);
  }, [activeLicenseNames]);

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
            Linkify
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
        {baseNavItems.filter((item) => {
          if (item.requiresHub && !hasHub) return false;
          if (!item.requiresHub && !hasLicense && item.key !== '/profile' && item.key !== '/integrations' && item.key !== '/licenses') return false;
          return true;
        }).map((item) => {
          const isIntegrations = item.key === '/integrations';
          const hasSubItems = isIntegrations && integrationNavItems.length > 0;

          return (
            <Box key={item.key}>
              <Tooltip title={collapsed ? t(item.label) : ''} placement="right" arrow>
                <ListItemButton
                  selected={location.pathname === item.key}
                  onClick={() => {
                    if (hasSubItems && !collapsed) {
                      setIntegrationsOpen((v) => !v);
                    } else {
                      navigate(item.key);
                    }
                  }}
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
                  {!collapsed && hasSubItems && (integrationsOpen ? <ExpandLessIcon sx={{ fontSize: 18, opacity: 0.6 }} /> : <ExpandMoreIcon sx={{ fontSize: 18, opacity: 0.6 }} />)}
                </ListItemButton>
              </Tooltip>

              {/* Collapsible integration sub-items */}
              {hasSubItems && !collapsed && (
                <Collapse in={integrationsOpen} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    {integrationNavItems.map((sub) => (
                      <Tooltip key={sub.key} title="" placement="right">
                        <ListItemButton
                          selected={sub.key === '/vip' ? location.pathname === '/vip' : false}
                          onClick={() => {
                            if (sub.key.startsWith('/integrations#')) {
                              navigate('/integrations');
                              window.location.hash = '#/' + sub.key.split('#')[1];
                            } else {
                              navigate(sub.key);
                            }
                          }}
                          sx={{
                            borderRadius: 1, mb: 0.25, pl: 4, py: 0.5,
                            '&.Mui-selected': {
                              bgcolor: 'primary.main',
                              color: '#fff',
                              '& .MuiListItemIcon-root': { color: '#fff' },
                              '&:hover': { bgcolor: 'primary.dark' },
                            },
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                          }}
                        >
                          <ListItemIcon sx={{ color: 'inherit', minWidth: 32, justifyContent: 'center', '& .MuiSvgIcon-root': { fontSize: 18 } }}>
                            {sub.icon}
                          </ListItemIcon>
                          <ListItemText primary={sub.label} primaryTypographyProps={{ fontSize: 13 }} />
                        </ListItemButton>
                      </Tooltip>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          );
        })}
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
