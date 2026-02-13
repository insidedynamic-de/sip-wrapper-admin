/**
 * @file Profile — User profile, appearance, system settings, import/export
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, Grid, Divider,
  TextField, Snackbar, Alert, ToggleButtonGroup, ToggleButton,
  Switch, FormControlLabel,
} from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import SyncIcon from '@mui/icons-material/Sync';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { loadPreferences, savePreferences } from '../store/preferences';
import type { ThemeMode } from '../store/preferences';
import { colorThemes, type ColorTheme } from '../theme/colors';
import PageActions from '../components/PageActions';
import i18n from '../i18n';

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (v: ColorTheme) => void;
}

interface PrefsSnapshot {
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  language: string;
  autoLogout: boolean;
  autoLogoutTimeout: number;
}

function makeSnapshot(): PrefsSnapshot {
  const p = loadPreferences();
  return {
    themeMode: p.themeMode,
    colorTheme: p.colorTheme,
    language: p.language,
    autoLogout: p.autoLogout,
    autoLogoutTimeout: p.autoLogoutTimeout,
  };
}

export default function Profile({ themeMode, setThemeMode, colorTheme, setColorTheme }: Props) {
  const { t } = useTranslation();

  // Snapshot & local buffered state for preferences
  const [snapshot, setSnapshot] = useState<PrefsSnapshot>(makeSnapshot);
  const [local, setLocal] = useState<PrefsSnapshot>(() => ({ ...snapshot }));

  const dirty = JSON.stringify(local) !== JSON.stringify(snapshot);

  // Password (API-based)
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  // System settings (API-based)
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  // Load system settings on mount
  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data || {});
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  // --- Preference changes (buffered, visual preview) ---
  const updateLocal = (patch: Partial<PrefsSnapshot>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    // Immediate visual preview
    if (patch.themeMode !== undefined) setThemeMode(patch.themeMode);
    if (patch.colorTheme !== undefined) setColorTheme(patch.colorTheme);
    if (patch.language !== undefined) i18n.changeLanguage(patch.language);
  };

  const handleSavePrefs = useCallback(() => {
    savePreferences(local);
    setSnapshot({ ...local });
    showToast(t('status.success'), true);
  }, [local, t]);

  const handleCancelPrefs = useCallback(() => {
    setLocal({ ...snapshot });
    // Revert visual state
    setThemeMode(snapshot.themeMode);
    setColorTheme(snapshot.colorTheme);
    i18n.changeLanguage(snapshot.language);
  }, [snapshot, setThemeMode, setColorTheme]);

  // Navigation guard handled by PageActions

  // --- Password (API-based) ---
  const doChangePassword = async () => {
    if (pw.newPw !== pw.confirm) {
      showToast(t('profile.passwords_not_match'), false);
      return;
    }
    try {
      const res = await api.put('/profile/password', { current_password: pw.current, new_password: pw.newPw });
      showToast(res.data?.message || t('status.success'), res.data?.success);
      if (res.data?.success) setPw({ current: '', newPw: '', confirm: '' });
    } catch { showToast(t('status.error'), false); }
  };
  const changePassword = () => setConfirmSave({ open: true, action: doChangePassword });

  // --- System settings (API-based) ---
  const s = (key: string, val: unknown) => setSettings({ ...settings, [key]: val });

  const doSaveSettings = async () => {
    try {
      await api.put('/settings', settings);
      showToast(t('status.success'), true);
    } catch { showToast(t('status.error'), false); }
  };
  const saveSettings = () => setConfirmSave({ open: true, action: doSaveSettings });

  const doApplyConfig = async () => {
    try {
      const res = await api.post('/config/apply');
      showToast(res.data?.message || t('status.success'), res.data?.success);
    } catch { showToast(t('status.error'), false); }
  };
  const applyConfig = () => setConfirmSave({ open: true, action: doApplyConfig });

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
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.profile')}</Typography>

      {/* Appearance */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('profile.appearance')}</Typography>

          {/* Theme Mode */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('profile.theme_mode')}</Typography>
          <ToggleButtonGroup value={local.themeMode} exclusive onChange={(_, v) => v && updateLocal({ themeMode: v as ThemeMode })} sx={{ mb: 3 }}>
            <ToggleButton value="light"><LightModeIcon sx={{ mr: 1 }} />{t('theme.light')}</ToggleButton>
            <ToggleButton value="dark"><DarkModeIcon sx={{ mr: 1 }} />{t('theme.dark')}</ToggleButton>
            <ToggleButton value="auto"><BrightnessAutoIcon sx={{ mr: 1 }} />{t('theme.auto')}</ToggleButton>
          </ToggleButtonGroup>

          {/* Color Theme */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('profile.color_theme')}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(Object.entries(colorThemes) as [ColorTheme, typeof colorThemes.default][]).map(([key, val]) => (
              <Box
                key={key}
                onClick={() => updateLocal({ colorTheme: key })}
                sx={{
                  cursor: 'pointer', p: 1.5, borderRadius: 2,
                  border: local.colorTheme === key ? `2px solid ${val.main}` : '2px solid transparent',
                  bgcolor: local.colorTheme === key ? `${val.main}10` : 'transparent',
                  textAlign: 'center', minWidth: 80,
                }}
              >
                <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: val.main, mx: 'auto', mb: 0.5 }} />
                <Typography variant="caption">{t(`theme.${key}`)}</Typography>
              </Box>
            ))}
          </Box>

          {/* Language */}
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>{t('language.language')}</Typography>
          <ToggleButtonGroup value={local.language} exclusive onChange={(_, v) => v && updateLocal({ language: v })}>
            <ToggleButton value="en">{t('language.english')}</ToggleButton>
            <ToggleButton value="de">{t('language.german')}</ToggleButton>
          </ToggleButtonGroup>
        </CardContent>
      </Card>

      {/* Auto-Logout */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('profile.auto_logout')}</Typography>
          <FormControlLabel
            control={<Switch checked={local.autoLogout} onChange={(e) => updateLocal({ autoLogout: e.target.checked })} />}
            label={t('profile.auto_logout_enabled')}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('profile.auto_logout_desc')}
          </Typography>
          {local.autoLogout && (
            <TextField
              type="number"
              label={t('profile.auto_logout_timeout')}
              value={local.autoLogoutTimeout}
              onChange={(e) => updateLocal({ autoLogoutTimeout: Math.max(30, Number(e.target.value)) })}
              inputProps={{ min: 30, step: 30 }}
              sx={{ width: 200 }}
              size="small"
            />
          )}
        </CardContent>
      </Card>

      {/* Save / Cancel for preferences */}
      <PageActions dirty={dirty} onSave={handleSavePrefs} onCancel={handleCancelPrefs} />

      {/* Password */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('profile.change_password')}</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth type="password" label={t('profile.current_password')} value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth type="password" label={t('profile.new_password')} value={pw.newPw}
                onChange={(e) => setPw({ ...pw, newPw: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth type="password" label={t('profile.confirm_password')} value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Grid>
          </Grid>
          <Button variant="contained" sx={{ mt: 2 }} onClick={changePassword}>{t('button.save')}</Button>
        </CardContent>
      </Card>

      <Divider sx={{ my: 4 }} />
      <Typography variant="h5" sx={{ mb: 3 }}>{t('system.system_settings')}</Typography>

      {/* System Settings */}
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
            <Button variant="contained" startIcon={<SaveIcon />} onClick={saveSettings}>{t('system.save_settings')}</Button>
          </Box>
        </CardContent>
      </Card>

      {/* Apply Changes */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('config.apply_changes')}</Typography>
          <Button variant="contained" color="warning" startIcon={<SyncIcon />} onClick={applyConfig}>
            {t('button.apply_reload')}
          </Button>
        </CardContent>
      </Card>

      {/* Import / Export */}
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
