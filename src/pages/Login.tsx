/**
 * @file Login — JWT auth: email + password + MFA
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useRef, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  IconButton, ToggleButtonGroup, ToggleButton, Link,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import api from '../api/client';
import { loadPreferences, savePreferences } from '../store/preferences';
import type { ThemeMode } from '../store/preferences';
import { colorThemes, type ColorTheme } from '../theme/colors';
import FormDialog from '../components/FormDialog';
import Toast from '../components/Toast';
import { setTokens } from '../store/auth';
import i18n from '../i18n';

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (v: ColorTheme) => void;
}

type LoginStep = 'credentials' | 'mfa' | 'mfa_setup';

export default function Login({ themeMode, setThemeMode, colorTheme, setColorTheme }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [step, setStep] = useState<LoginStep>('credentials');
  const [tempToken, setTempToken] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const snapshot = useRef({ themeMode, colorTheme, language: i18n.language });
  const settingsDirty =
    themeMode !== snapshot.current.themeMode ||
    colorTheme !== snapshot.current.colorTheme ||
    i18n.language !== snapshot.current.language;

  const openSettings = () => {
    snapshot.current = { themeMode, colorTheme, language: i18n.language };
    setSettingsOpen(true);
  };
  const handleSaveSettings = () => {
    savePreferences({ themeMode, colorTheme, language: i18n.language });
    localStorage.setItem('language', i18n.language);
    setSettingsOpen(false);
  };
  const handleCancelSettings = () => {
    setThemeMode(snapshot.current.themeMode);
    setColorTheme(snapshot.current.colorTheme);
    i18n.changeLanguage(snapshot.current.language);
    setSettingsOpen(false);
  };

  // ── Login flow ──
  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        mfa_code: mfaCode || undefined,
        captcha_token: '', // Turnstile will be added later
      });

      const data = res.data;

      if (data.mfa_required) {
        // Step 2: enter MFA code
        setStep('mfa');
        setLoading(false);
        return;
      }

      if (data.mfa_setup_required) {
        // Step 2b: setup MFA first (NIS2)
        setTempToken(data.access_token);
        setStep('mfa_setup');
        // Fetch QR code
        const setupRes = await api.post('/auth/mfa/setup', {}, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        setQrCode(setupRes.data.qr_code);
        setMfaSecret(setupRes.data.secret);
        setLoading(false);
        return;
      }

      // Success — save tokens and navigate
      setTokens(data.access_token, data.refresh_token);
      setToast({ open: true, message: t('status.connection_ok'), severity: 'success' });
      setTimeout(() => navigate('/'), 600);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosErr?.response?.status;
      const detail = axiosErr?.response?.data?.detail;

      if (status === 401) setError(t('auth.invalid_credentials'));
      else if (status === 423) setError(t('auth.account_locked'));
      else if (status === 400) setError(detail || t('auth.captcha_failed'));
      else setError(detail || t('status.error'));
    }
    setLoading(false);
  };

  // ── MFA verify (for existing MFA users) ──
  const handleMfaLogin = async () => {
    if (!mfaCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', {
        email, password, mfa_code: mfaCode, captcha_token: '',
      });
      setTokens(res.data.access_token, res.data.refresh_token);
      setToast({ open: true, message: t('status.connection_ok'), severity: 'success' });
      setTimeout(() => navigate('/'), 600);
    } catch {
      setError(t('auth.invalid_credentials'));
    }
    setLoading(false);
  };

  // ── MFA setup verify (first time) ──
  const handleMfaSetupVerify = async () => {
    if (!mfaCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/mfa/verify', { code: mfaCode }, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      // MFA activated — login directly with same code
      const res = await api.post('/auth/login', {
        email, password, mfa_code: mfaCode, captcha_token: '',
      });
      setTokens(res.data.access_token, res.data.refresh_token);
      setToast({ open: true, message: 'MFA activated!', severity: 'success' });
      setTimeout(() => navigate('/'), 600);
    } catch {
      setError(t('auth.invalid_credentials'));
    }
    setLoading(false);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Card sx={{ width: 420, p: 2 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
            Linkify
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Step 1: Email + Password */}
          {step === 'credentials' && (
            <>
              <TextField
                fullWidth label={t('auth.email')} type="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }} size="small" autoFocus
              />
              <TextField
                fullWidth label={t('auth.password')} type="password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                sx={{ mb: 2 }} size="small"
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" onClick={handleLogin} disabled={loading} sx={{ flex: '0 0 80%' }}>
                  {t('auth.login')}
                </Button>
                <IconButton onClick={openSettings} sx={{ flex: '0 0 calc(20% - 8px)', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <SettingsIcon />
                </IconButton>
              </Box>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('auth.no_account')}{' '}
                  <Link component={RouterLink} to="/register">{t('auth.register')}</Link>
                </Typography>
              </Box>
            </>
          )}

          {/* Step 2: MFA code */}
          {step === 'mfa' && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>{t('auth.mfa_required')}</Alert>
              <TextField
                fullWidth label={t('auth.mfa_code')} value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMfaLogin()}
                sx={{ mb: 2 }} size="small" autoFocus
                inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
              />
              <Button variant="contained" fullWidth onClick={handleMfaLogin} disabled={loading}>
                {t('auth.mfa_verify')}
              </Button>
            </>
          )}

          {/* Step 2b: MFA setup (first time, NIS2) */}
          {step === 'mfa_setup' && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>{t('auth.mfa_setup_required')} ({email})</Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>{t('auth.mfa_setup_desc')}</Typography>
              {qrCode && (
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <img src={`data:image/png;base64,${qrCode}`} alt="MFA QR Code" style={{ width: 200, height: 200 }} />
                </Box>
              )}
              {mfaSecret && (
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {mfaSecret}
                </Typography>
              )}
              <TextField
                fullWidth label={t('auth.mfa_code')} value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMfaSetupVerify()}
                sx={{ mb: 2 }} size="small" autoFocus
                inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
              />
              <Button variant="contained" fullWidth onClick={handleMfaSetupVerify} disabled={loading}>
                {t('auth.mfa_verify')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <FormDialog open={settingsOpen} title={t('section.settings')} dirty={settingsDirty} onClose={handleCancelSettings} onSave={handleSaveSettings}>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('profile.theme_mode')}</Typography>
          <ToggleButtonGroup value={themeMode} exclusive onChange={(_, v) => v && setThemeMode(v as ThemeMode)}>
            <ToggleButton value="light"><LightModeIcon sx={{ mr: 1 }} />{t('theme.light')}</ToggleButton>
            <ToggleButton value="dark"><DarkModeIcon sx={{ mr: 1 }} />{t('theme.dark')}</ToggleButton>
            <ToggleButton value="auto"><BrightnessAutoIcon sx={{ mr: 1 }} />{t('theme.auto')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('profile.color_theme')}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(Object.entries(colorThemes) as [ColorTheme, typeof colorThemes.default][]).map(([key, val]) => (
              <Box key={key} onClick={() => setColorTheme(key)} sx={{
                cursor: 'pointer', p: 1.5, borderRadius: 2,
                border: colorTheme === key ? `2px solid ${val.main}` : '2px solid transparent',
                bgcolor: colorTheme === key ? `${val.main}10` : 'transparent',
                textAlign: 'center', minWidth: 70, '&:hover': { bgcolor: `${val.main}15` },
              }}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: val.main, mx: 'auto', mb: 0.5 }} />
                <Typography variant="caption">{t(`theme.${key}`)}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('language.language')}</Typography>
          <ToggleButtonGroup value={i18n.language} exclusive onChange={(_, v) => v && i18n.changeLanguage(v)}>
            <ToggleButton value="en">{t('language.english')}</ToggleButton>
            <ToggleButton value="de">{t('language.german')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </FormDialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
