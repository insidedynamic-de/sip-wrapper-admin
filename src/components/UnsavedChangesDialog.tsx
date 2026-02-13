/**
 * @file UnsavedChangesDialog — Two-step confirmation for discarding unsaved form changes
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button,
} from '@mui/material';

interface Props {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export default function UnsavedChangesDialog({
  open, onSave, onDiscard, onCancel,
  title, message,
}: Props) {
  const { t } = useTranslation();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) setConfirmDiscard(false);
  }, [open]);

  if (confirmDiscard) {
    return (
      <Dialog open={open} onClose={() => { setConfirmDiscard(false); onCancel(); }}>
        <DialogTitle>{t('unsaved.data_loss_title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('unsaved.data_loss_message')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmDiscard(false); onCancel(); }}>
            {t('unsaved.no')}
          </Button>
          <Button variant="contained" color="error" onClick={onDiscard}>
            {t('unsaved.yes')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title || t('unsaved.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message || t('unsaved.message')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmDiscard(true)} color="warning">
          {t('unsaved.exit_without_saving')}
        </Button>
        <Button variant="contained" color="success" onClick={onSave}>
          {t('unsaved.save_now')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
