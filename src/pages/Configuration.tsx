/**
 * @file Configuration — Unified page for Extensions, Users, and Gateways
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import DialpadIcon from '@mui/icons-material/Dialpad';
import PeopleIcon from '@mui/icons-material/People';
import RouterIcon from '@mui/icons-material/Router';
import { TabView } from '../components/TabView';
import type { TabItemConfig } from '../components/TabView';
import Extensions from './Extensions';
import Users from './Users';
import Gateways from './Gateways';

export default function Configuration() {
  const { t } = useTranslation();

  const tabs: TabItemConfig[] = [
    { id: 'extensions', label: t('extension.extensions'), icon: <DialpadIcon />, content: <Extensions /> },
    { id: 'users',      label: t('section.users'),       icon: <PeopleIcon />,  content: <Users /> },
    { id: 'gateways',   label: t('section.gateways'),    icon: <RouterIcon />,  content: <Gateways /> },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.config')}</Typography>
      <TabView tabs={tabs} storageKey="sip-wrapper-tab-order-config" sortable />
    </Box>
  );
}
