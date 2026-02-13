/**
 * @file ConfirmDialog — Reusable confirmation dialog for save and delete actions
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button,
} from '@mui/material';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'delete' | 'save';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'delete',
  onConfirm, onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={variant === 'delete' ? 'error' : 'success'}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
