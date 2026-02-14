/**
 * @file LogoutCountdown — Shows countdown before auto-logout on inactivity
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, LinearProgress, Dialog, IconButton,
  CircularProgress, Tooltip,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import CloseIcon from '@mui/icons-material/Close';
import { loadPreferences } from '../store/preferences';
import { clearApiKey } from '../store/keyStore';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
const MODAL_THRESHOLD = 20;

interface Props {
  collapsed?: boolean;
}

export default function LogoutCountdown({ collapsed = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number>(0);

  const getPrefs = useCallback(() => {
    const p = loadPreferences();
    return { enabled: p.autoLogout, timeout: p.autoLogoutTimeout };
  }, []);

  const doLogout = useCallback(() => {
    clearApiKey();
    navigate('/login');
  }, [navigate]);

  const resetTimer = useCallback(() => {
    const { enabled, timeout } = getPrefs();
    if (!enabled || timeout <= 0) {
      setSecondsLeft(null);
      setShowModal(false);
      return;
    }
    deadlineRef.current = Date.now() + timeout * 1000;
    setSecondsLeft(timeout);
    setShowModal(false);
  }, [getPrefs]);

  const handleDismissModal = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Tick every second
  useEffect(() => {
    const { enabled, timeout } = getPrefs();
    if (!enabled || timeout <= 0) {
      setSecondsLeft(null);
      return;
    }

    deadlineRef.current = Date.now() + timeout * 1000;
    setSecondsLeft(timeout);

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= MODAL_THRESHOLD && remaining > 0) setShowModal(true);
      if (remaining <= 0) doLogout();
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [getPrefs, doLogout]);

  // Reset on user activity (only when modal is NOT showing)
  useEffect(() => {
    const handler = () => {
      if (!showModal) resetTimer();
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, handler, { passive: true });
    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, handler);
    };
  }, [resetTimer, showModal]);

  if (secondsLeft === null) return null;

  const { timeout } = getPrefs();
  const progress = timeout > 0 ? (secondsLeft / timeout) * 100 : 0;
  const urgent = secondsLeft <= 30;
  const modalProgress = MODAL_THRESHOLD > 0 ? (secondsLeft / MODAL_THRESHOLD) * 100 : 0;

  return (
    <>
      {/* Sidebar indicator */}
      {collapsed ? (
        <Tooltip title={t('countdown.logout_in', { seconds: secondsLeft })} placement="right" arrow>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <LogoutIcon sx={{ fontSize: 20, color: urgent ? 'error.main' : 'rgba(255,255,255,0.5)' }} />
          </Box>
        </Tooltip>
      ) : (
        <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LogoutIcon sx={{ fontSize: 16, color: urgent ? 'error.main' : 'rgba(255,255,255,0.5)' }} />
            <Typography
              variant="caption"
              sx={{
                color: urgent ? 'error.main' : 'rgba(255,255,255,0.5)',
                fontWeight: urgent ? 600 : 400,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t('countdown.logout_in', { seconds: secondsLeft })}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 3, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: urgent ? 'error.main' : 'rgba(255,255,255,0.3)',
              },
            }}
          />
        </Box>
      )}

      {/* Fullscreen modal at 20s */}
      <Dialog
        open={showModal}
        disableRestoreFocus
        onClose={handleDismissModal}
        slotProps={{
          backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' } },
        }}
        PaperProps={{
          sx: {
            borderRadius: 4, p: 4, minWidth: 360, textAlign: 'center',
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #fff 0%, #f5f5f5 100%)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          },
        }}
      >
        <IconButton
          onClick={handleDismissModal}
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>

        <Box sx={{ position: 'relative', display: 'inline-flex', mx: 'auto', mb: 3 }}>
          <CircularProgress
            variant="determinate"
            value={modalProgress}
            size={120}
            thickness={4}
            sx={{
              color: secondsLeft <= 5 ? 'error.main' : secondsLeft <= 10 ? 'warning.main' : 'primary.main',
              transition: 'color 0.3s ease',
            }}
          />
          <Box
            sx={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: secondsLeft <= 5 ? 'error.main' : 'text.primary',
                transition: 'color 0.3s ease',
              }}
            >
              {secondsLeft}
            </Typography>
          </Box>
        </Box>

        <LogoutIcon sx={{ fontSize: 32, color: 'error.main', mb: 1 }} />

        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          {t('countdown.modal_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('countdown.modal_message')}
        </Typography>
      </Dialog>
    </>
  );
}
