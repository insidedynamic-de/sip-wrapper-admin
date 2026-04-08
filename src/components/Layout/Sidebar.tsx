/**
 * @file Sidebar — Collapsible navigation sidebar with dark/light mode toggle
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, Box, IconButton, Tooltip, Collapse,
  Autocomplete, TextField, Chip,
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
import { savePreferences, loadPreferences } from '../../store/preferences';
import type { ThemeMode } from '../../store/preferences';
import { clearApiKey } from '../../store/keyStore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import StorageIcon from '@mui/icons-material/Storage';
import DnsIcon from '@mui/icons-material/Dns';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import api from '../../api/client';
import { clearTokens, getUserFromToken, getActiveTenant, setActiveTenant, getImpersonateUser, setImpersonateUser, getEffectiveUserType, type ActiveTenant } from '../../store/auth';
import LogoutCountdown from '../LogoutCountdown';

export const DRAWER_WIDTH = 240;
export const DRAWER_WIDTH_COLLAPSED = 64;

const baseNavItems = [
  { key: '/',              icon: <DashboardIcon />,    label: 'nav.dashboard',    requiresHub: false },
  { key: '/produkte',      icon: <ShoppingCartIcon />, label: 'nav.catalog',      requiresHub: false },
  { key: '/configuration', icon: <TuneIcon />,         label: 'nav.config',       requiresHub: true, dynamic: true },
  { key: '/logs',          icon: <TerminalIcon />,     label: 'nav.logs',         requiresHub: false, requiresLogs: true },
  { key: '/profile',       icon: <SettingsIcon />,     label: 'nav.profile',      requiresHub: false },
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
  const [availableTenants, setAvailableTenants] = useState<ActiveTenant[]>([]);
  const [activeTenant, setActiveTenantState] = useState<ActiveTenant | null>(getActiveTenant());
  const [hasLicense, setHasLicense] = useState(false);
  const [hasHub, setHasHub] = useState(false);
  const [activeLicenseNames, setActiveLicenseNames] = useState<string[]>([]);
  const [showTimer, setShowTimer] = useState(loadPreferences().showLogoutTimer);

  useEffect(() => {
    const handler = () => setShowTimer(loadPreferences().showLogoutTimer);
    window.addEventListener('preferences-changed', handler);
    return () => window.removeEventListener('preferences-changed', handler);
  }, []);

  // Load available tenants for switcher
  useEffect(() => {
    api.get('/tenants/available').then((res) => {
      const tenants = (res.data || []).map((t: { id: number; name: string; tenant_type: string }) => ({
        id: t.id, name: t.name, tenant_type: t.tenant_type,
      }));
      setAvailableTenants(tenants);
      // If no active tenant set, default to own
      if (!getActiveTenant() && tenants.length > 0) {
        const user = getUserFromToken();
        const own = tenants.find((t: ActiveTenant) => t.id === user?.tenant_id) || tenants[0];
        handleTenantSwitch(own, false);
      }
    }).catch(() => {});
  }, []);

  const handleTenantSwitch = (tenant: ActiveTenant | null, reload = true) => {
    setActiveTenant(tenant);
    setActiveTenantState(tenant);
    if (reload) window.location.reload();
  };

  // Load features from backend — single source of truth
  const [hasLogs, setHasLogs] = useState(false);
  const [talkHubInstanceId, setTalkHubInstanceId] = useState<number | null>(null);

  useEffect(() => {
    setHasLicense(true);
    setHasHub(false);
    setActiveLicenseNames([]);
    Promise.all([
      api.get('/features').catch(() => ({ data: {} })),
      api.get('/my-instances').catch(() => ({ data: [] })),
    ]).then(([featRes, instRes]) => {
      const sidebar = featRes.data?.sidebar || {};
      setHasLogs(!!sidebar.logs);
      setHasHub(!!sidebar.talkhub);
      // Find first online TalkHub instance
      const thInst = (instRes.data || []).find((i: { product: string; status: string }) =>
        i.product.includes('TalkHub') && i.status === 'online');
      if (thInst) setTalkHubInstanceId(thInst.id);
    });
  }, []);

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const cycleThemeMode = () => {
    const idx = modeOrder.indexOf(themeMode);
    const next = modeOrder[(idx + 1) % modeOrder.length];
    setThemeMode(next);
    savePreferences({ themeMode: next });
  };

  const handleLogout = () => {
    api.post('/auth/logout').catch(() => {});
    clearTokens();
    setActiveTenant(null);
    setImpersonateUser(null);
    navigate('/login');
  };

  const toggleLanguage = () => {
    const next = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(next);
    savePreferences({ language: next });
  };

  // Build dynamic integration nav items from active licenses

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
      {/* User info */}
      {!collapsed && (() => {
        const u = getUserFromToken();
        if (!u) return null;
        const typeLabel: Record<string, string> = { provider: 'Provider', partner: 'Partner', company: 'Kunde' };
        const roleLabel: Record<string, string> = { owner: 'Owner', superadmin: 'Superadmin', admin: 'Admin', manager: 'Manager', user: 'User' };
        return (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {u.email}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              <Typography variant="caption" sx={{
                color: u.tenant_type === 'provider' ? '#818cf8' : u.tenant_type === 'partner' ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                fontWeight: 600,
              }}>
                {typeLabel[u.tenant_type] || u.tenant_type}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>·</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                {roleLabel[u.user_type] || u.user_type}
              </Typography>
            </Box>
          </Box>
        );
      })()}
      {/* Tenant switcher — hidden during impersonate */}
      {!collapsed && availableTenants.length > 1 && !getImpersonateUser() && (
        <Box sx={{ px: 1.5, py: 1 }}>
          <Autocomplete
            size="small"
            options={availableTenants}
            getOptionLabel={(o) => o.name}
            value={activeTenant || undefined}
            onChange={(_, v) => v && handleTenantSwitch(v)}
            renderInput={(params) => (
              <TextField {...params} placeholder="Tenant..."
                sx={{
                  '& .MuiInputBase-root': { color: '#fff', fontSize: 13, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>{option.name}</Typography>
                  <Chip label={option.tenant_type} size="small" sx={{ fontSize: 10, height: 18 }}
                    color={option.tenant_type === 'provider' ? 'primary' : option.tenant_type === 'partner' ? 'warning' : 'default'} />
                </Box>
              </li>
            )}
            disableClearable
            openOnFocus
          />
        </Box>
      )}
      {collapsed && availableTenants.length > 1 && !getImpersonateUser() && (
        <Tooltip title={activeTenant?.name || 'Switch tenant'} placement="right">
          <IconButton sx={{ color: 'rgba(255,255,255,0.6)', mx: 'auto', display: 'block' }}
            onClick={() => { /* cycle to next tenant */
              const idx = availableTenants.findIndex((t) => t.id === activeTenant?.id);
              const next = availableTenants[(idx + 1) % availableTenants.length];
              handleTenantSwitch(next);
            }}>
            <SwapHorizIcon />
          </IconButton>
        </Tooltip>
      )}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      {/* Impersonate banner */}
      {getImpersonateUser() && (() => {
        const imp = getImpersonateUser()!;
        return (
          <Box sx={{
            mx: collapsed ? 0.5 : 1, my: 0.5, px: collapsed ? 0.5 : 1.5, py: 0.75,
            bgcolor: 'warning.main', borderRadius: 1,
            display: 'flex', alignItems: collapsed ? 'center' : 'row',
            flexDirection: collapsed ? 'column' : 'row',
            gap: 0.5,
          }}>
            {!collapsed && (
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'warning.contrastText', fontWeight: 600, lineHeight: 1.2, display: 'block' }}>
                  {imp.name || imp.email}
                </Typography>
                <Typography variant="caption" sx={{ color: 'warning.contrastText', opacity: 0.8, fontSize: 10 }}>
                  {imp.tenant_name} · {imp.user_type}
                </Typography>
              </Box>
            )}
            <Tooltip title="Zurück zu meinem Account" placement={collapsed ? 'right' : 'top'}>
              <IconButton size="small" onClick={() => {
                setImpersonateUser(null);
                window.location.hash = '#/';
                window.location.reload();
              }} sx={{ color: 'warning.contrastText', p: 0.25 }}>
                <LogoutIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })()}
      <List sx={{ px: collapsed ? 0.5 : 1 }}>
        {baseNavItems.filter((item) => {
          if (item.requiresHub && !hasHub) return false;
          if ((item as Record<string, unknown>).requiresLogs && !hasLogs) return false;
          return true;
        }).map((item) => {
          // Dynamic key for TalkHub → /products/talkhub/{instanceId}
          const navKey = (item as Record<string, unknown>).dynamic && talkHubInstanceId
            ? `/products/talkhub/${talkHubInstanceId}` : item.key;
          return (
          <Tooltip key={item.key} title={collapsed ? t(item.label) : ''} placement="right" arrow>
            <ListItemButton
              selected={navKey === '/' ? location.pathname === '/' : location.pathname.startsWith(navKey)}
              onClick={() => navigate(navKey)}
              sx={{
                borderRadius: 1, mb: 0.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1.5 : 2,
                '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff', '& .MuiListItemIcon-root': { color: '#fff' }, '&:hover': { bgcolor: 'primary.dark' } },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: collapsed ? 'unset' : 40, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && <ListItemText primary={t(item.label)} />}
            </ListItemButton>
          </Tooltip>
          ); })}
      </List>

      {/* Superadmin section */}
      {['manager', 'admin', 'superadmin', 'owner'].includes(getEffectiveUserType()) &&
       !getImpersonateUser() && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mx: 1 }} />
          {!collapsed && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', px: 2, py: 0.5, display: 'block' }}>
              Admin
            </Typography>
          )}
          <List sx={{ px: collapsed ? 0.5 : 1 }}>
            {[
              { key: '/admin/clients',    icon: <BusinessIcon />, label: 'admin.clients', minRole: 'manager' },
              { key: '/admin/users',      icon: <PeopleIcon />,   label: 'admin.users', minRole: 'manager' },
              { key: '/admin/licservers', icon: <StorageIcon />,  label: 'admin.licservers', minRole: 'superadmin' },
              { key: '/admin/infra',      icon: <DnsIcon />,      label: 'admin.infra', minRole: 'superadmin' },
            ].filter((item) => {
              const role = getUserFromToken()?.user_type || '';
              const hierarchy = ['user', 'manager', 'admin', 'superadmin', 'owner'];
              return hierarchy.indexOf(role) >= hierarchy.indexOf(item.minRole);
            }).map((item) => (
              <Tooltip key={item.key} title={collapsed ? t(item.label) : ''} placement="right" arrow>
                <ListItemButton
                  selected={location.pathname === item.key}
                  onClick={() => navigate(item.key)}
                  sx={{
                    borderRadius: 1, mb: 0.5,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1.5 : 2,
                    '&.Mui-selected': { bgcolor: 'error.main', color: '#fff', '& .MuiListItemIcon-root': { color: '#fff' }, '&:hover': { bgcolor: 'error.dark' } },
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
        </>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {/* Auto-logout countdown */}
      {showTimer && <LogoutCountdown collapsed={collapsed} />}

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
