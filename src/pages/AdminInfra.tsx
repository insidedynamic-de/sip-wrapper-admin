/**
 * @file AdminInfra — Nodes, Instances, Settings for superadmin
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Chip, IconButton, Tooltip,
  CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert, Tabs, Tab, Grid2 as Grid, alpha, useTheme, LinearProgress,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import DnsIcon from '@mui/icons-material/Dns';
import SettingsIcon from '@mui/icons-material/Settings';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import api from '../api/client';
import Toast from '../components/Toast';

interface NodeRow {
  id: number; name: string; provider: string; region: string; ip: string;
  node_type: string; tenant_id: number | null; tenant_name: string;
  coolify_server_id: string; coolify_url: string;
  cpu: number; ram: number; disk: number; max_containers: number;
  instance_count: number; connections_used: number;
  status: string; is_active: boolean; created_at: string;
}

interface InstanceRow {
  id: number; product: string; name: string; node_id: number; node_name: string;
  instance_url: string; api_key: string; domain: string;
  coolify_app_id: string; docker_image: string;
  max_connections: number; infra_type: string; status: string; is_active: boolean;
  tenants: { tenant_id: number; tenant_name: string; connections: number }[];
  created_at: string;
}

interface SettingRow {
  id: number; category: string; key: string; value: string; value_full: string;
  description: string; updated_at: string;
}

const providers = ['hetzner', 'ionos', 'aws', 'azure', 'contabo'];
const nodeTypes = ['managed', 'dedicated'];
const infraTypes = ['shared', 'dedicated_container', 'dedicated_vm'];
const statuses = ['online', 'offline', 'maintenance', 'provisioning'];
const instanceStatuses = ['provisioning', 'online', 'offline', 'suspended', 'deleted'];

const settingsTemplate = [
  { category: 'hetzner', key: 'api_token', description: 'Hetzner Cloud API Token' },
  { category: 'ionos', key: 'api_token', description: 'IONOS Cloud API Token' },
  { category: 'coolify', key: 'url', description: 'Coolify Dashboard URL' },
  { category: 'coolify', key: 'api_token', description: 'Coolify API Token' },
  { category: 'cloudflare', key: 'api_key', description: 'Cloudflare Global API Key' },
  { category: 'cloudflare', key: 'email', description: 'Cloudflare Email' },
  { category: 'cloudflare', key: 'zone_id_flxo', description: 'Zone ID flxo.cloud' },
];

export default function AdminInfra() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Hetzner profiles
  const [hetznerProfiles, setHetznerProfiles] = useState<{ id: string; name: string; cpu: number; ram: number; disk: number; price_monthly: number; type: string }[]>([]);
  const [hetznerLocations, setHetznerLocations] = useState<{ id: string; name: string; city: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Dialogs
  const [nodeDialog, setNodeDialog] = useState(false);
  const [instanceDialog, setInstanceDialog] = useState(false);
  const [editNode, setEditNode] = useState<Record<string, unknown>>({});
  const [editInstance, setEditInstance] = useState<Record<string, unknown>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, iRes, sRes] = await Promise.all([
        api.get('/admin/infra/nodes').catch(() => ({ data: [] })),
        api.get('/admin/infra/instances').catch(() => ({ data: [] })),
        api.get('/admin/infra/settings').catch(() => ({ data: [] })),
      ]);
      setNodes(nRes.data || []);
      setInstances(iRes.data || []);
      setSettings(sRes.data || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Node CRUD ──
  const saveNode = async () => {
    try {
      if (editNode.id) {
        await api.put(`/admin/infra/nodes/${editNode.id}`, editNode);
      } else {
        await api.post('/admin/infra/nodes', editNode);
      }
      setToast({ open: true, message: 'Saved', severity: 'success' });
      setNodeDialog(false);
      fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  const deleteNode = async (id: number) => {
    if (!confirm('Delete node?')) return;
    try {
      await api.delete(`/admin/infra/nodes/${id}`);
      setToast({ open: true, message: 'Deleted', severity: 'success' });
      fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  // ── Instance CRUD ──
  const saveInstance = async () => {
    try {
      if (editInstance.id) {
        await api.put(`/admin/infra/instances/${editInstance.id}`, editInstance);
      } else {
        await api.post('/admin/infra/instances', editInstance);
      }
      setToast({ open: true, message: 'Saved', severity: 'success' });
      setInstanceDialog(false);
      fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
  };

  // ── Settings ──
  const saveSetting = async (category: string, key: string, value: string, description: string) => {
    try {
      await api.put(`/admin/infra/settings/${category}/${key}`, { value, description });
      setToast({ open: true, message: `${category}/${key} saved`, severity: 'success' });
      fetchAll();
    } catch {
      setToast({ open: true, message: 'Error', severity: 'error' });
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Infrastruktur</Typography>
        <IconButton onClick={fetchAll}><RefreshIcon /></IconButton>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<DnsIcon />} label={`Nodes (${nodes.length})`} iconPosition="start" />
        <Tab icon={<StorageIcon />} label={`Instanzen (${instances.length})`} iconPosition="start" />
        <Tab icon={<SettingsIcon />} label="Einstellungen" iconPosition="start" />
      </Tabs>

      {/* ── TAB 0: Nodes ── */}
      {tab === 0 && (
        <>
          <Box sx={{ mb: 2 }}>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => {
              setEditNode({ name: '', provider: 'hetzner', region: 'eu-central', ip: '', node_type: 'managed', cpu: 4, ram: 8192, disk: 160, max_containers: 30 });
              setNodeDialog(true);
            }}>Node hinzufügen</Button>
          </Box>
          <Grid container spacing={3}>
            {nodes.map((n) => {
              const usage = n.max_containers > 0 ? (n.instance_count / n.max_containers) * 100 : 0;
              return (
                <Grid size={{ xs: 12, md: 6 }} key={n.id}>
                  <Card sx={{
                    borderLeft: 4,
                    borderColor: n.status === 'online' ? 'success.main' : n.status === 'maintenance' ? 'warning.main' : 'error.main',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                    transition: 'all 0.15s',
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>{n.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {n.provider.toUpperCase()} · {n.region} · {n.ip}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Chip label={n.node_type} size="small" />
                          <Chip label={n.status} size="small" color={n.status === 'online' ? 'success' : 'default'} />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                        <Typography variant="body2">{n.cpu} vCPU</Typography>
                        <Typography variant="body2">{Math.round(n.ram / 1024)}GB RAM</Typography>
                        <Typography variant="body2">{n.disk}GB Disk</Typography>
                      </Box>
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption">Instanzen: {n.instance_count}/{n.max_containers}</Typography>
                          <Typography variant="caption">Connections: {n.connections_used}</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={usage}
                          color={usage > 80 ? 'error' : usage > 60 ? 'warning' : 'primary'}
                          sx={{ height: 6, borderRadius: 3 }} />
                      </Box>
                      {n.tenant_name && <Chip label={`Dedicated: ${n.tenant_name}`} size="small" color="info" sx={{ mb: 1 }} />}
                      <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                        <IconButton size="small" onClick={() => { setEditNode({ ...n } as Record<string, unknown>); setNodeDialog(true); }}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteNode(n.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* ── TAB 1: Instances ── */}
      {tab === 1 && (
        <>
          <Box sx={{ mb: 2 }}>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => {
              setEditInstance({ product: 'TalkHub', name: '', node_id: nodes[0]?.id || 0, domain: '', docker_image: 'ghcr.io/insidedynamic-de/sip-wrapper-allinone:latest', max_connections: 10, infra_type: 'shared', tenant_ids: [] });
              setInstanceDialog(true);
            }}>Instanz erstellen</Button>
          </Box>
          <TableContainer component={Card}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Domain</TableCell>
                  <TableCell>Node</TableCell>
                  <TableCell>Tenants</TableCell>
                  <TableCell>Conn</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instances.map((i) => (
                  <TableRow key={i.id} sx={{ opacity: i.is_active ? 1 : 0.4 }}>
                    <TableCell><strong>{i.product}</strong><br /><Typography variant="caption">{i.name}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{i.domain || '—'}</Typography></TableCell>
                    <TableCell>{i.node_name || '—'}</TableCell>
                    <TableCell>{i.tenants.map((t) => t.tenant_name).join(', ') || '—'}</TableCell>
                    <TableCell>{i.max_connections}</TableCell>
                    <TableCell><Chip label={i.status} size="small" color={i.status === 'online' ? 'success' : i.status === 'provisioning' ? 'warning' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => { setEditInstance({ ...i } as Record<string, unknown>); setInstanceDialog(true); }}><EditIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ── TAB 2: Settings (grouped by provider) ── */}
      {tab === 2 && (
        <Grid container spacing={3}>
          {[
            { category: 'coolify', title: 'Coolify', icon: '🔧', fields: [
              { key: 'url', description: 'Coolify URL', placeholder: 'https://cp.flxo.cloud' },
              { key: 'api_token', description: 'API Token', placeholder: '' },
            ]},
            { category: 'cloudflare', title: 'Cloudflare', icon: '☁️', fields: [
              { key: 'email', description: 'Email', placeholder: 'admin@example.com' },
              { key: 'api_key', description: 'Global API Key', placeholder: '' },
              { key: 'zone_id_flxo', description: 'Zone ID (flxo.cloud)', placeholder: '' },
            ]},
            { category: 'hetzner', title: 'Hetzner Cloud', icon: '🖥️', fields: [
              { key: 'api_token', description: 'API Token', placeholder: '' },
            ]},
            { category: 'ionos', title: 'IONOS', icon: '🖥️', fields: [
              { key: 'api_token', description: 'API Token', placeholder: '' },
            ]},
          ].map((block) => {
            const blockSettings = settings.filter((s) => s.category === block.category);
            const hasValues = block.fields.some((f) => {
              const existing = blockSettings.find((s) => s.key === f.key);
              return existing?.value_full;
            });
            return (
              <Grid size={{ xs: 12, md: 6 }} key={block.category}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Typography variant="h6">{block.icon} {block.title}</Typography>
                      {hasValues && <Chip label="Konfiguriert" size="small" color="success" />}
                    </Box>
                    {block.fields.map((f) => {
                      const existing = blockSettings.find((s) => s.key === f.key);
                      const fieldKey = `${block.category}/${f.key}`;
                      const isSecret = f.key.includes('token') || f.key.includes('key');
                      return (
                        <TextField
                          key={fieldKey}
                          size="small" fullWidth
                          label={f.description}
                          placeholder={f.placeholder}
                          defaultValue={existing?.value_full || ''}
                          type={isSecret && !showSecrets[fieldKey] ? 'password' : 'text'}
                          sx={{ mb: 2 }}
                          slotProps={{
                            input: {
                              endAdornment: isSecret ? (
                                <InputAdornment position="end">
                                  <IconButton size="small" onClick={() => setShowSecrets((p) => ({ ...p, [fieldKey]: !p[fieldKey] }))}>
                                    {showSecrets[fieldKey] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                  </IconButton>
                                </InputAdornment>
                              ) : undefined,
                            },
                          }}
                          onBlur={(e) => {
                            if (e.target.value !== (existing?.value_full || '')) {
                              saveSetting(block.category, f.key, e.target.value, f.description);
                            }
                          }}
                        />
                      );
                    })}
                    <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Button size="small" variant="outlined" onClick={() => {
                        // Save all fields in this block
                        block.fields.forEach((f) => {
                          const el = document.querySelector(`input[placeholder="${f.placeholder}"]`) as HTMLInputElement;
                          if (el?.value) saveSetting(block.category, f.key, el.value, f.description);
                        });
                        setToast({ open: true, message: `${block.title} gespeichert`, severity: 'success' });
                      }}>
                        <SaveIcon sx={{ fontSize: 16, mr: 0.5 }} /> Speichern
                      </Button>
                      <Button size="small" variant="contained" disabled={!hasValues} onClick={async () => {
                        try {
                          await api.post(`/admin/infra/test/${block.category}`);
                          setToast({ open: true, message: `${block.title}: Verbindung OK`, severity: 'success' });
                        } catch {
                          setToast({ open: true, message: `${block.title}: Verbindung fehlgeschlagen`, severity: 'error' });
                        }
                      }}>
                        Verbinden & Testen
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ── Node Dialog ── */}
      <Dialog open={nodeDialog} onClose={() => setNodeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editNode.id ? 'Node bearbeiten' : 'Node erstellen'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField size="small" label="Name" value={editNode.name || ''} onChange={(e) => setEditNode({ ...editNode, name: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select value={editNode.provider || 'hetzner'} label="Provider" onChange={(e) => {
                setEditNode({ ...editNode, provider: e.target.value });
                if (e.target.value === 'hetzner' && hetznerProfiles.length === 0) {
                  api.get('/admin/infra/providers/hetzner/profiles').then((res) => {
                    setHetznerProfiles(res.data.profiles || []);
                    setHetznerLocations(res.data.locations || []);
                  }).catch(() => {});
                }
              }}>
                {providers.map((p) => <MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Typ</InputLabel>
              <Select value={editNode.node_type || 'managed'} label="Typ" onChange={(e) => setEditNode({ ...editNode, node_type: e.target.value })}>
                {nodeTypes.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {/* Hetzner: profile + location select */}
          {editNode.provider === 'hetzner' && !editNode.id && (
            <>
              {hetznerProfiles.length === 0 ? (
                <Button size="small" onClick={() => {
                  api.get('/admin/infra/providers/hetzner/profiles').then((res) => {
                    setHetznerProfiles(res.data.profiles || []);
                    setHetznerLocations(res.data.locations || []);
                  }).catch(() => setToast({ open: true, message: 'Hetzner API Fehler', severity: 'error' }));
                }}>Profile laden...</Button>
              ) : (
                <>
                  <FormControl size="small">
                    <InputLabel>Server Profil</InputLabel>
                    <Select value={(editNode._server_type as string) || ''} label="Server Profil" onChange={(e) => {
                      const profile = hetznerProfiles.find((p) => p.id === e.target.value);
                      if (profile) {
                        setEditNode({ ...editNode, _server_type: profile.id, cpu: profile.cpu, ram: profile.ram, disk: profile.disk, _price: profile.price_monthly });
                      }
                    }}>
                      {hetznerProfiles.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name} — {p.cpu} vCPU, {Math.round(p.ram / 1024)}GB, {p.disk}GB — €{p.price_monthly}/mo
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small">
                    <InputLabel>Standort</InputLabel>
                    <Select value={(editNode._location as string) || 'nbg1'} label="Standort" onChange={(e) => setEditNode({ ...editNode, _location: e.target.value, region: e.target.value })}>
                      {hetznerLocations.map((l) => (
                        <MenuItem key={l.id} value={l.id}>{l.name} ({l.city})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </>
          )}

          {/* Manual fields (for edit or non-Hetzner) */}
          {(editNode.id || editNode.provider !== 'hetzner') && (
            <>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="IP" value={editNode.ip || ''} onChange={(e) => setEditNode({ ...editNode, ip: e.target.value })} fullWidth />
                <TextField size="small" label="Region" value={editNode.region || ''} onChange={(e) => setEditNode({ ...editNode, region: e.target.value })} fullWidth />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField size="small" label="vCPU" type="number" value={editNode.cpu || 0} onChange={(e) => setEditNode({ ...editNode, cpu: Number(e.target.value) })} />
                <TextField size="small" label="RAM (MB)" type="number" value={editNode.ram || 0} onChange={(e) => setEditNode({ ...editNode, ram: Number(e.target.value) })} />
                <TextField size="small" label="Disk (GB)" type="number" value={editNode.disk || 0} onChange={(e) => setEditNode({ ...editNode, disk: Number(e.target.value) })} />
              </Box>
            </>
          )}

          <TextField size="small" label="Max Containers" type="number" value={editNode.max_containers || 30} onChange={(e) => setEditNode({ ...editNode, max_containers: Number(e.target.value) })} />

          {!!editNode.id && (
            <>
              <TextField size="small" label="IP" value={editNode.ip || ''} onChange={(e) => setEditNode({ ...editNode, ip: e.target.value })} />
              <TextField size="small" label="Coolify Server ID" value={editNode.coolify_server_id || ''} onChange={(e) => setEditNode({ ...editNode, coolify_server_id: e.target.value })} />
              <FormControl size="small">
                <InputLabel>Status</InputLabel>
                <Select value={editNode.status || 'online'} label="Status" onChange={(e) => setEditNode({ ...editNode, status: e.target.value })}>
                  {statuses.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNodeDialog(false)}>{t('button.cancel')}</Button>
          {/* Hetzner: create VM via API */}
          {editNode.provider === 'hetzner' && !editNode.id && (editNode._server_type as string) && (
            <Button variant="contained" color="success" disabled={creating} onClick={async () => {
              setCreating(true);
              try {
                const res = await api.post('/admin/infra/nodes/create-from-provider', {
                  name: editNode.name || 'node-hetzner',
                  server_type: editNode._server_type,
                  location: editNode._location || 'nbg1',
                });
                setToast({ open: true, message: `VM erstellt! IP: ${res.data.ip}${res.data.root_password ? ` Passwort: ${res.data.root_password}` : ''}`, severity: 'success' });
                if (res.data.root_password) {
                  alert(`Server erstellt!\n\nIP: ${res.data.ip}\nRoot Passwort: ${res.data.root_password}\n\nBitte speichern!`);
                }
                setNodeDialog(false);
                fetchAll();
              } catch (err: unknown) {
                const e = err as { response?: { data?: { detail?: string } } };
                setToast({ open: true, message: e?.response?.data?.detail || 'Fehler', severity: 'error' });
              }
              setCreating(false);
            }}>
              {creating ? <CircularProgress size={16} /> : 'VM erstellen'}
            </Button>
          )}
          <Button variant="contained" onClick={saveNode}>
            {editNode.id ? t('button.save') : 'Manuell speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Instance Dialog ── */}
      <Dialog open={instanceDialog} onClose={() => setInstanceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editInstance.id ? 'Instanz bearbeiten' : 'Instanz erstellen'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField size="small" label="Product" value={editInstance.product || ''} onChange={(e) => setEditInstance({ ...editInstance, product: e.target.value })} />
          <TextField size="small" label="Name" value={editInstance.name || ''} onChange={(e) => setEditInstance({ ...editInstance, name: e.target.value })} />
          <FormControl size="small">
            <InputLabel>Node</InputLabel>
            <Select value={editInstance.node_id || ''} label="Node" onChange={(e) => setEditInstance({ ...editInstance, node_id: Number(e.target.value) })}>
              {nodes.map((n) => <MenuItem key={n.id} value={n.id}>{n.name} ({n.provider})</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Domain" value={editInstance.domain || ''} onChange={(e) => setEditInstance({ ...editInstance, domain: e.target.value })} placeholder="krause.talkhub.flxo.cloud" />
          <TextField size="small" label="Docker Image" value={editInstance.docker_image || ''} onChange={(e) => setEditInstance({ ...editInstance, docker_image: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField size="small" label="Max Connections" type="number" value={editInstance.max_connections || 0} onChange={(e) => setEditInstance({ ...editInstance, max_connections: Number(e.target.value) })} />
            <FormControl size="small" fullWidth>
              <InputLabel>Infra Type</InputLabel>
              <Select value={editInstance.infra_type || 'shared'} label="Infra Type" onChange={(e) => setEditInstance({ ...editInstance, infra_type: e.target.value })}>
                {infraTypes.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          {!!editInstance.id && (
            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select value={editInstance.status || 'provisioning'} label="Status" onChange={(e) => setEditInstance({ ...editInstance, status: e.target.value })}>
                {instanceStatuses.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstanceDialog(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={saveInstance}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
