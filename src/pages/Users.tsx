/**
 * @file Users — Unified NB (Extension) + User management (SIP & ACL)
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, TextField, Checkbox,
  Switch, FormControlLabel, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import Toast from '../components/Toast';
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

/** Merged NB + User row for unified table */
interface MergedRow {
  extension: string;
  type: 'sip' | 'acl' | 'vapi';
  username: string;
  password: string;
  description: string;
  caller_id: string;
  ip: string;
  enabled: boolean;
  vapi_assistant_id: string;
  vapi_assistant_name: string;
}

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [aclUsers, setAclUsers] = useState<AclUser[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editRow, setEditRow] = useState<MergedRow | null>(null);

  const defaultForm = { extension: '', type: 'sip' as 'sip' | 'acl' | 'vapi', username: '', password: '', description: '', caller_id: '', ip: '', enabled: true, vapi_assistant_id: '', vapi_assistant_name: '', protocols: ['udp'] as string[] };
  const [vapiAssistants, setVapiAssistants] = useState<{ id: string; name: string }[]>([]);
  const [hasVapi, setHasVapi] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const [confirmSave, setConfirmSave] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, a, r, e, lic] = await Promise.all([
        api.get('/users'), api.get('/acl-users'), api.get('/registrations'), api.get('/extensions'),
        api.get('/license').catch(() => ({ data: null })),
      ]);
      setUsers(u.data || []);
      setAclUsers(a.data || []);
      setRegistrations(r.data || []);
      setExtensions(e.data || []);
      const features: string[] = lic.data?.active_features || [];
      const vapiActive = features.includes('vapi');
      setHasVapi(vapiActive);
      if (vapiActive) {
        try {
          const vaRes = await api.get('/integrations/vapi/assistants');
          setVapiAssistants(vaRes.data || []);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh registrations every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await api.get('/registrations');
        setRegistrations(r.data || []);
      } catch { /* */ }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Build unified list: merge SIP users + ACL users with their extensions
  const extMap = new Map(extensions.map((e) => [e.extension, e]));

  // Extensions that are VAPI type (no SIP user needed)
  const usedByUsers = new Set([...users.map((u) => u.extension), ...aclUsers.map((u) => u.extension)]);
  const vapiExtensions = extensions.filter((e) => e.type === 'vapi' && !usedByUsers.has(e.extension));

  const mergedRows: MergedRow[] = [
    ...users.map((u): MergedRow => {
      const ext = extMap.get(u.extension);
      return {
        extension: u.extension,
        type: 'sip',
        username: u.username,
        password: u.password || '',
        description: ext?.description || '',
        caller_id: u.caller_id || '',
        ip: '',
        enabled: u.enabled !== false,
        vapi_assistant_id: '',
        vapi_assistant_name: '',
      };
    }),
    ...aclUsers.map((u): MergedRow => {
      const ext = extMap.get(u.extension);
      return {
        extension: u.extension,
        type: 'acl',
        username: u.username,
        password: '',
        description: ext?.description || '',
        caller_id: u.caller_id || '',
        ip: u.ip,
        enabled: ext?.enabled !== false,
        vapi_assistant_id: '',
        vapi_assistant_name: '',
      };
    }),
    ...vapiExtensions.map((e): MergedRow => ({
      extension: e.extension,
      type: 'vapi',
      username: e.vapi_assistant_name || 'VAPI',
      password: '',
      description: e.description || '',
      caller_id: '',
      ip: '',
      enabled: e.enabled !== false,
      vapi_assistant_id: e.vapi_assistant_id || '',
      vapi_assistant_name: e.vapi_assistant_name || '',
    })),
  ].sort((a, b) => a.extension.localeCompare(b.extension, undefined, { numeric: true }));

  // All used extension numbers (for duplicate check)
  const usedExtensions = new Set(mergedRows.map((r) => r.extension));

  // ── Open dialogs ──

  const openAdd = () => {
    setEditRow(null);
    setViewMode(false);
    const fresh = { ...defaultForm };
    setForm(fresh);
    setInitialForm(fresh);
    setErrors({});
    setDialogOpen(true);
  };

  const openView = (row: MergedRow) => {
    setEditRow(row);
    setViewMode(true);
    const f = { extension: row.extension, type: row.type, username: row.username, password: row.password, description: row.description, caller_id: row.caller_id, ip: row.ip, enabled: row.enabled, vapi_assistant_id: row.vapi_assistant_id, vapi_assistant_name: row.vapi_assistant_name, protocols: (row as any).protocols || ['udp'] };
    setForm(f); setInitialForm(f);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (row: MergedRow) => {
    setEditRow(row);
    setViewMode(false);
    const f = { extension: row.extension, type: row.type, username: row.username, password: row.password, description: row.description, caller_id: row.caller_id, ip: row.ip, enabled: row.enabled, vapi_assistant_id: row.vapi_assistant_id, vapi_assistant_name: row.vapi_assistant_name, protocols: (row as any).protocols || ['udp'] };
    setForm(f); setInitialForm(f);
    setErrors({});
    setDialogOpen(true);
  };

  // ── Validation ──

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.extension.trim()) e.extension = t('validation.required');
    else if (!/^\d+$/.test(form.extension)) e.extension = t('extension.digits_only');
    else if (usedExtensions.has(form.extension) && (!editRow || form.extension !== editRow.extension)) e.extension = t('extension.already_exists');
    if (form.type === 'vapi') {
      if (!form.vapi_assistant_id) e.vapi_assistant_id = t('validation.required');
    } else {
      if (!form.username.trim()) e.username = t('validation.required');
      else if (!/^[a-zA-Z0-9._-]+$/.test(form.username)) e.username = t('validation.invalid_username');
      else if (editRow && form.username !== editRow.username && mergedRows.some((r) => r.username === form.username)) e.username = t('validation.username_taken');
    }
    if (form.type === 'sip') {
      if (!editRow && !form.password) e.password = t('validation.required');
      else if (form.password && form.password.length < 4) e.password = t('validation.min_length', { min: 4 });
    }
    if (form.type === 'acl') {
      if (!form.ip.trim()) e.ip = t('validation.required');
      else {
        const ipPattern = /^((\d{1,3}\.){3}\d{1,3}|([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4})(\/\d{1,3})?$/;
        const ips = form.ip.split(',').map((s) => s.trim()).filter(Boolean);
        if (ips.length === 0 || !ips.every((ip) => ipPattern.test(ip))) e.ip = t('validation.invalid_ip');
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const requestSave = () => {
    if (!validate()) return;
    setConfirmSave(true);
  };

  // ── Save ──

  const doSave = async () => {
    setConfirmSave(false);
    try {
      const extData = { extension: form.extension, description: form.description, enabled: form.enabled };

      if (editRow) {
        const extChanged = form.extension !== editRow.extension;
        const userChanged = form.username !== editRow.username;

        // Handle extension change: create new, then delete old
        if (extChanged) {
          await api.post('/extensions', extData);
        } else {
          await api.put(`/extensions/${form.extension}`, extData);
        }

        // Handle user update (or recreate if username changed)
        if (form.type === 'sip') {
          const userData: Record<string, unknown> = { username: form.username, extension: form.extension, caller_id: form.caller_id, enabled: form.enabled };
          if (form.password) userData.password = form.password;
          if (userChanged) {
            await api.post('/users', { ...userData, password: form.password || 'temp1234' });
            await api.delete(`/users/${editRow.username}`);
          } else {
            await api.put(`/users/${editRow.username}`, userData);
          }
        } else {
          const aclData = { username: form.username, ip: form.ip, extension: form.extension, caller_id: form.caller_id };
          if (userChanged) {
            await api.post('/acl-users', aclData);
            await api.delete(`/acl-users/${editRow.username}`);
          } else {
            await api.put(`/acl-users/${editRow.username}`, aclData);
          }
        }

        // Clean up old extension after user is moved
        if (extChanged) {
          await api.delete(`/extensions/${editRow.extension}`);
        }
      } else {
        // Create extension first
        const extPayload = { ...extData, type: form.type === 'vapi' ? 'vapi' : 'sip', vapi_assistant_id: form.vapi_assistant_id, vapi_assistant_name: form.vapi_assistant_name };
        await api.post('/extensions', extPayload);
        // Create user (not needed for VAPI)
        if (form.type === 'sip') {
          await api.post('/users', { username: form.username, password: form.password, extension: form.extension, caller_id: form.caller_id, enabled: form.enabled });
        } else if (form.type === 'acl') {
          await api.post('/acl-users', { username: form.username, ip: form.ip, extension: form.extension, caller_id: form.caller_id });
        }
      }

      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  // ── Toggle enabled ──

  const toggleEnabled = async (row: MergedRow) => {
    try {
      const newEnabled = !row.enabled;
      await api.put(`/extensions/${row.extension}`, { enabled: newEnabled });
      if (row.type === 'sip') {
        await api.put(`/users/${row.username}`, { enabled: newEnabled });
      }
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  // ── Delete ──

  const requestDelete = (row: MergedRow) => {
    const label = `${row.extension} — ${row.username}`;
    setConfirmDelete({ open: true, name: label });
  };

  const doDelete = async () => {
    const label = confirmDelete.name;
    setConfirmDelete({ open: false, name: '' });
    // Parse extension from label "1001 — alice"
    const ext = label.split(' — ')[0];
    const row = mergedRows.find((r) => r.extension === ext);
    if (!row) return;
    try {
      if (row.type === 'sip') {
        await api.delete(`/users/${row.username}`);
      } else if (row.type === 'acl') {
        await api.delete(`/acl-users/${row.username}`);
      }
      // VAPI: only delete extension, no user to delete
      await api.delete(`/extensions/${row.extension}`);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  // ── Dialog title ──

  const dialogTitle = () => {
    if (viewMode) return t('modal.view_user');
    if (editRow) return t('modal.edit_user');
    return t('modal.add_user');
  };

  // ── User display: "username (description)" or "username [ACL]" ──
  const formatUser = (row: MergedRow) => {
    let text = row.username;
    if (row.description) text += ` (${row.description})`;
    if (row.type === 'acl') text += ' [ACL]';
    return text;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('section.users')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{t('button.add')}</Button>
      </Box>

      <CrudTable<MergedRow>
        rows={mergedRows}
        getKey={(r) => `${r.type}-${r.extension}`}
        columns={[
          { id: 'extension', header: t('field.extension'), field: 'extension', width: 90 },
          {
            id: 'user',
            header: t('field.user'),
            render: (row) => (
              <Typography variant="body2" noWrap>
                {formatUser(row)}
              </Typography>
            ),
            searchText: (row) => formatUser(row),
          },
          {
            id: 'password',
            header: t('field.password'),
            render: (row) => row.type === 'sip' && row.password ? (
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 13, color: 'text.secondary', cursor: 'pointer', userSelect: 'none' }}
                onClick={(e) => {
                  const el = e.currentTarget;
                  const pw = row.password || '';
                  if (el.dataset.visible === '1') { el.textContent = '••••••'; el.dataset.visible = '0'; }
                  else {
                    el.textContent = pw; el.dataset.visible = '1';
                    const ta = document.createElement('textarea');
                    ta.value = pw; ta.style.position = 'fixed'; ta.style.opacity = '0';
                    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                  }
                }}
                data-visible="0"
              >
                {'••••••'}
              </Typography>
            ) : null,
            width: 100,
          },
          {
            id: 'caller_id',
            header: t('field.caller_id'),
            render: (row) => row.caller_id ? (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                {row.caller_id}
              </Typography>
            ) : null,
            searchText: (row) => row.caller_id,
          },
        ]}
        columnOrderKey="users-columns"
        searchable
        getStatus={(row) => {
          if (row.type === 'vapi') {
            return { label: 'VAPI', color: 'secondary' };
          }
          if (row.type === 'acl') {
            return { label: `ACL ${row.ip}`, color: 'info' };
          }
          const isReg = registrations.some((r) => r.user === row.username || r.user.split('@')[0] === row.username);
          return isReg
            ? { label: t('status.registered'), color: 'success' }
            : { label: t('status.not_registered'), color: 'error' };
        }}
        getEnabled={(r) => r.enabled}
        onToggle={toggleEnabled}
        onView={openView}
        onEdit={openEdit}
        onDelete={requestDelete}
      />

      <FormDialog
        open={dialogOpen}
        readOnly={viewMode}
        title={dialogTitle()}
        dirty={formDirty}
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
          disabled={viewMode || (!!editRow && editRow.enabled)}
          error={!!errors.extension}
          helperText={errors.extension || t('extension.digits_hint')}
          placeholder="1001"
        />

        {/* Type selector: SIP, ACL, VAPI — only when adding */}
        {!editRow && !viewMode && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('field.type')}
            </Typography>
            <ToggleButtonGroup
              value={form.type}
              exclusive
              onChange={(_, v) => v && setForm({ ...form, type: v })}
              size="small"
              fullWidth
            >
              <ToggleButton value="sip">SIP</ToggleButton>
              <ToggleButton value="acl">ACL</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
        {editRow && (
          <TextField label={t('field.type')} value={form.type.toUpperCase()} disabled />
        )}

        <TextField label={t('field.user')} value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={viewMode || (!!editRow && editRow.enabled)} error={!!errors.username} helperText={errors.username} />

        {form.type === 'sip' && (
          <TextField label={t('auth.password')} type={viewMode ? 'text' : 'password'} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={viewMode}
            error={!!errors.password} helperText={errors.password || (editRow ? t('validation.leave_empty_keep') : '')}
            slotProps={viewMode ? { input: { sx: { fontFamily: 'monospace' } } } : undefined} />
        )}

        {form.type === 'acl' && (
          <TextField label={t('field.ip_address')} value={form.ip}
            onChange={(e) => setForm({ ...form, ip: e.target.value })}
            disabled={viewMode}
            error={!!errors.ip} helperText={errors.ip} placeholder="192.168.1.1" />
        )}


        <TextField
          label={t('extension.description')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          disabled={viewMode}
        />

        <TextField label={t('field.caller_id')} value={form.caller_id}
          onChange={(e) => setForm({ ...form, caller_id: e.target.value })} disabled={viewMode}
          helperText={t('config.caller_id_desc')} />

        {/* Verbindungsprotokoll */}
        {form.type === 'sip' && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('extension.protocols')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['udp', 'tcp', 'ws', 'wss'].map((proto) => (
                <FormControlLabel key={proto} disabled={viewMode}
                  control={
                    <Checkbox size="small"
                      checked={(form.protocols || ['udp']).includes(proto)}
                      onChange={(e) => {
                        const cur = form.protocols || ['udp'];
                        const next = e.target.checked
                          ? [...cur, proto]
                          : cur.filter((p) => p !== proto);
                        setForm({ ...form, protocols: next.length ? next : ['udp'] });
                      }}
                    />
                  }
                  label={proto.toUpperCase()}
                  sx={{ '& .MuiTypography-root': { fontSize: 13, fontWeight: 600 } }}
                />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('extension.protocols_hint')}
            </Typography>
          </Box>
        )}

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
