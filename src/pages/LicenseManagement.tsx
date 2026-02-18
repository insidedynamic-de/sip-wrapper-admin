/**
 * @file LicenseManagement — Unified license management page with tabs
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { TabView } from '../components/TabView';
import type { TabItemConfig } from '../components/TabView';
import AllLicensesTab from './AllLicensesTab';
import LicenseTab from './LicenseTab';

export default function LicenseManagement() {
  const { t } = useTranslation();

  const tabs: TabItemConfig[] = [
    { id: 'overview',      label: t('license.overview'),      icon: <ListAltIcon />,  content: <AllLicensesTab /> },
    { id: 'server-license', label: t('license.server_license'), icon: <VpnKeyIcon />,   content: <LicenseTab /> },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('license.management_title')}</Typography>
      <TabView tabs={tabs} storageKey="sip-wrapper-tab-order-licenses" sortable />
    </Box>
  );
}
