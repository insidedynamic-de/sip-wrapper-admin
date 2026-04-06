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
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AddIcon from '@mui/icons-material/Add';
import api from '../api/client';
import Toast from '../components/Toast';

interface TenantRow {
  id: number;
  name: string;
  tenant_type: string;
  parent_id: number | null;
  parent_name: string;
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
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<'server' | 'clients'>('server');
  const [licServers, setLicServers] = useState<{ id: number; name: string; product_type: string }[]>([]);
  const [selectedServer, setSelectedServer] = useState<number>(0);
  const [unlinked, setUnlinked] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState<number | null>(null);
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const fetchTenants = useCallback(async () => {
    try {
      const res = await api.get('/admin/tenants');
      setTenants(res.data);
    } catch { setTenants([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const openImportDialog = async () => {
    try {
      const res = await api.get('/admin/licservers');
      setLicServers((res.data || []).filter((s: { is_active: boolean }) => s.is_active));
      setImportStep('server');
      setSelectedServer(0);
      setUnlinked([]);
      setImportOpen(true);
    } catch {
      setToast({ open: true, message: 'Failed to load LicServers', severity: 'error' });
    }
  };

  const loadUnlinked = async (serverId: number) => {
    setSelectedServer(serverId);
    setLoadingUnlinked(true);
    try {
      const res = await api.get(`/admin/licservers/${serverId}/unlinked`);
      setUnlinked(res.data || []);
      setImportStep('clients');
    } catch {
      setToast({ open: true, message: 'Failed to load clients', severity: 'error' });
    }
    setLoadingUnlinked(false);
  };

  const handleImport = async (licClientId: number) => {
    setImporting(licClientId);
    try {
      const res = await api.post('/admin/licserver/import', { lic_server_id: selectedServer, lic_client_id: licClientId });
      const pwd = res.data.user_password;
      const msg = pwd
        ? `Imported: ${res.data.name}\nUser: ${res.data.user_email}\nPassword: ${pwd}`
        : `Imported: ${res.data.name} → tenant #${res.data.tenant_id}`;
      if (pwd) {
        // Show credentials in alert so admin can copy
        alert(`User created:\n\nEmail: ${res.data.user_email}\nPassword: ${pwd}\n\nPlease save this password — it won't be shown again.`);
      }
      setToast({ open: true, message: `Imported: ${res.data.name}`, severity: 'success' });
      setUnlinked((prev) => prev.filter((c) => c.id !== licClientId));
      fetchTenants();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
    setImporting(null);
  };

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTenantId, setLinkTenantId] = useState(0);

  const openLinkDialog = async (tenantId: number) => {
    setLinkTenantId(tenantId);
    try {
      const res = await api.get('/admin/licservers');
      setLicServers((res.data || []).filter((s: { is_active: boolean }) => s.is_active));
      setLinkOpen(true);
    } catch { /* */ }
  };

  const handleLink = async (serverId: number) => {
    setLinking(serverId);
    try {
      const res = await api.post(`/admin/tenants/${linkTenantId}/link-licserver`, { lic_server_id: serverId });
      setToast({ open: true, message: `Linked to ${res.data.lic_server}: client #${res.data.lic_client_id}`, severity: 'success' });
      setLinkOpen(false);
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
      // Send only editable fields
      const { name, email, phone, address, zip, city, country, vat_id, contact_person,
        website, invoice_name, invoice_address, invoice_zip, invoice_city,
        invoice_country, invoice_email, tenant_type, parent_id } = editTenant;
      await api.put(`/admin/tenants/${editTenant.id}`, {
        name, email, phone, address, zip, city, country, vat_id, contact_person,
        website, invoice_name, invoice_address, invoice_zip, invoice_city,
        invoice_country, invoice_email, tenant_type, parent_id,
      });
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<CloudDownloadIcon />} onClick={openImportDialog}>
            Import from LicServer
          </Button>
          <IconButton onClick={fetchTenants}><RefreshIcon /></IconButton>
        </Box>
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
                <TableCell>
                  <Chip label={t.tenant_type} size="small"
                    color={t.tenant_type === 'provider' ? 'primary' : t.tenant_type === 'partner' ? 'warning' : 'default'} />
                  {t.parent_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      ← {t.parent_name}
                    </Typography>
                  )}
                </TableCell>
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
                      <IconButton size="small" color="primary" onClick={() => openLinkDialog(t.id)} disabled={linking !== null}>
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
              <MenuItem value="company">Kunde</MenuItem>
              <MenuItem value="partner">Partner</MenuItem>
              <MenuItem value="provider">Provider</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Partner (optional)</InputLabel>
            <Select value={editTenant.parent_id || ''} label="Partner (optional)" onChange={(e) => setEditTenant({ ...editTenant, parent_id: e.target.value ? Number(e.target.value) : null })}>
              <MenuItem value="">— Kein Partner —</MenuItem>
              {tenants.filter((tt) => tt.tenant_type === 'partner').map((tt) => (
                <MenuItem key={tt.id} value={tt.id}>{tt.name}</MenuItem>
              ))}
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

      {/* Link to LicServer Dialog */}
      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Link to LicServer</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            {licServers.map((s) => (
              <Button key={s.id} variant="outlined" fullWidth onClick={() => handleLink(s.id)}
                disabled={linking !== null} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
                {s.name} {s.product_type && <Chip label={s.product_type} size="small" sx={{ ml: 1 }} />}
                {linking === s.id && <CircularProgress size={16} sx={{ ml: 'auto' }} />}
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setLinkOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      {/* Import from LicServer Dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import from LicServer</DialogTitle>
        <DialogContent>
          {importStep === 'server' && (
            <>
              {licServers.length === 0 ? (
                <Alert severity="warning" sx={{ mt: 1 }}>No LicServers configured. Add one in Admin → LicServer.</Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                  {licServers.map((s) => (
                    <Button key={s.id} variant="outlined" fullWidth onClick={() => loadUnlinked(s.id)}
                      disabled={loadingUnlinked}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none', py: 1.5 }}>
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="subtitle2">{s.name}</Typography>
                        {s.product_type && <Chip label={s.product_type} size="small" sx={{ ml: 1 }} />}
                      </Box>
                      {loadingUnlinked && selectedServer === s.id && <CircularProgress size={16} sx={{ ml: 'auto' }} />}
                    </Button>
                  ))}
                </Box>
              )}
            </>
          )}
          {importStep === 'clients' && (
            <>
              <Button size="small" onClick={() => setImportStep('server')} sx={{ mb: 1 }}>← Back</Button>
              {unlinked.length === 0 ? (
                <Alert severity="info">All clients on this server are already linked.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Licenses</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {unlinked.map((c) => (
                        <TableRow key={c.id as number}>
                          <TableCell>{c.id as number}</TableCell>
                          <TableCell><strong>{c.name as string}</strong></TableCell>
                          <TableCell>{c.email as string}</TableCell>
                          <TableCell>{c.license_count as number}</TableCell>
                          <TableCell>
                            <Button size="small" variant="contained"
                              startIcon={importing === c.id ? <CircularProgress size={14} /> : <AddIcon />}
                              disabled={importing !== null}
                              onClick={() => handleImport(c.id as number)}>
                              Import
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
