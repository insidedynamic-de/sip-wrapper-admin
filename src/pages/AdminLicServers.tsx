/**
 * @file AdminLicServers — Manage LicServer instances, test connections, import clients
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Chip, IconButton, Tooltip,
  CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Grid2 as Grid, alpha, useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StorageIcon from '@mui/icons-material/Storage';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../api/client';
import Toast from '../components/Toast';

interface LicServerRow {
  id: number;
  name: string;
  url: string;
  console_key: string;
  console_key_full: string;
  product_type: string;
  is_active: boolean;
  created_at: string;
}

interface UnlinkedClient {
  id: number;
  name: string;
  email: string;
  license_count: number;
}

const empty = { name: '', url: '', console_key: '', product_type: '' };

export default function AdminLicServers() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [servers, setServers] = useState<LicServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(0);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, boolean>>({});
  const [unlinked, setUnlinked] = useState<UnlinkedClient[]>([]);
  const [importServerId, setImportServerId] = useState(0);
  const [importing, setImporting] = useState<number | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const fetchServers = useCallback(async () => {
    try {
      const res = await api.get('/admin/licservers');
      setServers(res.data || []);
    } catch { setServers([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const handleCreate = async () => {
    try {
      const res = await api.post('/admin/licservers', form);
      setToast({ open: true, message: `Created. Connection: ${res.data.connection_ok ? 'OK' : 'FAILED'}`, severity: res.data.connection_ok ? 'success' : 'error' });
      setCreateOpen(false);
      setForm(empty);
      fetchServers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  const handleEdit = async () => {
    try {
      await api.put(`/admin/licservers/${editId}`, form);
      setToast({ open: true, message: 'Saved', severity: 'success' });
      setEditOpen(false);
      fetchServers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete LicServer "${name}"? Links to tenants will be removed.`)) return;
    try {
      await api.delete(`/admin/licservers/${id}`);
      setToast({ open: true, message: 'Deleted', severity: 'success' });
      fetchServers();
    } catch { setToast({ open: true, message: 'Error', severity: 'error' }); }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    try {
      const res = await api.post(`/admin/licservers/${id}/test`);
      setTestResult((prev) => ({ ...prev, [id]: res.data.success }));
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: false }));
    }
    setTesting(null);
  };

  const openImport = async (serverId: number) => {
    setImportServerId(serverId);
    try {
      const res = await api.get(`/admin/licservers/${serverId}/unlinked`);
      setUnlinked(res.data || []);
      setImportOpen(true);
    } catch {
      setToast({ open: true, message: 'Failed to load clients', severity: 'error' });
    }
  };

  const handleImport = async (licClientId: number) => {
    setImporting(licClientId);
    try {
      const res = await api.post('/admin/licserver/import', { lic_server_id: importServerId, lic_client_id: licClientId });
      setToast({ open: true, message: `Imported: ${res.data.name} → tenant #${res.data.tenant_id}`, severity: 'success' });
      setUnlinked((prev) => prev.filter((c) => c.id !== licClientId));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
    setImporting(null);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{t('admin.licservers')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setForm(empty); setCreateOpen(true); }}>
            {t('button.add')}
          </Button>
          <IconButton onClick={fetchServers}><RefreshIcon /></IconButton>
        </Box>
      </Box>

      {servers.length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 6 }}>
          <StorageIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">No LicServers configured</Typography>
        </CardContent></Card>
      ) : (
        <Grid container spacing={3}>
          {servers.map((s) => (
            <Grid size={{ xs: 12, md: 6 }} key={s.id}>
              <Card sx={{
                borderLeft: 4,
                borderColor: s.is_active ? 'success.main' : 'text.disabled',
                transition: 'transform 0.15s, box-shadow 0.15s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.08), display: 'flex' }}>
                        <StorageIcon color="primary" />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.url}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {s.product_type && <Chip label={s.product_type} size="small" />}
                      <Chip label={s.is_active ? 'Active' : 'Inactive'} size="small" color={s.is_active ? 'success' : 'default'} />
                    </Box>
                  </Box>

                  {/* Key */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1, bgcolor: alpha(theme.palette.text.primary, 0.03), borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', flex: 1 }}>{s.console_key}</Typography>
                    <Tooltip title="Copy full key">
                      <IconButton size="small" onClick={() => { navigator.clipboard.writeText(s.console_key_full); setToast({ open: true, message: 'Copied', severity: 'success' }); }}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Connection test result */}
                  {testResult[s.id] !== undefined && (
                    <Alert severity={testResult[s.id] ? 'success' : 'error'} sx={{ mb: 1.5, py: 0 }}>
                      {testResult[s.id] ? 'Connection OK' : 'Connection FAILED'}
                    </Alert>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Button size="small" onClick={() => handleTest(s.id)} disabled={testing === s.id}
                      startIcon={testing === s.id ? <CircularProgress size={14} /> : (testResult[s.id] === true ? <CheckCircleIcon /> : testResult[s.id] === false ? <ErrorIcon /> : undefined)}>
                      Test
                    </Button>
                    <Button size="small" startIcon={<CloudDownloadIcon />} onClick={() => openImport(s.id)}>
                      Import
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <IconButton size="small" onClick={() => { setEditId(s.id); setForm({ name: s.name, url: s.url, console_key: s.console_key_full, product_type: s.product_type }); setEditOpen(true); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(s.id, s.name)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      {(createOpen || editOpen) && (
        <Dialog open onClose={() => { setCreateOpen(false); setEditOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle>{createOpen ? 'Add LicServer' : 'Edit LicServer'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField size="small" label="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://lic.linkify.cloud" required />
            <TextField size="small" label="Console API Key (X-Console-Key)" value={form.console_key} onChange={(e) => setForm({ ...form, console_key: e.target.value })} required
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }} />
            <TextField size="small" label="Product Type (optional)" value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })} placeholder="linkify, neyto, etc." />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setCreateOpen(false); setEditOpen(false); }}>{t('button.cancel')}</Button>
            <Button variant="contained" onClick={createOpen ? handleCreate : handleEdit}>{createOpen ? t('button.add') : t('button.save')}</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Import Dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import from LicServer</DialogTitle>
        <DialogContent>
          {unlinked.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>All clients already linked.</Alert>
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
                    <TableRow key={c.id}>
                      <TableCell>{c.id}</TableCell>
                      <TableCell><strong>{c.name}</strong></TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.license_count}</TableCell>
                      <TableCell>
                        <Button size="small" variant="contained" startIcon={importing === c.id ? <CircularProgress size={14} /> : <AddIcon />}
                          disabled={importing !== null} onClick={() => handleImport(c.id)}>
                          Import
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
