/**
 * @file Profile — User profile with tabs: Settings (appearance, auto-logout, password) and Billing
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button,
  TextField, Snackbar, Alert, ToggleButtonGroup, ToggleButton,
  Switch, FormControlLabel,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import SettingsIcon from '@mui/icons-material/Settings';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { loadPreferences, savePreferences } from '../store/preferences';
import type { ThemeMode, TimeFormat, DateFormat } from '../store/preferences';
import { colorThemes, type ColorTheme } from '../theme/colors';
import PageActions from '../components/PageActions';
import { TabView } from '../components/TabView';
import type { TabItemConfig } from '../components/TabView';
import BillingTab from './BillingTab';
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
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
}

function makeSnapshot(): PrefsSnapshot {
  const p = loadPreferences();
  return {
    themeMode: p.themeMode,
    colorTheme: p.colorTheme,
    language: p.language,
    autoLogout: p.autoLogout,
    autoLogoutTimeout: p.autoLogoutTimeout,
    timeFormat: p.timeFormat,
    dateFormat: p.dateFormat,
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
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

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

  const handleConfirmSave = async () => {
    const a = confirmSave.action;
    setConfirmSave({ open: false, action: null });
    if (a) await a();
  };

  // Settings tab content (existing profile content)
  const settingsContent = (
    <Box>
      {/* Appearance */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
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

          {/* Time Format */}
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>{t('profile.time_format')}</Typography>
          <ToggleButtonGroup value={local.timeFormat} exclusive onChange={(_, v) => v && updateLocal({ timeFormat: v as TimeFormat })}>
            <ToggleButton value="24h">24H (14:30)</ToggleButton>
            <ToggleButton value="12h">12H (2:30 PM)</ToggleButton>
          </ToggleButtonGroup>

          {/* Date Format */}
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>{t('profile.date_format')}</Typography>
          <ToggleButtonGroup value={local.dateFormat} exclusive onChange={(_, v) => v && updateLocal({ dateFormat: v as DateFormat })}>
            <ToggleButton value="DD.MM.YYYY">DD.MM.YYYY</ToggleButton>
            <ToggleButton value="MM/DD/YYYY">MM/DD/YYYY</ToggleButton>
            <ToggleButton value="YYYY-MM-DD">YYYY-MM-DD</ToggleButton>
          </ToggleButtonGroup>
        </CardContent>
      </Card>

      {/* Auto-Logout */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
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
        <CardContent sx={{ px: 4, py: 3 }}>
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
    </Box>
  );

  const tabs: TabItemConfig[] = [
    { id: 'settings', label: t('profile.settings'), icon: <SettingsIcon />, content: settingsContent },
    { id: 'billing',  label: t('nav.billing'),      icon: <ReceiptLongIcon />, content: <BillingTab /> },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.profile')}</Typography>
      <TabView tabs={tabs} storageKey="sip-wrapper-tab-order-profile" sortable />

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
