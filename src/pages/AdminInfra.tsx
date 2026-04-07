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
  Alert, Tabs, Tab, Grid2 as Grid, alpha, useTheme, LinearProgress, Autocomplete,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
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
  const [templates, setTemplates] = useState<{ id: number; product: string; docker_image: string; ports: { port: string | number; protocol: string; description: string }[]; cf_proxy: boolean; domain_prefix: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Hetzner profiles
  const [hetznerProfiles, setHetznerProfiles] = useState<{ id: string; name: string; cpu: number; ram: number; disk: number; price_monthly: number; type: string }[]>([]);
  const [hetznerLocations, setHetznerLocations] = useState<{ id: string; name: string; city: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Dialogs
  const [nodeDialog, setNodeDialog] = useState(false);
  const [instanceDialog, setInstanceDialog] = useState(false);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [editNode, setEditNode] = useState<any>({});
  const [editInstance, setEditInstance] = useState<any>({});
  const [editTemplate, setEditTemplate] = useState<any>({});
  const [templateDialog, setTemplateDialog] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<string[]>([]);
  const [tenantList, setTenantList] = useState<{ id: number; name: string; tenant_type: string }[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, iRes, sRes, tRes, tenantsRes] = await Promise.all([
        api.get('/admin/infra/nodes').catch(() => ({ data: [] })),
        api.get('/admin/infra/instances').catch(() => ({ data: [] })),
        api.get('/admin/infra/settings').catch(() => ({ data: [] })),
        api.get('/admin/infra/templates').catch(() => ({ data: [] })),
        api.get('/admin/tenants').catch(() => ({ data: [] })),
      ]);
      setNodes(nRes.data || []);
      setInstances(iRes.data || []);
      setSettings(sRes.data || []);
      setTemplates(tRes.data || []);
      setTenantList((tenantsRes.data || []).map((t: any) => ({ id: t.id, name: t.name, tenant_type: t.tenant_type })));
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
        <Tab icon={<DescriptionIcon />} label={`Templates (${templates.length})`} iconPosition="start" />
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
                      {n.coolify_server_id && <Chip label={`Coolify: ${n.coolify_server_id}`} size="small" variant="outlined" sx={{ mb: 0.5, fontSize: 10 }} />}
                      {n.tenant_name && <Chip label={`Dedicated: ${n.tenant_name}`} size="small" color="info" sx={{ mb: 1 }} />}
                      <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                        <Button size="small" onClick={async () => {
                          try {
                            const res = await api.post(`/admin/infra/nodes/${n.id}/check`);
                            setToast({ open: true, message: `${n.name}: ${res.data.status}`, severity: res.data.success ? 'success' : 'error' });
                            fetchAll();
                          } catch { setToast({ open: true, message: 'Check failed', severity: 'error' }); }
                        }}>Status</Button>
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

      {/* ── TAB 2: Templates ── */}
      {tab === 2 && (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => {
              setEditTemplate({ product: '', docker_image: '', ports: [], cf_proxy: true, domain_prefix: '', description: '' });
              if (catalogProducts.length === 0) {
                api.get('/catalog').then((res) => {
                  const names = [...new Set((res.data || []).map((p: { product: string }) => p.product))] as string[];
                  setCatalogProducts(names);
                }).catch(() => {});
              }
              setTemplateDialog(true);
            }}>Template hinzufügen</Button>
            <Button variant="outlined" size="small" onClick={async () => {
              try {
                await api.post('/admin/infra/templates/seed');
                setToast({ open: true, message: 'Default templates created', severity: 'success' });
                fetchAll();
              } catch { setToast({ open: true, message: 'Error', severity: 'error' }); }
            }}>Defaults laden</Button>
          </Box>
          <Grid container spacing={3}>
            {templates.map((tmpl) => (
              <Grid size={{ xs: 12, md: 6 }} key={tmpl.id}>
                <Card sx={{ '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }, transition: 'all 0.15s' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>{tmpl.product}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip label={tmpl.cf_proxy ? 'CF Proxy' : 'DNS only'} size="small" color={tmpl.cf_proxy ? 'success' : 'warning'} />
                        <Chip label={tmpl.domain_prefix || '—'} size="small" variant="outlined" />
                      </Box>
                    </Box>
                    {tmpl.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{tmpl.description}</Typography>}
                    {tmpl.docker_image && (
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mb: 1, color: 'text.secondary' }}>
                        {tmpl.docker_image}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      {tmpl.ports.map((p, i) => (
                        <Chip key={i} label={`${p.port}/${p.protocol}`} size="small" variant="outlined"
                          title={p.description} sx={{ fontSize: 11 }} />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <IconButton size="small" onClick={() => {
                        setEditTemplate({ ...tmpl });
                        if (catalogProducts.length === 0) {
                          api.get('/catalog').then((res) => {
                            setCatalogProducts([...new Set((res.data || []).map((p: { product: string }) => p.product))] as string[]);
                          }).catch(() => {});
                        }
                        setTemplateDialog(true);
                      }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={async () => {
                        if (!confirm(`Template "${tmpl.product}" löschen?`)) return;
                        try {
                          await api.delete(`/admin/infra/templates/${tmpl.id}`);
                          setToast({ open: true, message: 'Gelöscht', severity: 'success' });
                          fetchAll();
                        } catch { setToast({ open: true, message: 'Fehler', severity: 'error' }); }
                      }}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* ── TAB 3: Settings (grouped by provider) ── */}
      {tab === 3 && (
        <Grid container spacing={3}>
          {[
            { category: 'coolify', title: 'Coolify', icon: '🔧', fields: [
              { key: 'url', description: 'Coolify URL', placeholder: 'https://cp.flxo.cloud' },
              { key: 'api_token', description: 'API Token', placeholder: '' },
            ], profiles: false },
            { category: 'cloudflare', title: 'Cloudflare', icon: '☁️', fields: [
              { key: 'email', description: 'Email', placeholder: 'admin@example.com' },
              { key: 'api_key', description: 'Global API Key', placeholder: '' },
              { key: 'zone_id_flxo', description: 'Zone ID (flxo.cloud)', placeholder: '' },
              { key: 'root_domain', description: 'Root Domain für Instanzen', placeholder: 'flxo.cloud' },
            ], profiles: false },
            { category: 'hetzner', title: 'Hetzner Cloud', icon: '🖥️', fields: [
              { key: 'api_token', description: 'API Token', placeholder: '' },
            ], profiles: true },
            { category: 'ionos', title: 'IONOS', icon: '🖥️', fields: [
              { key: 'api_token', description: 'API Token', placeholder: '' },
            ], profiles: true },
            { category: 'aws', title: 'AWS', icon: '☁️', fields: [
              { key: 'access_key', description: 'Access Key ID', placeholder: '' },
              { key: 'secret_key', description: 'Secret Access Key', placeholder: '' },
              { key: 'region', description: 'Default Region', placeholder: 'eu-central-1' },
            ], profiles: true },
            { category: 'azure', title: 'Azure', icon: '☁️', fields: [
              { key: 'tenant_id', description: 'Tenant ID', placeholder: '' },
              { key: 'client_id', description: 'Client ID', placeholder: '' },
              { key: 'client_secret', description: 'Client Secret', placeholder: '' },
              { key: 'subscription_id', description: 'Subscription ID', placeholder: '' },
            ], profiles: true },
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
                    {/* Profile presets for cloud providers */}
                    {block.profiles && (() => {
                      const tiers = [
                        { key: 'profile_low', label: 'Low' },
                        { key: 'profile_mid', label: 'Mittel' },
                        { key: 'profile_high', label: 'Hoch' },
                        { key: 'profile_premium', label: 'Premium' },
                      ];
                      const blockProfiles = block.category === 'hetzner' ? hetznerProfiles : [];
                      const hasApiProfiles = block.category === 'hetzner'; // only hetzner has API profiles for now
                      return (
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2">Server-Profile</Typography>
                            {hasApiProfiles && blockProfiles.length === 0 && (
                              <Button size="small" onClick={() => {
                                api.get(`/admin/infra/providers/${block.category}/profiles`).then((res) => {
                                  if (block.category === 'hetzner') {
                                    setHetznerProfiles(res.data.profiles || []);
                                    setHetznerLocations(res.data.locations || []);
                                  }
                                }).catch(() => setToast({ open: true, message: 'API Fehler', severity: 'error' }));
                              }}>Profile laden</Button>
                            )}
                          </Box>
                          {tiers.map((tier) => {
                            const savedValue = settings.find((s) => s.category === block.category && s.key === tier.key)?.value_full || '';
                            return (
                              <Box key={tier.key} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                                <Chip label={tier.label} size="small" sx={{ minWidth: 70 }} color={tier.key === 'profile_premium' ? 'error' : tier.key === 'profile_high' ? 'warning' : tier.key === 'profile_mid' ? 'primary' : 'default'} />
                                {hasApiProfiles && blockProfiles.length > 0 ? (
                                  <FormControl size="small" fullWidth>
                                    <Select value={savedValue} displayEmpty onChange={(e) => saveSetting(block.category, tier.key, e.target.value as string, `${tier.label} profile`)}>
                                      <MenuItem value="">— {tier.label} —</MenuItem>
                                      {blockProfiles.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                          {p.id} — {p.cpu} vCPU ({String((p as Record<string, unknown>).cpu_type || 'shared')}), {String((p as Record<string, unknown>).ram_gb || Math.round(p.ram / 1024))}GB RAM, {p.disk}GB {String((p as Record<string, unknown>).storage || 'SSD')}, {String((p as Record<string, unknown>).traffic_tb || '?')}TB — €{p.price_monthly}/mo
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                ) : (
                                  <TextField size="small" fullWidth placeholder="z.B. VPS L+ (6 vCPU, 8GB)"
                                    defaultValue={savedValue}
                                    onBlur={(e) => { if (e.target.value !== savedValue) saveSetting(block.category, tier.key, e.target.value, `${tier.label} profile`); }}
                                  />
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      );
                    })()}

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

      {/* ── Template Dialog ── */}
      <Dialog open={templateDialog} onClose={() => setTemplateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTemplate.id ? 'Template bearbeiten' : 'Template hinzufügen'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Autocomplete size="small" freeSolo
            options={catalogProducts}
            value={(editTemplate.product as string) || ''}
            onInputChange={(_, v) => setEditTemplate({ ...editTemplate, product: v })}
            renderInput={(params) => <TextField {...params} label="Product" />}
          />
          <TextField size="small" label="Docker Image" value={editTemplate.docker_image || ''} onChange={(e) => setEditTemplate({ ...editTemplate, docker_image: e.target.value })} placeholder="ghcr.io/..." />
          <TextField size="small" label="Domain Prefix" value={editTemplate.domain_prefix || ''} onChange={(e) => setEditTemplate({ ...editTemplate, domain_prefix: e.target.value })} placeholder="talkhub → {client}.talkhub.flxo.cloud" />
          <FormControl size="small">
            <InputLabel>Cloudflare</InputLabel>
            <Select value={editTemplate.cf_proxy === false ? 'dns' : 'proxy'} label="Cloudflare" onChange={(e) => setEditTemplate({ ...editTemplate, cf_proxy: e.target.value === 'proxy' })}>
              <MenuItem value="proxy">CF Proxy (HTTPS only products)</MenuItem>
              <MenuItem value="dns">DNS only (SIP/UDP products)</MenuItem>
            </Select>
          </FormControl>
          {/* Ports GUI */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Ports</Typography>
              <Button size="small" onClick={() => {
                const ports = Array.isArray(editTemplate.ports) ? [...editTemplate.ports as { port: string; protocol: string; description: string }[]] : [];
                ports.push({ port: '', protocol: 'tcp', description: '' });
                setEditTemplate({ ...editTemplate, ports });
              }}>+ Port</Button>
            </Box>
            {(Array.isArray(editTemplate.ports) ? editTemplate.ports as { port: string; protocol: string; description: string }[] : []).map((p, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 0.5, mb: 0.5, alignItems: 'center' }}>
                <TextField size="small" value={p.port} sx={{ width: 100, '& input': { fontSize: 12, py: 0.5 } }}
                  placeholder="5060"
                  onChange={(e) => {
                    const ports = [...editTemplate.ports as { port: string; protocol: string; description: string }[]];
                    ports[i] = { ...ports[i], port: e.target.value };
                    setEditTemplate({ ...editTemplate, ports });
                  }} />
                <Select size="small" value={p.protocol} sx={{ minWidth: 90, fontSize: 12, '& .MuiSelect-select': { py: 0.5 } }} onChange={(e) => {
                    const ports = [...editTemplate.ports as { port: string; protocol: string; description: string }[]];
                    ports[i] = { ...ports[i], protocol: e.target.value };
                    setEditTemplate({ ...editTemplate, ports });
                  }}>
                  <MenuItem value="tcp" sx={{ fontSize: 12 }}>TCP</MenuItem>
                  <MenuItem value="udp" sx={{ fontSize: 12 }}>UDP</MenuItem>
                  <MenuItem value="tcp+udp" sx={{ fontSize: 12 }}>Both</MenuItem>
                </Select>
                <TextField size="small" value={p.description} sx={{ flex: 1, '& input': { fontSize: 12, py: 0.5 } }}
                  placeholder="SIP"
                  onChange={(e) => {
                    const ports = [...editTemplate.ports as { port: string; protocol: string; description: string }[]];
                    ports[i] = { ...ports[i], description: e.target.value };
                    setEditTemplate({ ...editTemplate, ports });
                  }} />
                <IconButton size="small" sx={{ p: 0.25 }} color="error" onClick={() => {
                  const ports = [...editTemplate.ports as { port: string; protocol: string; description: string }[]];
                  ports.splice(i, 1);
                  setEditTemplate({ ...editTemplate, ports });
                }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
              </Box>
            ))}
          </Box>
          <TextField size="small" label="Description" value={editTemplate.description || ''} onChange={(e) => setEditTemplate({ ...editTemplate, description: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={async () => {
            try {
              await api.put(`/admin/infra/templates/${editTemplate.product}`, editTemplate);
              setToast({ open: true, message: 'Template gespeichert', severity: 'success' });
              setTemplateDialog(false);
              fetchAll();
            } catch { setToast({ open: true, message: 'Error', severity: 'error' }); }
          }}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Node Dialog ── */}
      <Dialog open={nodeDialog} onClose={() => setNodeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editNode.id ? 'Node bearbeiten' : 'Neuer Node'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField size="small" label="Name" value={editNode.name || ''} onChange={(e) => setEditNode({ ...editNode, name: e.target.value })}
            slotProps={{ input: { endAdornment: (
              <InputAdornment position="end">
                <Button size="small" sx={{ minWidth: 0, fontSize: 11, px: 1 }} onClick={() => {
                  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
                  const id = Array.from({length: 5}, () => c[Math.floor(Math.random() * c.length)]).join('');
                  setEditNode({ ...editNode, name: `srv-${id}` });
                }}>Gen</Button>
              </InputAdornment>
            )}}} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select value={editNode.provider || ''} label="Provider" onChange={(e) => {
                setEditNode({ ...editNode, provider: e.target.value, _profile: '', _server_type: '' });
                if (e.target.value === 'hetzner' && hetznerProfiles.length === 0) {
                  api.get('/admin/infra/providers/hetzner/profiles').then((res) => {
                    setHetznerProfiles(res.data.profiles || []);
                    setHetznerLocations(res.data.locations || []);
                  }).catch(() => {});
                }
              }}>
                {providers.filter((p) => settings.some((s) => s.category === p && s.value_full)).map((p) => (
                  <MenuItem key={p} value={p}>{p.toUpperCase()} ✓</MenuItem>
                ))}
                {providers.filter((p) => !settings.some((s) => s.category === p && s.value_full)).map((p) => (
                  <MenuItem key={p} value={p} disabled>{p.toUpperCase()} (nicht konfiguriert)</MenuItem>
                ))}
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
                    <InputLabel>Profil</InputLabel>
                    <Select value={(editNode._profile as string) || ''} label="Profil" onChange={(e) => {
                      const tier = e.target.value as string;
                      const savedType = settings.find((s) => s.category === 'hetzner' && s.key === tier)?.value_full || '';
                      const profile = hetznerProfiles.find((p) => p.id === savedType);
                      setEditNode({ ...editNode, _profile: tier, _server_type: savedType,
                        ...(profile ? { cpu: profile.cpu, ram: profile.ram, disk: profile.disk } : {}),
                      });
                    }}>
                      {['profile_low', 'profile_mid', 'profile_high', 'profile_premium'].filter((tier) => {
                        return settings.some((s) => s.category === 'hetzner' && s.key === tier && s.value_full);
                      }).map((tier) => {
                        const saved = settings.find((s) => s.category === 'hetzner' && s.key === tier);
                        const label = tier === 'profile_low' ? 'Low' : tier === 'profile_mid' ? 'Mittel' : tier === 'profile_high' ? 'Hoch' : 'Premium';
                        const profile = hetznerProfiles.find((p) => p.id === saved?.value_full);
                        return <MenuItem key={tier} value={tier}>
                          {label}: {saved?.value_full} {profile ? `(${profile.cpu} vCPU, ${Math.round(profile.ram / 1024)}GB, €${profile.price_monthly}/mo)` : ''}
                        </MenuItem>;
                      })}
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
        <DialogTitle>{editInstance.id ? 'Instanz bearbeiten' : 'Neue Instanz'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {/* Product from templates */}
          <FormControl size="small">
            <InputLabel>Produkt</InputLabel>
            <Select value={editInstance.product || ''} label="Produkt" onChange={(e) => {
              const prod = String(e.target.value);
              const tmpl = templates.find((t) => t.product === prod);
              setEditInstance({ ...editInstance, product: prod, docker_image: tmpl?.docker_image || '', _domain_prefix: tmpl?.domain_prefix || '' });
            }}>
              {templates.filter((t) => t.docker_image).map((t) => (
                <MenuItem key={t.product} value={t.product}>{t.product}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Node — nur online mit Coolify */}
          <FormControl size="small">
            <InputLabel>Node</InputLabel>
            <Select value={editInstance.node_id || ''} label="Node" onChange={(e) => setEditInstance({ ...editInstance, node_id: Number(e.target.value) })}>
              {nodes.filter((n) => n.status === 'online' && n.coolify_server_id).map((n) => (
                <MenuItem key={n.id} value={n.id}>{n.name} ({n.provider}) — {n.instance_count}/{n.max_containers}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Domain: subdomain input + root preview */}
          <Box sx={{ display: 'flex', gap: 0, alignItems: 'center' }}>
            <TextField size="small" label="Subdomain" value={editInstance.name || ''}
              onChange={(e) => setEditInstance({ ...editInstance, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              sx={{ flex: 1 }}
              slotProps={{ input: { endAdornment: (
                <InputAdornment position="end">
                  <Button size="small" sx={{ minWidth: 0, fontSize: 11, px: 1 }} onClick={() => {
                    const c = 'abcdefghjkmnpqrstuvwxyz23456789';
                    setEditInstance({ ...editInstance, name: Array.from({length: 5}, () => c[Math.floor(Math.random() * c.length)]).join('') });
                  }}>Gen</Button>
                </InputAdornment>
              )}}} />
            <Typography sx={{ px: 1, color: 'text.secondary', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              .{editInstance._domain_prefix || 'product'}.{settings.find((s: SettingRow) => s.category === 'cloudflare' && s.key === 'root_domain')?.value_full || 'flxo.cloud'}
            </Typography>
          </Box>

          {/* Kunde */}
          <FormControl size="small">
            <InputLabel>Kunde</InputLabel>
            <Select value={editInstance.tenant_id || ''} label="Kunde" onChange={(e) => {
              const tid = Number(e.target.value);
              const tenant = tenantList.find((t) => t.id === tid);
              setEditInstance({ ...editInstance, tenant_id: tid, tenant_ids: [tid], name: (tenant?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) });
            }}>
              {tenantList.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name} ({t.tenant_type})</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Full domain preview */}
          {editInstance.name && (
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
              {editInstance.name}.{editInstance._domain_prefix || 'product'}.{settings.find((s: SettingRow) => s.category === 'cloudflare' && s.key === 'root_domain')?.value_full || 'flxo.cloud'}
            </Typography>
          )}



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
          <Button variant="contained" color="success" onClick={saveInstance}>
            {editInstance.id ? t('button.save') : 'Erstellen & Deployen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
