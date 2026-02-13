/**
 * @file ServerCard — Server connection settings (domain, IP, ports, caller ID)
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card, CardContent, Typography, TextField, Divider, Button, Box,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import api from '../../api/client';

interface Props {
  settings: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onToast: (message: string, ok: boolean) => void;
}

export default function ServerCard({ settings, onChange, onToast }: Props) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await api.get('/health');
      if (res.data?.status === 'ok') {
        onToast(t('status.connection_ok'), true);
      } else {
        onToast(t('status.connection_failed'), false);
      }
    } catch {
      onToast(t('status.connection_failed'), false);
    }
    setTesting(false);
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ px: 4, py: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t('system.server')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('system.server_desc')}
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label={t('system.fs_domain')} value={settings.fs_domain || ''}
              onChange={(e) => onChange('fs_domain', e.target.value)}
              helperText={t('system.fs_domain_desc')} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label={t('system.external_sip_ip')} value={settings.external_sip_ip || ''}
              onChange={(e) => onChange('external_sip_ip', e.target.value)}
              helperText={t('system.external_sip_ip_desc')} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth type="number" label={t('system.internal_sip_port')} value={settings.fs_internal_port || 5060}
              onChange={(e) => onChange('fs_internal_port', parseInt(e.target.value))}
              helperText={t('system.internal_port_desc')} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth type="number" label={t('system.external_sip_port')} value={settings.fs_external_port || 5080}
              onChange={(e) => onChange('fs_external_port', parseInt(e.target.value))}
              helperText={t('system.external_port_desc')} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label={t('system.default_country')} value={settings.default_country_code || ''}
              onChange={(e) => onChange('default_country_code', e.target.value)}
              helperText={t('config.country_code_desc')} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label={t('system.outbound_caller_id')} value={settings.outbound_caller_id || ''}
              onChange={(e) => onChange('outbound_caller_id', e.target.value)}
              helperText={t('config.caller_id_desc')} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Test Connection */}
        <Box>
          <Button
            variant="outlined"
            startIcon={<NetworkCheckIcon />}
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? t('status.checking') : t('button.test_connection')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
