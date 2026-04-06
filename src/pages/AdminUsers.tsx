/**
 * @file AdminUsers — Superadmin: manage users across all tenants
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, IconButton, Tooltip, CircularProgress, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import KeyIcon from '@mui/icons-material/Key';
import InputAdornment from '@mui/material/InputAdornment';
import api from '../api/client';
import { getUserFromToken } from '../store/auth';
import Toast from '../components/Toast';

/** Generate NIS2-compliant password: 14 chars, upper+lower+digit+special */
function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*?';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  // Guarantee at least one of each
  const parts = [pick(upper), pick(upper), pick(lower), pick(lower), pick(lower), pick(lower),
    pick(digits), pick(digits), pick(special), pick(special)];
  // Fill to 14
  const all = upper + lower + digits + special;
  while (parts.length < 14) parts.push(pick(all));
  // Shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join('');
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  user_type: string;
  tenant_id: number;
  mfa_enabled: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tenants, setTenants] = useState<{ id: number; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<Record<string, string | number | boolean | null>>({});
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', user_type: 'user', tenant_id: 0 });
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const currentUser = getUserFromToken();
  const isOwner = currentUser?.user_type === 'owner';

  const fetchData = useCallback(async () => {
    try {
      const [uRes, tRes] = await Promise.all([api.get('/admin/users'), api.get('/admin/tenants')]);
      setUsers(uRes.data);
      setTenants(tRes.data.map((t: { id: number; name: string; email: string }) => ({ id: t.id, name: t.name, email: t.email || '' })));
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeactivate = async (userId: number) => {
    if (!confirm('Deactivate user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setToast({ open: true, message: 'User deactivated', severity: 'success' });
      fetchData();
    } catch { setToast({ open: true, message: 'Error', severity: 'error' }); }
  };

  const handleSave = async () => {
    try {
      await api.put(`/admin/users/${editUser.id}`, editUser);
      setToast({ open: true, message: 'Saved', severity: 'success' });
      setEditOpen(false);
      fetchData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/admin/users', newUser);
      setToast({ open: true, message: 'User created', severity: 'success' });
      setCreateOpen(false);
      setNewUser({ email: '', password: '', name: '', user_type: 'user', tenant_id: 0 });
      fetchData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  const getTenantName = (id: number) => tenants.find((t) => t.id === id)?.name || `#${id}`;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{t('admin.users')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small" startIcon={<PersonAddIcon />} onClick={() => setCreateOpen(true)}>
            {t('button.add')}
          </Button>
          <IconButton onClick={fetchData}><RefreshIcon /></IconButton>
        </Box>
      </Box>

      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>{t('auth.email')}</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Tenant</TableCell>
              <TableCell>MFA</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} sx={{ opacity: u.is_active ? 1 : 0.5 }}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell>
                  <Chip label={u.user_type} size="small"
                    color={u.user_type === 'owner' ? 'error' : u.user_type === 'superadmin' ? 'warning' : u.user_type === 'admin' ? 'primary' : 'default'} />
                </TableCell>
                <TableCell>{getTenantName(u.tenant_id)}</TableCell>
                <TableCell>{u.mfa_enabled ? <Chip label="MFA" size="small" color="success" /> : '—'}</TableCell>
                <TableCell>{u.is_active ? <Chip label="Active" size="small" color="success" /> : <Chip label="Inactive" size="small" />}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—'}</TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => { setEditUser({ ...u } as Record<string, string | number | boolean | null>); setEditOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  {u.is_active && (
                    <Tooltip title="Deactivate">
                      <IconButton size="small" color="error" onClick={() => handleDeactivate(u.id)}><PersonOffIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit User #{editUser.id}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField size="small" label={t('auth.email')} value={editUser.email || ''} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} />
          <TextField size="small" label="Name" value={editUser.name || ''} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} />
          <FormControl size="small">
            <InputLabel>Tenant</InputLabel>
            <Select value={editUser.tenant_id || ''} label="Tenant" onChange={(e) => setEditUser({ ...editUser, tenant_id: Number(e.target.value) })}>
              {tenants.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Role</InputLabel>
            <Select value={editUser.user_type || 'user'} label="Role" onChange={(e) => setEditUser({ ...editUser, user_type: e.target.value })}>
              <MenuItem value="user">User (Client)</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              {isOwner && <MenuItem value="superadmin">Superadmin</MenuItem>}
              {isOwner && <MenuItem value="owner">Owner</MenuItem>}
            </Select>
          </FormControl>
          <TextField size="small" label="New Password (optional)"
            value={(editUser.password as string) || ''}
            onChange={(e) => setEditUser({ ...editUser, password: e.target.value || null })}
            helperText="Leave empty to keep current"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Generate NIS2 password">
                      <IconButton size="small" onClick={() => setEditUser({ ...editUser, password: generatePassword() })}>
                        <KeyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={handleSave}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('button.add')} User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl size="small">
            <InputLabel>Tenant</InputLabel>
            <Select value={newUser.tenant_id} label="Tenant" onChange={(e) => {
              const tid = Number(e.target.value);
              const tenant = tenants.find((t) => t.id === tid);
              setNewUser({
                ...newUser,
                tenant_id: tid,
                email: newUser.email || tenant?.email || '',
                name: newUser.name || tenant?.name || '',
              });
            }}>
              {tenants.map((t) => <MenuItem key={t.id} value={t.id}>{t.name} {t.email ? `(${t.email})` : ''}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label={t('auth.email')} type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
          <TextField size="small" label="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
          <TextField size="small" label={t('auth.password')} value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Generate NIS2 password">
                      <IconButton size="small" onClick={() => setNewUser({ ...newUser, password: generatePassword() })}>
                        <KeyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
            helperText={newUser.password ? `${newUser.password.length} chars` : 'Min 12 chars, upper+lower+digit+special'}
          />
          <FormControl size="small">
            <InputLabel>Role</InputLabel>
            <Select value={newUser.user_type} label="Role" onChange={(e) => setNewUser({ ...newUser, user_type: e.target.value })}>
              <MenuItem value="user">User (Client)</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              {isOwner && <MenuItem value="superadmin">Superadmin</MenuItem>}
              {isOwner && <MenuItem value="owner">Owner</MenuItem>}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={handleCreate}>{t('button.add')}</Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
