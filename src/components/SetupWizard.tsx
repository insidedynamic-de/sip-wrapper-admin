/**
 * @file SetupWizard — Mandatory first-run dialog for company identification
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, IconButton, Tooltip,
  InputAdornment, Alert,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';
import Toast from './Toast';

interface Props {
  open: boolean;
  onComplete: () => void;
}

/** Generate a random company ID like "company-a7b3c2" */
function generateCompanyId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `company-${suffix}`;
}

/** Validate company ID: only letters, numbers, max one hyphen, no start/end with hyphen */
function validateCompanyId(value: string): string | null {
  if (!value) return 'required';
  if (value.length < 3) return 'min_length';
  if (value.length > 40) return 'max_length';
  if (!/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)?$/.test(value)) return 'invalid_company_id';
  return null;
}

/** Common disposable email domains for instant client-side feedback. Backend has the full 5000+ list. */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'trashmail.com', 'trashmail.net', 'mailnesia.com',
  'maildrop.cc', 'discard.email', 'temp-mail.org', 'fakeinbox.com',
  'mailcatch.com', 'tempail.com', 'tempr.email', 'mohmal.com',
  'getnada.com', 'emailondeck.com', '10minutemail.com', 'minutemail.com',
  'temp-mail.io', 'harakirimail.com', 'guerrillamail.info', 'spam4.me',
  'mailsac.com', 'inboxbear.com', 'tempinbox.com', 'burnermail.io',
  'mytemp.email', 'dropmail.me', 'mailtemp.net', 'tempmailaddress.com',
  'emailfake.com', 'crazymailing.com', 'armyspy.com', 'dayrep.com',
  'einrot.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com',
  'rhyta.com', 'superrito.com', 'teleworm.us',
]);

function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}

function validateEmail(value: string): string | null {
  if (!value) return 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'invalid_email';
  if (isDisposableEmail(value)) return 'disposable_email';
  return null;
}

export default function SetupWizard({ open, onComplete }: Props) {
  const { t } = useTranslation();

  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({ id: false, name: false, email: false });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' as 'success' | 'error' });

  const idError = touched.id ? validateCompanyId(companyId) : null;
  const nameError = touched.name && !companyName ? 'required' : null;
  const emailError = touched.email ? validateEmail(companyEmail) : null;

  const canSave = !validateCompanyId(companyId) && !!companyName && !validateEmail(companyEmail);

  const handleGenerate = useCallback(() => {
    setCompanyId(generateCompanyId());
    setTouched((t) => ({ ...t, id: true }));
  }, []);

  const handleSave = async () => {
    setTouched({ id: true, name: true, email: true });
    if (!canSave) return;

    setSaving(true);
    try {
      await api.put('/company', {
        company_id: companyId,
        company_name: companyName,
        company_email: companyEmail,
      });
      await api.post('/config/apply');
      onComplete();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const knownErrors: Record<string, string> = {
        disposable_email: t('setup.disposable_email'),
        company_id_taken: t('setup.company_id_taken'),
        company_id_immutable: t('setup.company_id_immutable'),
      };
      const message = (detail && knownErrors[detail]) || t('status.error');
      setToast({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getHelperText = (error: string | null): string => {
    if (!error) return '';
    switch (error) {
      case 'required': return t('validation.required');
      case 'min_length': return t('validation.min_length', { min: 3 });
      case 'max_length': return t('setup.company_id_max_length');
      case 'invalid_company_id': return t('setup.company_id_format');
      case 'invalid_email': return t('setup.invalid_email');
      case 'disposable_email': return t('setup.disposable_email');
      default: return '';
    }
  };

  return (
    <>
      <Dialog
        open={open}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        slotProps={{ backdrop: { sx: { backdropFilter: 'blur(4px)' } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" component="span" fontWeight={600}>
            {t('setup.title')}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            {t('setup.description')}
          </Alert>

          {/* Company ID */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label={t('setup.company_id')}
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value.toLowerCase());
                setTouched((t) => ({ ...t, id: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, id: true }))}
              error={!!idError}
              helperText={getHelperText(idError) || t('setup.company_id_hint')}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('setup.generate')}>
                        <IconButton onClick={handleGenerate} edge="end" size="small">
                          <AutorenewIcon />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {t('setup.company_id_example')}
            </Typography>
          </Box>

          {/* Display Name */}
          <TextField
            fullWidth
            label={t('setup.display_name')}
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setTouched((t) => ({ ...t, name: true }));
            }}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            error={!!nameError}
            helperText={getHelperText(nameError) || t('setup.display_name_hint')}
            sx={{ mb: 3 }}
          />

          {/* Email */}
          <TextField
            fullWidth
            label={t('setup.email')}
            type="email"
            value={companyEmail}
            onChange={(e) => {
              setCompanyEmail(e.target.value);
              setTouched((t) => ({ ...t, email: true }));
            }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={!!emailError}
            helperText={getHelperText(emailError) || t('setup.email_hint')}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!canSave || saving}
            fullWidth
          >
            {saving ? t('status.loading') : t('setup.save_continue')}
          </Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </>
  );
}
