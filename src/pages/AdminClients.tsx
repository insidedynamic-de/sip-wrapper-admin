/**
 * @file AdminClients — Superadmin: manage tenants, link to LicServer
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Chip, IconButton, Tooltip,
  CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../api/client';
import Toast from '../components/Toast';

interface TenantRow {
  id: number;
  name: string;
  tenant_type: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  lic_client_id: number | null;
  user_count: number;
  created_at: string;
}

export default function AdminClients() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Record<string, string | number | null>>({});
  const [linking, setLinking] = useState<number | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const fetchTenants = useCallback(async () => {
    try {
      const res = await api.get('/admin/tenants');
      setTenants(res.data);
    } catch { setTenants([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleLink = async (tenantId: number) => {
    setLinking(tenantId);
    try {
      const res = await api.post(`/admin/tenants/${tenantId}/link-licserver`);
      setToast({ open: true, message: `Linked: lic_client_id=${res.data.lic_client_id}`, severity: 'success' });
      fetchTenants();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
    setLinking(null);
  };

  const openEdit = async (tenantId: number) => {
    try {
      const res = await api.get(`/admin/tenants/${tenantId}`);
      setEditTenant(res.data);
      setEditOpen(true);
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    try {
      await api.put(`/admin/tenants/${editTenant.id}`, editTenant);
      setToast({ open: true, message: 'Saved', severity: 'success' });
      setEditOpen(false);
      fetchTenants();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{t('admin.clients')}</Typography>
        <IconButton onClick={fetchTenants}><RefreshIcon /></IconButton>
      </Box>

      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>{t('auth.company_name')}</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>{t('auth.email')}</TableCell>
              <TableCell>{t('auth.city')}</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>LicServer</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.id}</TableCell>
                <TableCell><strong>{t.name}</strong></TableCell>
                <TableCell><Chip label={t.tenant_type} size="small" color={t.tenant_type === 'provider' ? 'primary' : 'default'} /></TableCell>
                <TableCell>{t.email}</TableCell>
                <TableCell>{t.city} {t.country}</TableCell>
                <TableCell>{t.user_count}</TableCell>
                <TableCell>
                  {t.lic_client_id
                    ? <Chip label={`#${t.lic_client_id}`} size="small" color="success" />
                    : <Chip label="—" size="small" color="default" />
                  }
                </TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(t.id)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  {!t.lic_client_id && (
                    <Tooltip title="Link to LicServer">
                      <IconButton size="small" color="primary" onClick={() => handleLink(t.id)} disabled={linking === t.id}>
                        {linking === t.id ? <CircularProgress size={16} /> : <LinkIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tenant #{editTenant.id}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField size="small" label={t('auth.company_name')} value={editTenant.name || ''} onChange={(e) => setEditTenant({ ...editTenant, name: e.target.value })} />
          <TextField size="small" label={t('auth.email')} value={editTenant.email || ''} onChange={(e) => setEditTenant({ ...editTenant, email: e.target.value })} />
          <TextField size="small" label={t('auth.phone')} value={editTenant.phone || ''} onChange={(e) => setEditTenant({ ...editTenant, phone: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField size="small" label={t('auth.address')} value={editTenant.address || ''} onChange={(e) => setEditTenant({ ...editTenant, address: e.target.value })} fullWidth />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField size="small" label={t('auth.zip')} value={editTenant.zip || ''} onChange={(e) => setEditTenant({ ...editTenant, zip: e.target.value })} sx={{ width: 120 }} />
            <TextField size="small" label={t('auth.city')} value={editTenant.city || ''} onChange={(e) => setEditTenant({ ...editTenant, city: e.target.value })} fullWidth />
            <TextField size="small" label={t('auth.country')} value={editTenant.country || ''} onChange={(e) => setEditTenant({ ...editTenant, country: e.target.value })} sx={{ width: 100 }} />
          </Box>
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select value={editTenant.tenant_type || 'company'} label="Type" onChange={(e) => setEditTenant({ ...editTenant, tenant_type: e.target.value })}>
              <MenuItem value="company">Company</MenuItem>
              <MenuItem value="partner">Partner</MenuItem>
              <MenuItem value="provider">Provider</MenuItem>
            </Select>
          </FormControl>
          {editTenant.lic_client_id && (
            <Alert severity="info">LicServer Client ID: #{editTenant.lic_client_id}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={handleSave}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
