/**
 * @file Extensions — Nebenstellen (phone extensions) management with CRUD
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button,
  TextField, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import Toast from '../components/Toast';
import type { Extension } from '../api/types';

export default function Extensions() {
  const { t } = useTranslation();
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editExt, setEditExt] = useState<Extension | null>(null);
  const defaultForm = { extension: '', description: '', enabled: true };
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string }>({ open: false, name: '' });

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/extensions');
      setExtensions(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditExt(null);
    setViewMode(false);
    const fresh = { ...defaultForm };
    setForm(fresh);
    setInitialForm(fresh);
    setErrors({});
    setDialogOpen(true);
  };

  const openView = (ext: Extension) => {
    setEditExt(ext);
    setViewMode(true);
    const f = { extension: ext.extension, description: ext.description, enabled: ext.enabled !== false };
    setForm(f);
    setInitialForm(f);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (ext: Extension) => {
    setEditExt(ext);
    setViewMode(false);
    const f = { extension: ext.extension, description: ext.description, enabled: ext.enabled !== false };
    setForm(f);
    setInitialForm(f);
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.extension.trim()) e.extension = t('validation.required');
    else if (!/^\d+$/.test(form.extension)) e.extension = t('extension.digits_only');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const requestSave = () => {
    if (!validate()) return;
    setConfirmSave(true);
  };

  const doSave = async () => {
    setConfirmSave(false);
    try {
      if (editExt) {
        await api.put(`/extensions/${editExt.extension}`, form);
      } else {
        await api.post('/extensions', form);
      }
      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const toggleEnabled = async (ext: Extension) => {
    try {
      await api.put(`/extensions/${ext.extension}`, { enabled: !(ext.enabled !== false) });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const requestDelete = (extension: string) => setConfirmDelete({ open: true, name: extension });

  const doDelete = async () => {
    const ext = confirmDelete.name;
    setConfirmDelete({ open: false, name: '' });
    try {
      await api.delete(`/extensions/${ext}`);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('extension.extensions')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{t('extension.add_extension')}</Button>
      </Box>

      <CrudTable<Extension>
        rows={extensions}
        getKey={(ext) => ext.extension}
        columns={[
          { id: 'extension', header: t('field.extension'), field: 'extension' },
          { id: 'description', header: t('extension.description'), field: 'description' },
        ]}
        columnOrderKey="extensions-columns"
        searchable
        getEnabled={(ext) => ext.enabled !== false}
        onToggle={(ext) => toggleEnabled(ext)}
        onView={openView}
        onEdit={openEdit}
        onDelete={(ext) => requestDelete(ext.extension)}
      />

      <FormDialog
        open={dialogOpen}
        readOnly={viewMode}
        title={viewMode ? t('extension.view_extension') : editExt ? t('extension.edit_extension') : t('extension.add_extension')}
        dirty={dirty}
        onClose={() => setDialogOpen(false)}
        onSave={requestSave}
      >
        <TextField
          label={t('field.extension')}
          value={form.extension}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setForm({ ...form, extension: val });
          }}
          disabled={viewMode || !!editExt}
          error={!!errors.extension}
          helperText={errors.extension || t('extension.digits_hint')}
          placeholder="1001"
        />
        <TextField
          label={t('extension.description')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          disabled={viewMode}
        />
        <FormControlLabel
          control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} color="success" disabled={viewMode} />}
          label={form.enabled ? t('status.enabled') : t('status.disabled')}
        />
      </FormDialog>

      <ConfirmDialog open={confirmSave} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={doSave} onCancel={() => setConfirmSave(false)} />

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={doDelete} onCancel={() => setConfirmDelete({ open: false, name: '' })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
