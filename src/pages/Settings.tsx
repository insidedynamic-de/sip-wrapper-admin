import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, Grid,
  TextField, Snackbar, Alert, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import SyncIcon from '@mui/icons-material/Sync';
import api from '../api/client';

export default function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = useCallback(async () => {
    const res = await api.get('/settings');
    setSettings(res.data || {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await api.put('/settings', settings);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const applyConfig = async () => {
    try {
      const res = await api.post('/config/apply');
      setToast({ open: true, message: res.data?.message || t('status.success'), severity: res.data?.success ? 'success' : 'error' });
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const exportConfig = async () => {
    const res = await api.get('/config/export');
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sip_wrapper_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/config/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setToast({ open: true, message: res.data?.message || t('status.success'), severity: res.data?.success ? 'success' : 'error' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
    e.target.value = '';
  };

  const s = (key: string, val: unknown) => setSettings({ ...settings, [key]: val });

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('system.system_settings')}</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('system.server')}</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('system.fs_domain')} value={settings.fs_domain || ''}
                onChange={(e) => s('fs_domain', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('system.external_sip_ip')} value={settings.external_sip_ip || ''}
                onChange={(e) => s('external_sip_ip', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth type="number" label={t('system.internal_sip_port')} value={settings.fs_internal_port || 5060}
                onChange={(e) => s('fs_internal_port', parseInt(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth type="number" label={t('system.external_sip_port')} value={settings.fs_external_port || 5080}
                onChange={(e) => s('fs_external_port', parseInt(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label={t('system.codec_prefs')} value={settings.codec_prefs || ''}
                onChange={(e) => s('codec_prefs', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label={t('system.default_country')} value={settings.default_country_code || ''}
                onChange={(e) => s('default_country_code', e.target.value)}
                helperText={t('config.country_code_desc')} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label={t('system.outbound_caller_id')} value={settings.outbound_caller_id || ''}
                onChange={(e) => s('outbound_caller_id', e.target.value)} />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={save}>{t('system.save_settings')}</Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('config.apply_changes')}</Typography>
          <Button variant="contained" color="warning" startIcon={<SyncIcon />} onClick={applyConfig}>
            {t('button.apply_reload')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('config.import_export')}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportConfig}>
              {t('config.export_json')}
            </Button>
            <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
              {t('config.import_json')}
              <input type="file" hidden accept=".json" onChange={importConfig} />
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
