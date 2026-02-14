/**
 * @file FormDialog — Reusable form dialog with X close, dirty tracking,
 *       disabled Save button, and unsaved-changes confirmation flow.
 *
 * Layout: Cancel (left) | Save Changes (right, disabled when clean)
 * X button always top-right.
 *
 * When dirty and user clicks X or Cancel:
 *  Step 1 — "Save Now" or "Exit Without Saving"
 *  Step 2 — "Data will be lost. Are you sure?" Yes / No
 *
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UnsavedChangesDialog from './UnsavedChangesDialog';

interface Props {
  open: boolean;
  title: string;
  dirty: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  /** Read-only mode: hides Save, Cancel becomes Close */
  readOnly?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function FormDialog({
  open, title, dirty, onClose, onSave,
  saveLabel, cancelLabel, saveDisabled, readOnly,
  maxWidth = 'sm', children,
}: Props) {
  const { t } = useTranslation();
  const [showUnsaved, setShowUnsaved] = useState(false);

  const handleClose = () => {
    if (dirty) {
      setShowUnsaved(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth={maxWidth} fullWidth disableRestoreFocus>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {title}
          <IconButton onClick={handleClose} size="small" edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {children}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            {readOnly ? t('button.close') : (cancelLabel || t('button.cancel'))}
          </Button>
          {!readOnly && (
            <Button
              variant="contained"
              onClick={onSave}
              disabled={!dirty || saveDisabled}
            >
              {saveLabel || t('button.save_changes')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsaved}
        onSave={() => { setShowUnsaved(false); onSave(); }}
        onDiscard={() => { setShowUnsaved(false); onClose(); }}
        onCancel={() => setShowUnsaved(false)}
      />
    </>
  );
}
