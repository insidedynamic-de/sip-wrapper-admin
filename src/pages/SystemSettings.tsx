/**
 * @file SystemSettings — Server settings, codec preferences, config import/export
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, Grid,
  TextField, Snackbar, Alert, Checkbox, FormControlLabel, Chip, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';

/** Audio codecs available in FreeSWITCH */
const AUDIO_CODECS = [
  { id: 'OPUS', label: 'OPUS', desc: '48 kHz, wideband' },
  { id: 'G722', label: 'G.722', desc: '16 kHz, wideband' },
  { id: 'PCMU', label: 'PCMU (G.711u)', desc: '8 kHz, North America' },
  { id: 'PCMA', label: 'PCMA (G.711a)', desc: '8 kHz, Europe' },
  { id: 'G729', label: 'G.729', desc: '8 kHz, compressed' },
  { id: 'GSM', label: 'GSM', desc: '8 kHz, mobile' },
  { id: 'G726-32', label: 'G.726-32', desc: '8 kHz, 32 kbit/s' },
  { id: 'iLBC', label: 'iLBC', desc: '8 kHz, packet loss tolerant' },
  { id: 'SILK', label: 'SILK', desc: 'Variable rate, Skype' },
];

/** Video codecs available in FreeSWITCH */
const VIDEO_CODECS = [
  { id: 'VP8', label: 'VP8', desc: 'Video codec' },
  { id: 'H264', label: 'H.264', desc: 'Video codec' },
  { id: 'H263', label: 'H.263', desc: 'Video codec (legacy)' },
];

/** All codecs combined (order matters for preference string) */
const FS_CODECS = [...AUDIO_CODECS, ...VIDEO_CODECS];

export default function SystemSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });

  const [testing, setTesting] = useState(false);

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data || {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const s = (key: string, val: unknown) => setSettings({ ...settings, [key]: val });

  // Parse codec_prefs string to set, and toggle individual codecs
  const codecStr = String(settings.codec_prefs || '');
  const activeCodecs = new Set(codecStr.split(',').map((c) => c.trim()).filter(Boolean));

  const toggleCodec = (codecId: string) => {
    const next = new Set(activeCodecs);
    if (next.has(codecId)) {
      next.delete(codecId);
    } else {
      next.add(codecId);
    }
    // Maintain order based on FS_CODECS list
    const ordered = FS_CODECS.filter((c) => next.has(c.id)).map((c) => c.id);
    s('codec_prefs', ordered.join(','));
  };

  const doSaveSettings = async () => {
    try {
      await api.put('/settings', settings);
      await api.post('/config/apply');
      showToast(t('status.success'), true);
    } catch { showToast(t('status.error'), false); }
  };
  const saveSettings = () => setConfirmSave({ open: true, action: doSaveSettings });

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await api.get('/health');
      if (res.data?.status === 'ok') {
        showToast(t('status.connection_ok'), true);
      } else {
        showToast(t('status.connection_failed'), false);
      }
    } catch {
      showToast(t('status.connection_failed'), false);
    }
    setTesting(false);
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
      showToast(res.data?.message || t('status.success'), res.data?.success);
      loadSettings();
    } catch { showToast(t('status.error'), false); }
    e.target.value = '';
  };

  const handleConfirmSave = async () => {
    const a = confirmSave.action;
    setConfirmSave({ open: false, action: null });
    if (a) await a();
  };

  return (
    <Box>
      {/* Save button — top right of section */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={saveSettings}>{t('button.save_reload')}</Button>
      </Box>

      {/* Server Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('system.server')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('system.server_desc')}
          </Typography>

          {/* Domain & IP */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>{t('system.domain_ip')}</Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('system.fs_domain')} value={settings.fs_domain || ''}
                onChange={(e) => s('fs_domain', e.target.value)}
                helperText={t('system.fs_domain_desc')} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('system.external_sip_ip')} value={settings.external_sip_ip || ''}
                onChange={(e) => s('external_sip_ip', e.target.value)}
                helperText={t('system.external_sip_ip_desc')} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Ports */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>{t('system.ports')}</Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth type="number" label={t('system.internal_sip_port')} value={settings.fs_internal_port || 5060}
                onChange={(e) => s('fs_internal_port', parseInt(e.target.value))}
                helperText={t('system.internal_port_desc')} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth type="number" label={t('system.external_sip_port')} value={settings.fs_external_port || 5080}
                onChange={(e) => s('fs_external_port', parseInt(e.target.value))}
                helperText={t('system.external_port_desc')} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Country Code & Caller ID */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>{t('system.country_caller')}</Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('system.default_country')} value={settings.default_country_code || ''}
                onChange={(e) => s('default_country_code', e.target.value)}
                helperText={t('config.country_code_desc')} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('system.outbound_caller_id')} value={settings.outbound_caller_id || ''}
                onChange={(e) => s('outbound_caller_id', e.target.value)}
                helperText={t('config.caller_id_desc')} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Test Connection */}
          <Button
            variant="outlined"
            startIcon={<NetworkCheckIcon />}
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? t('status.checking') : t('button.test_connection')}
          </Button>
        </CardContent>
      </Card>

      {/* Codec Preferences */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('system.codec_prefs')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('system.codec_prefs_desc')}
          </Typography>

          {/* Active codecs as ordered chips */}
          {activeCodecs.size > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
              {FS_CODECS.filter((c) => activeCodecs.has(c.id)).map((c, idx) => (
                <Chip key={c.id} label={`${idx + 1}. ${c.label}`} size="small" color="primary" variant="outlined" />
              ))}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Audio codecs */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Audio</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: '1fr 1fr 1fr 1fr' }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {AUDIO_CODECS.map((codec, idx) => (
              <Box key={codec.id} sx={{ px: 1.5, py: 1, borderRight: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox
                      checked={activeCodecs.has(codec.id)}
                      onChange={() => toggleCodec(codec.id)}
                      size="small"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{codec.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{codec.desc}</Typography>
                    </Box>
                  }
                />
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Video codecs */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Video</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: '1fr 1fr 1fr 1fr' }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {VIDEO_CODECS.map((codec) => (
              <Box key={codec.id} sx={{ px: 1.5, py: 1, borderRight: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox
                      checked={activeCodecs.has(codec.id)}
                      onChange={() => toggleCodec(codec.id)}
                      size="small"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{codec.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{codec.desc}</Typography>
                    </Box>
                  }
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Import / Export */}
      <Card>
        <CardContent sx={{ px: 4, py: 3 }}>
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

      <ConfirmDialog open={confirmSave.open} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmSave} onCancel={() => setConfirmSave({ open: false, action: null })} />

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
