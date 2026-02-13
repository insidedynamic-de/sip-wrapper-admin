/**
 * @file PageActions — Reusable sticky Save/Cancel bar for page-level forms.
 * Same unsaved-changes logic as FormDialog but for full pages.
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paper, Button } from '@mui/material';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

interface PageActionsProps {
  dirty: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
}

export default function PageActions({
  dirty, onSave, onCancel,
  saveLabel, cancelLabel, saveDisabled,
}: PageActionsProps) {
  const { t } = useTranslation();
  const [showUnsaved, setShowUnsaved] = useState(false);

  useUnsavedChanges({ dirty });

  if (!dirty) return null;

  const handleCancel = () => {
    if (dirty) {
      setShowUnsaved(true);
    } else {
      onCancel();
    }
  };

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: 'sticky',
          bottom: 0,
          p: 2,
          mt: 3,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
          borderTop: 1,
          borderColor: 'divider',
          zIndex: 10,
        }}
      >
        <Button onClick={handleCancel}>
          {cancelLabel || t('button.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={!dirty || saveDisabled}
        >
          {saveLabel || t('button.save_changes')}
        </Button>
      </Paper>

      <UnsavedChangesDialog
        open={showUnsaved}
        onSave={() => { setShowUnsaved(false); onSave(); }}
        onDiscard={() => { setShowUnsaved(false); onCancel(); }}
        onCancel={() => setShowUnsaved(false)}
      />
    </>
  );
}
