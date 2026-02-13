/**
 * @file Sidebar — Navigation sidebar with dark/light mode toggle
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, Box, IconButton, Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TuneIcon from '@mui/icons-material/Tune';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import TerminalIcon from '@mui/icons-material/Terminal';
import SettingsIcon from '@mui/icons-material/Settings';
import BadgeIcon from '@mui/icons-material/Badge';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LogoutIcon from '@mui/icons-material/Logout';
import { savePreferences } from '../../store/preferences';
import type { ThemeMode } from '../../store/preferences';
import { clearApiKey } from '../../store/keyStore';
import api from '../../api/client';
import LogoutCountdown from '../LogoutCountdown';

const DRAWER_WIDTH = 240;

const navItems = [
  { key: '/',              icon: <DashboardIcon />, label: 'nav.dashboard' },
  { key: '/configuration', icon: <TuneIcon />,      label: 'nav.config' },
  { key: '/routes',        icon: <AltRouteIcon />,  label: 'section.routes' },
  { key: '/logs',          icon: <TerminalIcon />,  label: 'nav.logs' },
  { key: '/license',       icon: <BadgeIcon />,     label: 'nav.license_billing' },
  { key: '/profile',       icon: <SettingsIcon />,  label: 'nav.profile' },
];

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
}

const modeOrder: ThemeMode[] = ['light', 'dark', 'auto'];

export default function Sidebar({ themeMode, setThemeMode }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

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

  const themeModeIcon = themeMode === 'dark' ? <LightModeIcon /> : themeMode === 'auto' ? <BrightnessAutoIcon /> : <DarkModeIcon />;
  const themeModeLabel = themeMode === 'dark' ? t('theme.light') : themeMode === 'auto' ? t('theme.light') : t('theme.dark');

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap sx={{ color: '#fff', fontWeight: 700 }}>
          SIP Wrapper
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ px: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.key}
            selected={location.pathname === item.key}
            onClick={() => navigate(item.key)}
            sx={{
              borderRadius: 1, mb: 0.5,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: '#fff',
                '& .MuiListItemIcon-root': { color: '#fff' },
                '&:hover': { bgcolor: 'primary.dark' },
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={t(item.label)} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />

      {/* Auto-logout countdown */}
      <LogoutCountdown />

      {/* Theme mode toggle + Logout */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, pb: 1 }}>
        <Tooltip title={themeModeLabel}>
          <IconButton
            onClick={cycleThemeMode}
            sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}
          >
            {themeModeIcon}
          </IconButton>
        </Tooltip>
        <Tooltip title={t('auth.logout')}>
          <IconButton
            onClick={handleLogout}
            sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'error.main' } }}
          >
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <Box sx={{ p: 1.5, color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' }}>
        v2.0.0
      </Box>
    </Drawer>
  );
}
