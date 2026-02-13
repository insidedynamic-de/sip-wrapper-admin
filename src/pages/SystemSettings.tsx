/**
 * @file SystemSettings — Orchestrator for server settings, codecs, and config import/export
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Snackbar, Alert } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { ServerCard, CodecCard, ImportExportCard } from '../components/settings';

export default function SystemSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState(false);

  const showToast = (msg: string, ok: boolean) =>
    setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data || {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const onChange = (key: string, val: unknown) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  const doSave = async () => {
    setConfirmSave(false);
    try {
      await api.put('/settings', settings);
      await api.post('/config/apply');
      showToast(t('status.success'), true);
    } catch {
      showToast(t('status.error'), false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={() => setConfirmSave(true)}>
          {t('button.save_reload')}
        </Button>
      </Box>

      <ServerCard settings={settings} onChange={onChange} onToast={showToast} />
      <CodecCard
        codecPrefs={String(settings.codec_prefs || '')}
        onChange={(val) => onChange('codec_prefs', val)}
      />
      <ImportExportCard onToast={showToast} onReload={loadSettings} />

      <ConfirmDialog open={confirmSave} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={doSave} onCancel={() => setConfirmSave(false)} />

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
