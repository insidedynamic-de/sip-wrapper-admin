/**
 * @file Toast — Reusable Snackbar + Alert with close button and auto-hide
 */
import { Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface Props extends ToastState {
  onClose: () => void;
  autoHideDuration?: number;
}

export default function Toast({ open, message, severity, onClose, autoHideDuration = 5000 }: Props) {
  return (
    <Snackbar open={open} autoHideDuration={autoHideDuration} onClose={onClose}>
      <Alert
        severity={severity}
        variant="filled"
        onClose={onClose}
        action={
          <IconButton size="small" color="inherit" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
