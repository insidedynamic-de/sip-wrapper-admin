/**
 * @file Configuration — Unified page for Users, Gateways, Routes, Security, Settings, Logs, Integrations
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import RouterIcon from '@mui/icons-material/Router';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import ShieldIcon from '@mui/icons-material/Shield';
import SettingsIcon from '@mui/icons-material/Settings';
import TerminalIcon from '@mui/icons-material/Terminal';
import ExtensionIcon from '@mui/icons-material/Extension';
import { TabView } from '../components/TabView';
import type { TabItemConfig } from '../components/TabView';
import { getEffectiveUserType } from '../store/auth';
import Dashboard from './Dashboard';
import Users from './Users';
import Gateways from './Gateways';
import RoutesPage from './Routes';
import Security from './Security';
import SystemSettings from './SystemSettings';
import Logs from './Logs';
import TalkHubIntegrations from './TalkHubIntegrations';

const ADMIN_ROLES = ['manager', 'admin', 'superadmin', 'owner'];

export default function Configuration() {
  const { t } = useTranslation();
  const role = getEffectiveUserType();
  const isAdmin = ADMIN_ROLES.includes(role);
  const tabs: TabItemConfig[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: <DashboardIcon />, content: <Dashboard /> },
    { id: 'users',    label: t('section.users'),    icon: <PeopleIcon />,   content: <Users /> },
    { id: 'gateways', label: t('section.gateways'), icon: <RouterIcon />,   content: <Gateways /> },
    { id: 'routes',   label: t('section.routes'),   icon: <AltRouteIcon />, content: <RoutesPage /> },
    { id: 'security', label: t('nav.security'),     icon: <ShieldIcon />,   content: <Security /> },
    { id: 'settings', label: t('section.settings'), icon: <SettingsIcon />, content: <SystemSettings /> },
    { id: 'integrations', label: t('nav.integrations'), icon: <ExtensionIcon />, content: <TalkHubIntegrations /> },
    ...(isAdmin ? [
      { id: 'logs', label: t('nav.logs'), icon: <TerminalIcon />, content: <Logs /> },
    ] : []),
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.config')}</Typography>
      <TabView tabs={tabs} storageKey="linkify-tab-order-config" sortable />
    </Box>
  );
}
