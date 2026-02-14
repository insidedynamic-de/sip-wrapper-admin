/**
 * @file Configuration — Unified page for Users, Gateways, Security, Settings, and License
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import RouterIcon from '@mui/icons-material/Router';
import ShieldIcon from '@mui/icons-material/Shield';
import SettingsIcon from '@mui/icons-material/Settings';
import BadgeIcon from '@mui/icons-material/Badge';
import ViewListIcon from '@mui/icons-material/ViewList';
import { TabView } from '../components/TabView';
import type { TabItemConfig } from '../components/TabView';
import Users from './Users';
import Gateways from './Gateways';
import Security from './Security';
import SystemSettings from './SystemSettings';
import LicenseTab from './LicenseTab';
import AllLicensesTab from './AllLicensesTab';

export default function Configuration() {
  const { t } = useTranslation();

  const tabs: TabItemConfig[] = [
    { id: 'users',    label: t('section.users'),    icon: <PeopleIcon />,  content: <Users /> },
    { id: 'gateways', label: t('section.gateways'), icon: <RouterIcon />,  content: <Gateways /> },
    { id: 'security', label: t('nav.security'),     icon: <ShieldIcon />,  content: <Security /> },
    { id: 'settings', label: t('section.settings'), icon: <SettingsIcon />, content: <SystemSettings /> },
    { id: 'license',  label: t('license.license'),  icon: <BadgeIcon />,   content: <LicenseTab /> },
    { id: 'all-licenses', label: t('license.all_licenses'), icon: <ViewListIcon />, content: <AllLicensesTab /> },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.config')}</Typography>
      <TabView tabs={tabs} storageKey="sip-wrapper-tab-order-config" sortable />
    </Box>
  );
}
