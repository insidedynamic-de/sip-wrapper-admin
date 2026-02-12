import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api/client';
import type { User, AclUser } from '../api/types';

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response;
    if (resp?.data?.detail) {
      const detail = resp.data.detail;
      // Pydantic validation errors come as array
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | AclUser | null>(null);
  const [form, setForm] = useState({ username: '', password: '', extension: '', caller_id: '', ip: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = useCallback(async () => {
    const [u, a] = await Promise.all([api.get('/users'), api.get('/acl-users')]);
    setUsers(u.data || []);
    setAclUsers(a.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditUser(null);
    setForm({ username: '', password: '', extension: '', caller_id: '', ip: '' });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (u: User | AclUser) => {
    setEditUser(u);
    setForm({
      username: u.username,
      password: '',
      extension: u.extension,
      caller_id: u.caller_id || '',
      ip: 'ip' in u ? u.ip : '',
    });
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

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (tab === 0) {
        const data: Record<string, unknown> = { username: form.username, extension: form.extension, caller_id: form.caller_id };
        if (form.password) data.password = form.password;
        if (editUser) {
          await api.put(`/users/${editUser.username}`, data);
        } else {
          data.password = form.password;
          await api.post('/users', data);
        }
      } else {
        const data = { username: form.username, ip: form.ip, extension: form.extension, caller_id: form.caller_id };
        if (editUser) {
          await api.put(`/acl-users/${editUser.username}`, data);
        } else {
          await api.post('/acl-users', data);
        }
      }
      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  const handleDelete = async (username: string) => {
    try {
      if (tab === 0) await api.delete(`/users/${username}`);
      else await api.delete(`/acl-users/${username}`);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch (err) {
      setToast({ open: true, message: extractError(err), severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('section.users')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          {t('button.add')}
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('section.sip_users')} />
        <Tab label={t('section.acl_users')} />
      </Tabs>

      <Card>
        <CardContent>
          {tab === 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('field.user')}</TableCell>
                    <TableCell>{t('field.extension')}</TableCell>
                    <TableCell>{t('field.caller_id')}</TableCell>
                    <TableCell align="right">{t('field.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.username}>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.extension}</TableCell>
                      <TableCell>{u.caller_id}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(u.username)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('field.user')}</TableCell>
                    <TableCell>{t('field.ip_address')}</TableCell>
                    <TableCell>{t('field.extension')}</TableCell>
                    <TableCell align="right">{t('field.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aclUsers.map((u) => (
                    <TableRow key={u.username}>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.ip}</TableCell>
                      <TableCell>{u.extension}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(u.username)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editUser ? (tab === 0 ? t('modal.edit_user') : t('modal.edit_acl_user'))
                    : (tab === 0 ? t('modal.add_user') : t('modal.add_acl_user'))}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={t('field.user')}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            disabled={!!editUser}
            error={!!errors.username}
            helperText={errors.username}
          />
          {tab === 0 && (
            <TextField
              label={t('auth.password')}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={!!errors.password}
              helperText={errors.password || (editUser ? t('validation.leave_empty_keep') : '')}
            />
          )}
          {tab === 1 && (
            <TextField
              label={t('field.ip_address')}
              value={form.ip}
              onChange={(e) => setForm({ ...form, ip: e.target.value })}
              error={!!errors.ip}
              helperText={errors.ip}
              placeholder="192.168.1.1"
            />
          )}
          <TextField
            label={t('field.extension')}
            value={form.extension}
            onChange={(e) => setForm({ ...form, extension: e.target.value })}
            error={!!errors.extension}
            helperText={errors.extension}
            placeholder="1000"
          />
          <TextField
            label={t('field.caller_id')}
            value={form.caller_id}
            onChange={(e) => setForm({ ...form, caller_id: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={handleSave}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
