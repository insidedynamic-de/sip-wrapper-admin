/**
 * @file TalkHubIntegrations — Integration sub-tabs inside TalkHub Configuration
 * Shows available integrations based on license features.
 */
import { useTranslation } from 'react-i18next';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { useState, lazy, Suspense } from 'react';
import VapiIntegration from './VapiIntegration';

const CallWidgets = lazy(() => import('./CallWidgets'));

export default function TalkHubIntegrations() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  // TODO: check license features to show/hide tabs
  // const hasVapi = licenseFeatures.includes('vapi');
  // const hasCallWidget = licenseFeatures.includes('talkhub_callwidget');

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{t('nav.integrations')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="VAPI.ai" />
        <Tab label="CallWidgets" />
      </Tabs>

      {tab === 0 && <VapiIntegration />}
      {tab === 1 && <Suspense fallback={<Box sx={{ p: 2 }}>Loading...</Box>}><CallWidgets /></Suspense>}
    </Box>
  );
}
