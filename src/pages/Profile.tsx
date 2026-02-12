import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, Grid,
  TextField, Snackbar, Alert, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';
import { savePreferences, loadPreferences } from '../store/preferences';
import { colorThemes, type ColorTheme } from '../theme/colors';
import i18n from '../i18n';

interface Props {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  colorTheme: ColorTheme;
  setColorTheme: (v: ColorTheme) => void;
}

export default function Profile({ darkMode, setDarkMode, colorTheme, setColorTheme }: Props) {
  const { t } = useTranslation();
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  const [company, setCompany] = useState({ company_name: '', company_email: '', company_phone: '', company_address: '' });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  const changePassword = async () => {
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

  const saveCompany = async () => {
    try {
      await api.put('/profile/company', company);
      showToast(t('status.success'), true);
    } catch { showToast(t('status.error'), false); }
  };

  const handleDarkMode = (v: boolean) => {
    setDarkMode(v);
    savePreferences({ darkMode: v });
  };

  const handleColor = (c: ColorTheme) => {
    setColorTheme(c);
    savePreferences({ colorTheme: c });
  };

  const handleLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
    savePreferences({ language: lng });
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
          <ToggleButtonGroup value={darkMode ? 'dark' : 'light'} exclusive onChange={(_, v) => v && handleDarkMode(v === 'dark')} sx={{ mb: 3 }}>
            <ToggleButton value="light"><LightModeIcon sx={{ mr: 1 }} />{t('theme.light')}</ToggleButton>
            <ToggleButton value="dark"><DarkModeIcon sx={{ mr: 1 }} />{t('theme.dark')}</ToggleButton>
          </ToggleButtonGroup>

          {/* Color Theme */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('profile.color_theme')}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(Object.entries(colorThemes) as [ColorTheme, typeof colorThemes.default][]).map(([key, val]) => (
              <Box
                key={key}
                onClick={() => handleColor(key)}
                sx={{
                  cursor: 'pointer', p: 1.5, borderRadius: 2,
                  border: colorTheme === key ? `2px solid ${val.main}` : '2px solid transparent',
                  bgcolor: colorTheme === key ? `${val.main}10` : 'transparent',
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
          <ToggleButtonGroup value={i18n.language} exclusive onChange={(_, v) => v && handleLanguage(v)}>
            <ToggleButton value="en">{t('language.english')}</ToggleButton>
            <ToggleButton value="de">{t('language.german')}</ToggleButton>
          </ToggleButtonGroup>
        </CardContent>
      </Card>

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

      {/* Company Info */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('company.company_info')}</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label={t('company.company_name')} value={company.company_name}
                onChange={(e) => setCompany({ ...company, company_name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Email" value={company.company_email}
                onChange={(e) => setCompany({ ...company, company_email: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label={t('company.address')} value={company.company_address}
                onChange={(e) => setCompany({ ...company, company_address: e.target.value })} />
            </Grid>
          </Grid>
          <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 2 }} onClick={saveCompany}>{t('button.save')}</Button>
        </CardContent>
      </Card>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
