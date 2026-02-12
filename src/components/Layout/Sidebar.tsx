import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, Box,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import RouterIcon from '@mui/icons-material/Router';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import ShieldIcon from '@mui/icons-material/Shield';
import TerminalIcon from '@mui/icons-material/Terminal';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';

const DRAWER_WIDTH = 240;

const navItems = [
  { key: '/',          icon: <DashboardIcon />, label: 'nav.dashboard' },
  { key: '/users',     icon: <PeopleIcon />,    label: 'section.users' },
  { key: '/gateways',  icon: <RouterIcon />,    label: 'section.gateways' },
  { key: '/routes',    icon: <AltRouteIcon />,  label: 'section.routes' },
  { key: '/security',  icon: <ShieldIcon />,    label: 'nav.security' },
  { key: '/logs',      icon: <TerminalIcon />,  label: 'nav.logs' },
  { key: '/settings',  icon: <SettingsIcon />,  label: 'section.settings' },
  { key: '/profile',   icon: <PersonIcon />,    label: 'nav.profile' },
];

export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

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
      <Box sx={{ p: 2, color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' }}>
        v2.0.0
      </Box>
    </Drawer>
  );
}
