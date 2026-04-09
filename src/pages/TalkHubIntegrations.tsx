/**
 * @file TalkHubIntegrations — Integration sub-tabs inside TalkHub Configuration
 * Shows available integrations based on license features.
 */
import { useTranslation } from 'react-i18next';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { useState } from 'react';
import VapiIntegration from './VapiIntegration';

export default function TalkHubIntegrations() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{t('nav.integrations')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="VAPI.ai" />
      </Tabs>

      {tab === 0 && <VapiIntegration />}
    </Box>
  );
}
