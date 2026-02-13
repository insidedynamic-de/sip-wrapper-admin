/**
 * @file ApplyChangesButton — Global "Apply & Reload" button for FreeSWITCH config
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Snackbar, Alert } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import api from '../api/client';
import ConfirmDialog from './ConfirmDialog';

export default function ApplyChangesButton() {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const doApply = async () => {
    setConfirmOpen(false);
    try {
      const res = await api.post('/config/apply');
      setToast({ open: true, message: res.data?.message || t('status.success'), severity: res.data?.success ? 'success' : 'error' });
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="warning"
        size="small"
        startIcon={<SyncIcon />}
        onClick={() => setConfirmOpen(true)}
      >
        {t('button.apply_reload')}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        variant="save"
        title={t('config.apply_changes')}
        message={t('config.apply_confirm_message')}
        confirmLabel={t('button.apply_reload')}
        cancelLabel={t('button.cancel')}
        onConfirm={doApply}
        onCancel={() => setConfirmOpen(false)}
      />

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </>
  );
}
