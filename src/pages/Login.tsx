/**
 * @file Login — Login page with API key auth, host config, and settings gear
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  IconButton, ToggleButtonGroup, ToggleButton,
  Switch, FormControlLabel, Tooltip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import api, { setDemoAdapter } from '../api/client';
import { loadPreferences, savePreferences } from '../store/preferences';
import type { ThemeMode } from '../store/preferences';
import { colorThemes, type ColorTheme } from '../theme/colors';
import FormDialog from '../components/FormDialog';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { saveApiKey } from '../store/keyStore';
import i18n from '../i18n';

interface Props {
  themeMode: ThemeMode;
  setThemeMode: (v: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (v: ColorTheme) => void;
}

const DEMO_HOST = 'https://demo.local';
const DEMO_API_KEY = 'demo_apikey';

export default function Login({ themeMode, setThemeMode, colorTheme, setColorTheme }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const initPrefs = loadPreferences();
  const [apiKey, setApiKey] = useState(initPrefs.demoMode ? DEMO_API_KEY : '');
  const [host, setHost] = useState(initPrefs.demoMode ? DEMO_HOST : (localStorage.getItem('api_host') || ''));
  const [error, setError] = useState('');
  const [hostError, setHostError] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(initPrefs.demoMode);
  const [sessionConflict, setSessionConflict] = useState<{ open: boolean; ip: string; time: string }>({ open: false, ip: '', time: '' });

  // Snapshot of initial values when settings dialog opens (for revert on cancel)
  const snapshot = useRef({ themeMode, colorTheme, language: i18n.language, demoMode });

  const settingsDirty =
    themeMode !== snapshot.current.themeMode ||
    colorTheme !== snapshot.current.colorTheme ||
    i18n.language !== snapshot.current.language ||
    demoMode !== snapshot.current.demoMode;

  const openSettings = () => {
    snapshot.current = { themeMode, colorTheme, language: i18n.language, demoMode };
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    savePreferences({ themeMode, colorTheme, language: i18n.language, demoMode });
    setDemoAdapter(demoMode);
    localStorage.setItem('language', i18n.language);
    // Pre-fill or clear demo fields
    if (demoMode) {
      setHost(DEMO_HOST);
      setApiKey(DEMO_API_KEY);
    } else if (snapshot.current.demoMode && !demoMode) {
      setHost('');
      setApiKey('');
    }
    setSettingsOpen(false);
  };

  const handleCancelSettings = () => {
    // Revert to snapshot
    setThemeMode(snapshot.current.themeMode);
    setColorTheme(snapshot.current.colorTheme);
    i18n.changeLanguage(snapshot.current.language);
    setDemoMode(snapshot.current.demoMode);
    setSettingsOpen(false);
  };

  /** Validate host: must have http(s)://, then a valid domain/IP/localhost */
  const validateHost = (value: string): string => {
    if (!value.trim()) return ''; // empty host is allowed (uses relative path)
    if (!/^https?:\/\//i.test(value)) return t('validation.host_protocol');
    try {
      const url = new URL(value);
      const hostname = url.hostname;
      // localhost is fine
      if (hostname === 'localhost') return '';
      // IPv4
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return '';
      // IPv6 (URL parser wraps in brackets, hostname strips them)
      if (hostname.includes(':')) return '';
      // Domain must contain a dot
      if (!hostname.includes('.')) return t('validation.host_invalid');
      return '';
    } catch {
      return t('validation.host_invalid');
    }
  };

  /** Complete login after all checks pass */
  const completeLogin = async () => {
    await saveApiKey(apiKey);
    setToast({ open: true, message: t('status.connection_ok'), severity: 'success' });
    setTimeout(() => navigate('/'), 800);
  };

  /** Try to acquire a session; show conflict dialog if one is active */
  const trySessionLogin = async (force: boolean) => {
    try {
      await api.post('/auth/login', { force }, { headers: { 'X-API-Key': apiKey } });
      await completeLogin();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { active_session?: boolean; ip?: string; logged_in_at?: string } } };
      if (axiosErr?.response?.status === 409 && axiosErr.response.data?.active_session) {
        const d = axiosErr.response.data;
        const time = d.logged_in_at ? new Date(d.logged_in_at).toLocaleString() : '—';
        setSessionConflict({ open: true, ip: d.ip || '—', time });
      } else {
        // Unexpected error during session login — still allow entry
        await completeLogin();
      }
    }
  };

  const handleForceLogin = async () => {
    setSessionConflict({ open: false, ip: '', time: '' });
    await trySessionLogin(true);
  };

  const handleLogin = async () => {
    setError('');
    setHostError('');
    setApiKeyError('');

    // Demo mode: skip host validation but still check session
    const prefs = loadPreferences();
    if (prefs.demoMode) {
      setDemoAdapter(true);
      await saveApiKey(apiKey.trim() || DEMO_API_KEY);
      // Check for active session in demo mode too
      try {
        const res = await api.post('/auth/login', { force: false });
        if (res.data?.success) {
          setToast({ open: true, message: t('demo.login_success'), severity: 'success' });
          setTimeout(() => navigate('/'), 800);
          return;
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { active_session?: boolean; ip?: string; logged_in_at?: string } } };
        if (axiosErr?.response?.status === 409 && axiosErr.response.data?.active_session) {
          const d = axiosErr.response.data;
          const time = d.logged_in_at ? new Date(d.logged_in_at).toLocaleString() : '—';
          setSessionConflict({ open: true, ip: d.ip || '—', time });
          return;
        }
      }
      setToast({ open: true, message: t('demo.login_success'), severity: 'success' });
      setTimeout(() => navigate('/'), 800);
      return;
    }

    // Validate fields
    const hErr = validateHost(host);
    if (hErr) { setHostError(hErr); return; }
    if (!apiKey.trim()) { setApiKeyError(t('validation.api_key_required')); return; }

    // Save host and update axios baseURL
    if (host.trim()) {
      const baseUrl = host.replace(/\/+$/, '');
      localStorage.setItem('api_host', baseUrl);
      api.defaults.baseURL = `${baseUrl}/api/v1`;
    } else {
      localStorage.removeItem('api_host');
      api.defaults.baseURL = '/api/v1';
    }

    try {
      const res = await api.get('/health', { headers: { 'X-API-Key': apiKey } });
      if (res.data.status === 'ok') {
        // Health OK — now check for active session
        await trySessionLogin(false);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string; message?: string } } };
      const detail = axiosErr?.response?.data?.detail || axiosErr?.response?.data?.message;
      const status = axiosErr?.response?.status;
      if (detail) {
        setError(`${status ? status + ': ' : ''}${detail}`);
      } else if (status) {
        setError(`${status}: ${t('status.access_denied')}`);
      } else {
        setError(t('config.connection_error'));
      }
    }
  };

  const handleDemoQuickStart = async () => {
    savePreferences({ themeMode, colorTheme, language: i18n.language, demoMode: true });
    setDemoAdapter(true);
    setDemoMode(true);
    await saveApiKey(DEMO_API_KEY);
    setToast({ open: true, message: t('demo.login_success'), severity: 'success' });
    setTimeout(() => navigate('/'), 800);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Card sx={{ width: 420, p: 2 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
            SIP Wrapper
          </Typography>

          {demoMode && <Alert severity="info" sx={{ mb: 2 }}>{t('demo.active_notice')}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Host / Server URL */}
          <TextField
            fullWidth
            label={t('auth.host') || 'Host'}
            value={host}
            onChange={(e) => { setHost(e.target.value); setHostError(''); }}
            placeholder="https://sip.example.com"
            sx={{ mb: 2 }}
            size="small"
            error={!!hostError}
            helperText={hostError}
          />

          {/* API Key */}
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setApiKeyError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            sx={{ mb: 2 }}
            error={!!apiKeyError}
            helperText={apiKeyError}
          />

          {/* Login button (80%) + Gear icon (20%) */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleLogin}
              sx={{ flex: '0 0 80%' }}
            >
              {t('auth.login')}
            </Button>
            <IconButton
              onClick={openSettings}
              sx={{
                flex: '0 0 calc(20% - 8px)',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <FormDialog
        open={settingsOpen}
        title={t('section.settings')}
        dirty={settingsDirty}
        onClose={handleCancelSettings}
        onSave={handleSaveSettings}
      >
        {/* Theme Mode */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('profile.theme_mode')}</Typography>
          <ToggleButtonGroup
            value={themeMode}
            exclusive
            onChange={(_, v) => v && setThemeMode(v as ThemeMode)}
          >
            <ToggleButton value="light"><LightModeIcon sx={{ mr: 1 }} />{t('theme.light')}</ToggleButton>
            <ToggleButton value="dark"><DarkModeIcon sx={{ mr: 1 }} />{t('theme.dark')}</ToggleButton>
            <ToggleButton value="auto"><BrightnessAutoIcon sx={{ mr: 1 }} />{t('theme.auto')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Color Theme */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('profile.color_theme')}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {(Object.entries(colorThemes) as [ColorTheme, typeof colorThemes.default][]).map(([key, val]) => (
              <Box
                key={key}
                onClick={() => setColorTheme(key)}
                sx={{
                  cursor: 'pointer', p: 1.5, borderRadius: 2,
                  border: colorTheme === key ? `2px solid ${val.main}` : '2px solid transparent',
                  bgcolor: colorTheme === key ? `${val.main}10` : 'transparent',
                  textAlign: 'center', minWidth: 70,
                  '&:hover': { bgcolor: `${val.main}15` },
                }}
              >
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: val.main, mx: 'auto', mb: 0.5 }} />
                <Typography variant="caption">{t(`theme.${key}`)}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Language */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('language.language')}</Typography>
          <ToggleButtonGroup value={i18n.language} exclusive onChange={(_, v) => v && i18n.changeLanguage(v)}>
            <ToggleButton value="en">{t('language.english')}</ToggleButton>
            <ToggleButton value="de">{t('language.german')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Demo Mode */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('demo.title')}</Typography>
          <FormControlLabel
            control={<Switch checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />}
            label={t('demo.enable')}
          />
          <Typography variant="body2" color="text.secondary">
            {t('demo.description')}
          </Typography>
        </Box>
      </FormDialog>

      {/* Session conflict dialog */}
      <ConfirmDialog
        open={sessionConflict.open}
        variant="save"
        title={t('auth.session_conflict_title')}
        message={t('auth.session_conflict_message', { ip: sessionConflict.ip, time: sessionConflict.time })}
        confirmLabel={t('auth.force_login')}
        cancelLabel={t('button.cancel')}
        onConfirm={handleForceLogin}
        onCancel={() => setSessionConflict({ open: false, ip: '', time: '' })}
      />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />

      {/* Right-side quick actions */}
      <Box
        sx={{
          position: 'fixed',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Tooltip title={t('demo.title')} placement="left">
          <Button
            variant="outlined"
            size="small"
            onClick={handleDemoQuickStart}
            sx={{
              minWidth: 0,
              px: 1,
              py: 1,
              borderRadius: 2,
              flexDirection: 'column',
              fontSize: 10,
              lineHeight: 1.2,
            }}
          >
            <PlayArrowIcon sx={{ fontSize: 20 }} />
            Demo
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
}
