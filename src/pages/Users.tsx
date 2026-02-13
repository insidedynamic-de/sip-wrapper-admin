/**
 * @file Users — SIP and ACL user management with CRUD
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Tabs, Tab, Button,
  TextField, Snackbar, Alert, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import type { User, AclUser, Registration, Extension } from '../api/types';

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response;
    if (resp?.data?.detail) {
      const detail = resp.data.detail;
      if (Array.isArray(detail)) {
        return detail.map((d: { msg?: string; loc?: string[] }) => {
          const field = d.loc?.slice(-1)[0] || '';
          return field ? `${field}: ${d.msg}` : (d.msg || '');
        }).join('; ');
      }
      if (typeof detail === 'string') return detail;
    }
  }
  return String(err);
}

export default function Users() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [aclUsers, setAclUsers] = useState<AclUser[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editUser, setEditUser] = useState<User | AclUser | null>(null);
  const defaultUserForm = { username: '', password: '', extension: '', caller_id: '', ip: '', enabled: true };
  const [form, setForm] = useState(defaultUserForm);
  const [initialForm, setInitialForm] = useState(defaultUserForm);
  const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const [confirmSave, setConfirmSave] = useState(false);

  const load = useCallback(async () => {
    const [u, a, r, e] = await Promise.all([api.get('/users'), api.get('/acl-users'), api.get('/registrations'), api.get('/extensions')]);
    setUsers(u.data || []);
    setAclUsers(a.data || []);
    setRegistrations(r.data || []);
    setExtensions(e.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditUser(null);
    setViewMode(false);
    const fresh = { ...defaultUserForm };
    setForm(fresh);
    setInitialForm(fresh);
    setErrors({});
    setDialogOpen(true);
  };

  const openView = (u: User | AclUser) => {
    setEditUser(u);
    setViewMode(true);
    const editForm = {
      username: u.username, password: '', extension: u.extension,
      caller_id: u.caller_id || '', ip: 'ip' in u ? u.ip : '',
      enabled: 'enabled' in u ? u.enabled !== false : true,
    };
    setForm(editForm);
    setInitialForm(editForm);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (u: User | AclUser) => {
    setEditUser(u);
    setViewMode(false);
    const editForm = {
      username: u.username, password: '', extension: u.extension,
      caller_id: u.caller_id || '', ip: 'ip' in u ? u.ip : '',
      enabled: 'enabled' in u ? u.enabled !== false : true,
    };
    setForm(editForm);
    setInitialForm(editForm);
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = t('validation.required');
    else if (!/^[a-zA-Z0-9._-]+$/.test(form.username)) e.username = t('validation.invalid_username');
    if (tab === 0) {
      if (!editUser && !form.password) e.password = t('validation.required');
      else if (form.password && form.password.length < 4) e.password = t('validation.min_length', { min: 4 });
    }
    if (tab === 1) {
      if (!form.ip.trim()) e.ip = t('validation.required');
      else if (!/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(form.ip)) e.ip = t('validation.invalid_ip');
    }
    if (!form.extension.trim()) e.extension = t('validation.required');
    else if (!/^[0-9*#+]+$/.test(form.extension)) e.extension = t('validation.invalid_extension');
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
      if (tab === 0) {
        const data: Record<string, unknown> = { username: form.username, extension: form.extension, caller_id: form.caller_id, enabled: form.enabled };
        if (form.password) data.password = form.password;
        if (editUser) await api.put(`/users/${editUser.username}`, data);
        else { data.password = form.password; await api.post('/users', data); }
      } else {
        const data = { username: form.username, ip: form.ip, extension: form.extension, caller_id: form.caller_id };
        if (editUser) await api.put(`/acl-users/${editUser.username}`, data);
        else await api.post('/acl-users', data);
      }
      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  const toggleEnabled = async (u: User) => {
    try {
      await api.put(`/users/${u.username}`, { enabled: !u.enabled });
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  const requestDelete = (username: string) => {
    setConfirmDelete({ open: true, name: username });
  };

  const doDelete = async () => {
    const username = confirmDelete.name;
    setConfirmDelete({ open: false, name: '' });
    try {
      if (tab === 0) await api.delete(`/users/${username}`);
      else await api.delete(`/acl-users/${username}`);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  const dialogTitle = () => {
    if (viewMode) return tab === 0 ? t('modal.view_user') : t('modal.view_acl_user');
    if (editUser) return tab === 0 ? t('modal.edit_user') : t('modal.edit_acl_user');
    return tab === 0 ? t('modal.add_user') : t('modal.add_acl_user');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('section.users')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{t('button.add')}</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('section.sip_users')} />
        <Tab label={t('section.acl_users')} />
      </Tabs>

      {tab === 0 ? (
        <CrudTable<User>
          rows={users}
          getKey={(u) => u.username}
          columns={[
            { header: t('field.user'), field: 'username' },
            { header: t('field.extension'), field: 'extension' },
            { header: t('field.caller_id'), field: 'caller_id' },
          ]}
          getStatus={(u) => {
            const isReg = registrations.some((r) => r.user === u.username);
            return isReg
              ? { label: t('status.registered'), color: 'success' }
              : { label: t('status.not_registered'), color: 'error' };
          }}
          getEnabled={(u) => u.enabled !== false}
          onToggle={(u) => toggleEnabled(u)}
          onView={(u) => openView(u)}
          onEdit={(u) => openEdit(u)}
          onDelete={(u) => requestDelete(u.username)}
        />
      ) : (
        <CrudTable<AclUser>
          rows={aclUsers}
          getKey={(u) => u.username}
          columns={[
            { header: t('field.user'), field: 'username' },
            { header: t('field.ip_address'), field: 'ip' },
            { header: t('field.extension'), field: 'extension' },
          ]}
          onView={(u) => openView(u)}
          onEdit={(u) => openEdit(u)}
          onDelete={(u) => requestDelete(u.username)}
        />
      )}

      <FormDialog
        open={dialogOpen}
        readOnly={viewMode}
        title={dialogTitle()}
        dirty={formDirty}
        onClose={() => setDialogOpen(false)}
        onSave={requestSave}
      >
        <TextField label={t('field.user')} value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          disabled={viewMode || !!editUser} error={!!errors.username} helperText={errors.username} />
        {tab === 0 && (
          <TextField label={t('auth.password')} type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={viewMode}
            error={!!errors.password} helperText={errors.password || (editUser ? t('validation.leave_empty_keep') : '')} />
        )}
        {tab === 1 && (
          <TextField label={t('field.ip_address')} value={form.ip}
            onChange={(e) => setForm({ ...form, ip: e.target.value })}
            disabled={viewMode}
            error={!!errors.ip} helperText={errors.ip} placeholder="192.168.1.1" />
        )}
        <SearchableSelect
          options={extensions.filter((e) => e.enabled !== false).map((e) => ({ label: `${e.extension} — ${e.description}`, value: e.extension }))}
          value={form.extension}
          onChange={(v) => setForm({ ...form, extension: v })}
          label={t('field.extension')}
          disabled={viewMode}
        />
        <TextField label={t('field.caller_id')} value={form.caller_id}
          onChange={(e) => setForm({ ...form, caller_id: e.target.value })} disabled={viewMode} />
        {tab === 0 && (
          <FormControlLabel
            control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} color="success" disabled={viewMode} />}
            label={form.enabled ? t('status.enabled') : t('status.disabled')}
          />
        )}
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

      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
