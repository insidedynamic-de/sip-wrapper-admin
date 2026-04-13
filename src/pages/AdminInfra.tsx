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
  Alert, Tabs, Tab, Grid2 as Grid, alpha, useTheme, LinearProgress, Autocomplete, Checkbox,
  InputAdornment, FormControlLabel,
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
  { category: 'ionos', key: 'username', description: 'IONOS Username (Email)' },
  { category: 'ionos', key: 'password', description: 'IONOS Passwort', secret: true },
  { category: 'ionos', key: 'api_token', description: 'IONOS API Token (alternativ)' },
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

  // Provider profiles
  const [hetznerProfiles, setHetznerProfiles] = useState<{ id: string; name: string; cpu: number; ram: number; disk: number; price_monthly: number; type: string }[]>([]);
  const [hetznerLocations, setHetznerLocations] = useState<{ id: string; name: string; city: string }[]>([]);
  const [hetznerImages, setHetznerImages] = useState<{ id: string; name: string; location: string }[]>([]);
  const [ionosProfiles, setIonosProfiles] = useState<{ id: string; name: string; cpu: number; ram: number; disk: number; price_monthly: number }[]>([]);
  const [ionosLocations, setIonosLocations] = useState<{ id: string; name: string; city: string }[]>([]);
  const [ionosImages, setIonosImages] = useState<{ id: string; name: string; location: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [vmResult, setVmResult] = useState<{ ip: string; password: string; provider: string } | null>(null);

  // Dialogs
  const [nodeDialog, setNodeDialog] = useState(false);
  const [instanceDialog, setInstanceDialog] = useState(false);
  const [portChecks, setPortChecks] = useState<Record<number, { port: string; protocol: string; open: boolean }[]>>({});
  const [licInfo, setLicInfo] = useState<Record<number, { licensed: boolean; features: string[]; products: string[] }>>({});
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [editNode, setEditNode] = useState<any>({});
  const [editInstance, setEditInstance] = useState<any>({});
  const [editTemplate, setEditTemplate] = useState<any>({});
  const [templateDialog, setTemplateDialog] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<string[]>([]);
  const [tenantList, setTenantList] = useState<{ id: number; name: string; tenant_type: string }[]>([]);
  const [tenantLicenses, setTenantLicenses] = useState<any[]>([]);
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
  const [deploying, setDeploying] = useState(false);
  const saveInstance = async () => {
    setDeploying(true);
    try {
      if (editInstance.id) {
        await api.put(`/admin/infra/instances/${editInstance.id}`, editInstance);
      } else {
        const res = await api.post('/admin/infra/instances', editInstance);
        setToast({ open: true, message: `Deployed: ${res.data.domain} (${res.data.status})`, severity: 'success' });
      }
      setInstanceDialog(false);
      fetchAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
    setDeploying(false);
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
        <Tab icon={<RefreshIcon />} label="Cronjobs" iconPosition="start" />
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
                        <Button size="small" onClick={async () => {
                          try {
                            const res = await api.post(`/admin/infra/nodes/${n.id}/firewall`);
                            setToast({ open: true, message: `Firewall: ${res.data.added?.join(', ') || 'OK'}`, severity: 'success' });
                          } catch { setToast({ open: true, message: 'Firewall failed', severity: 'error' }); }
                        }}>Firewall</Button>
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
              setEditInstance({ product: '', name: '', node_id: '', domain: '', docker_image: '', max_connections: 0, infra_type: 'shared', tenant_ids: [], tenant_id: '', license_key: '', _domain_prefix: '' });
              setTenantLicenses([]);
              setInstanceDialog(true);
            }}>Instanz erstellen</Button>
          </Box>
          <Grid container spacing={3}>
            {instances.map((i) => {
              const tmpl = templates.find((t) => t.product === i.product);
              return (
                <Grid size={{ xs: 12, md: 6 }} key={i.id}>
                  <Card sx={{
                    borderLeft: 4, opacity: i.is_active ? 1 : 0.4,
                    borderColor: i.status === 'online' ? 'success.main' : i.status === 'provisioning' ? 'warning.main' : 'error.main',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }, transition: 'all 0.15s',
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>{i.product}</Typography>
                          <Typography variant="caption" color="text.secondary">{i.name}</Typography>
                        </Box>
                        <Chip label={i.status} size="small" color={i.status === 'online' ? 'success' : i.status === 'provisioning' ? 'warning' : 'default'} />
                      </Box>
                      {/* Domain */}
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, mb: 0.5 }}>{i.domain || '—'}</Typography>
                      {/* Info row */}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                        <Chip label={i.node_name || '?'} size="small" variant="outlined" />
                        {i.tenants.map((t) => <Chip key={t.tenant_id} label={t.tenant_name} size="small" />)}
                        {i.max_connections > 0 && <Chip label={`${i.max_connections} conn`} size="small" color="primary" />}
                        {i.coolify_app_id && <Chip label="Coolify" size="small" variant="outlined" sx={{ fontSize: 10 }} />}
                      </Box>
                      {/* Ports — from instance ports_config or fallback to template */}
                      {(() => {
                        const pc = (i as unknown as Record<string, unknown>).ports as Record<string, number | null> | undefined;
                        const instancePorts = pc && Object.keys(pc).length > 0
                          ? Object.entries(pc).filter(([, v]) => v != null).map(([k, v]) => ({
                              port: String(v), protocol: k.includes('rtp') ? 'udp' : k.includes('sip') ? 'udp' : 'tcp', description: k.replace(/_/g, ' '),
                            }))
                          : tmpl?.ports || [];
                        return instancePorts.length > 0 ? (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          {instancePorts.map((p, idx) => {
                            const checks = portChecks[i.id];
                            const check = checks?.find((c) => String(c.port) === String(p.port) && c.protocol === p.protocol);
                            return (
                              <Chip key={idx} label={`${p.port}/${p.protocol}`} size="small"
                                variant={check ? 'filled' : 'outlined'}
                                color={check ? (check.open ? 'success' : 'error') : 'default'}
                                sx={{ fontSize: 10, height: 20 }}
                                title={`${p.description}${check ? (check.open ? ' ✓ open' : ' ✗ closed') : ''}`} />
                            );
                          })}
                          {tmpl && <Chip label={tmpl.cf_proxy ? 'CF Proxy' : 'DNS only'} size="small"
                            color={tmpl.cf_proxy ? 'success' : 'warning'} sx={{ fontSize: 10, height: 20 }} />}
                        </Box>
                        ) : null;
                      })()}
                      {/* License info */}
                      {licInfo[i.id] && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          <Chip label={licInfo[i.id].licensed ? 'Lizenziert' : 'Keine Lizenz'} size="small"
                            color={licInfo[i.id].licensed ? 'success' : 'error'} sx={{ fontSize: 10, height: 20 }} />
                          {licInfo[i.id].features.map((f) => (
                            <Chip key={f} label={f} size="small" variant="outlined" color="primary" sx={{ fontSize: 10, height: 20 }} />
                          ))}
                        </Box>
                      )}
                      {/* Actions */}
                      <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                        <Button size="small" onClick={async () => {
                          try {
                            const r = await api.post(`/admin/infra/instances/${i.id}/check`);
                            setToast({ open: true, message: `${i.name}: ${r.data.status}`, severity: r.data.success ? 'success' : 'error' });
                            if (r.data.ports) setPortChecks((prev) => ({ ...prev, [i.id]: r.data.ports }));
                            fetchAll();
                          } catch { setToast({ open: true, message: 'Check failed', severity: 'error' }); }
                        }}>Health</Button>
                        <Button size="small" disabled={licInfo[i.id]?.licensed === undefined && !!licInfo[i.id]} onClick={async () => {
                          setLicInfo((prev) => ({ ...prev, [i.id]: { licensed: undefined as unknown as boolean, features: [], products: [] } }));
                          setToast({ open: true, message: 'Lizenz wird geprüft...', severity: 'success' });
                          try {
                            const r = await api.post(`/admin/infra/instances/${i.id}/license-refresh`);
                            const d = r.data || {};
                            setLicInfo((prev) => ({ ...prev, [i.id]: { licensed: d.licensed || false, features: d.active_features || [], products: d.active_products || [] } }));
                            setToast({ open: true, message: d.licensed ? `Lizenziert: ${(d.active_products || []).join(', ')}` : 'Keine aktive Lizenz', severity: d.licensed ? 'success' : 'error' });
                            fetchAll();
                          } catch { setToast({ open: true, message: 'Lizenz-Refresh fehlgeschlagen', severity: 'error' }); }
                        }}>Lic Refresh</Button>
                        <Button size="small" onClick={async () => {
                          try {
                            await api.post(`/admin/infra/instances/${i.id}/firewall`);
                            setToast({ open: true, message: 'Firewall aktualisiert', severity: 'success' });
                          } catch { setToast({ open: true, message: 'Firewall failed', severity: 'error' }); }
                        }}>Firewall</Button>
                        <Box sx={{ flex: 1 }} />
                        <IconButton size="small" onClick={() => { setEditInstance({ ...i }); setInstanceDialog(true); }}><EditIcon fontSize="small" /></IconButton>
                        {i.status === 'deleted' ? (
                          <Button size="small" color="error" variant="outlined" onClick={async () => {
                            if (!confirm(`Instanz "${i.name}" ENDGÜLTIG löschen? Alle Daten werden entfernt.`)) return;
                            try {
                              await api.delete(`/admin/infra/instances/${i.id}?permanent=true`);
                              setToast({ open: true, message: 'Endgültig gelöscht', severity: 'success' });
                              fetchAll();
                            } catch { setToast({ open: true, message: 'Fehler', severity: 'error' }); }
                          }}>Entfernen</Button>
                        ) : (
                          <IconButton size="small" color="error" onClick={async () => {
                            if (!confirm(`Instanz "${i.name}" stoppen und deaktivieren?`)) return;
                            try {
                              await api.delete(`/admin/infra/instances/${i.id}`);
                              setToast({ open: true, message: 'Gestoppt', severity: 'success' });
                              fetchAll();
                            } catch { setToast({ open: true, message: 'Fehler', severity: 'error' }); }
                          }}><DeleteIcon fontSize="small" /></IconButton>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
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
              { key: 'master_ip', description: 'Master IP (SSH)', placeholder: '217.160.65.176' },
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
              { key: 'username', description: 'Username (Email)', placeholder: '' },
              { key: 'password', description: 'Passwort', placeholder: '', secret: true },
              { key: 'api_token', description: 'API Token (alternativ)', placeholder: '' },
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
                      const isSecret = f.key.includes('token') || f.key.includes('key') || f.key.includes('password') || (f as any).secret;
                      return (
                        <TextField
                          key={`${fieldKey}:${existing?.id || 0}`}
                          size="small" fullWidth
                          label={f.description}
                          placeholder={f.placeholder}
                          defaultValue={isSecret ? '' : (existing?.value_full || '')}
                          helperText={isSecret && existing?.value_full ? '••••••••' : undefined}
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
                            if (e.target.value && e.target.value !== (existing?.value_full || '')) {
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
                      const blockProfiles = block.category === 'hetzner' ? hetznerProfiles : block.category === 'ionos' ? ionosProfiles : [];
                      const hasApiProfiles = block.category === 'hetzner' || block.category === 'ionos';
                      return (
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2">Server-Profile</Typography>
                            {hasApiProfiles && (
                              <Button size="small" onClick={() => {
                                api.get(`/admin/infra/providers/${block.category}/profiles`).then((res) => {
                                  if (block.category === 'hetzner') {
                                    setHetznerProfiles(res.data.profiles || []);
                                    setHetznerLocations(res.data.locations || []);
                                    setHetznerImages(res.data.images || []);
                                  } else if (block.category === 'ionos') {
                                    setIonosProfiles(res.data.profiles || []);
                                    setIonosLocations(res.data.locations || []);
                                    setIonosImages(res.data.images || []);
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
                                    {(() => {
                                      // savedValue may be JSON or plain ID
                                      let selectedId = savedValue;
                                      try { const parsed = JSON.parse(savedValue); selectedId = parsed.id || savedValue; } catch { /* plain id */ }
                                      return (
                                    <Select value={selectedId} displayEmpty onChange={(e) => {
                                      const selected = blockProfiles.find((p) => p.id === e.target.value);
                                      const val = selected ? JSON.stringify({ id: selected.id, name: selected.name, cpu: selected.cpu, ram: selected.ram, ram_gb: (selected as any).ram_gb || Math.round(selected.ram / 1024), disk: selected.disk, category: (selected as any).category || '', price_monthly: selected.price_monthly || 0 }) : '';
                                      saveSetting(block.category, tier.key, val, `${tier.label} profile`);
                                    }}>
                                      <MenuItem value="">— {tier.label} —</MenuItem>
                                      {blockProfiles.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                                            <span><b>{p.name}</b></span>
                                            <Typography variant="caption" color="text.secondary">
                                              {p.cpu} vCPU, {(p as any).ram_gb || Math.round(p.ram / 1024)} GB, {p.disk} GB
                                              {p.price_monthly ? ` · €${p.price_monthly}/mo` : ''}
                                            </Typography>
                                          </Box>
                                        </MenuItem>
                                      ))}
                                    </Select>
                                      );
                                    })()}
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
                const prov = e.target.value;
                if (prov === 'hetzner' && hetznerProfiles.length === 0) {
                  api.get('/admin/infra/providers/hetzner/profiles').then((res) => {
                    setHetznerProfiles(res.data.profiles || []);
                    setHetznerLocations(res.data.locations || []);
                  }).catch(() => {});
                } else if (prov === 'ionos' && ionosProfiles.length === 0) {
                  api.get('/admin/infra/providers/ionos/profiles').then((res) => {
                    setIonosProfiles(res.data.profiles || []);
                    setIonosLocations(res.data.locations || []);
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

          {/* Cloud provider: profile + location select */}
          {(editNode.provider === 'hetzner' || editNode.provider === 'ionos') && !editNode.id && (
            <>
              {(() => {
                const prov = editNode.provider;
                const profs = prov === 'hetzner' ? hetznerProfiles : prov === 'ionos' ? ionosProfiles : [];
                const locs = prov === 'hetzner' ? hetznerLocations : prov === 'ionos' ? ionosLocations : [];
                if (profs.length === 0) return (
                  <Button size="small" onClick={() => {
                    api.get(`/admin/infra/providers/${prov}/profiles`).then((res) => {
                      if (prov === 'hetzner') { setHetznerProfiles(res.data.profiles || []); setHetznerLocations(res.data.locations || []); }
                      else if (prov === 'ionos') { setIonosProfiles(res.data.profiles || []); setIonosLocations(res.data.locations || []); }
                    }).catch(() => setToast({ open: true, message: `${prov.toUpperCase()} API Fehler`, severity: 'error' }));
                  }}>Profile laden...</Button>
                );
                return (
                  <>
                    <FormControl size="small">
                      <InputLabel>Profil</InputLabel>
                      <Select value={(editNode as any)._server_type || ''} label="Profil" onChange={(e) => {
                        const profile = profs.find((p) => p.id === e.target.value);
                        setEditNode({ ...editNode, _server_type: e.target.value,
                          ...(profile ? { cpu: profile.cpu, ram: profile.ram, disk: profile.disk } : {}),
                        });
                      }}>
                        {profs.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                              <span><b>{p.name}</b></span>
                              <Typography variant="caption" color="text.secondary">
                                {p.cpu} vCPU, {(p as any).ram_gb || Math.round(p.ram / 1024)} GB, {p.disk} GB
                                {p.price_monthly ? ` · €${p.price_monthly}/mo` : ''}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {locs.length > 0 && (
                      <FormControl size="small">
                        <InputLabel>Standort</InputLabel>
                        <Select value={(editNode._location as string) || ''} label="Standort" onChange={(e) => setEditNode({ ...editNode, _location: e.target.value, region: e.target.value })}>
                          {locs.map((l) => (
                            <MenuItem key={l.id} value={l.id}>{l.name} ({l.city})</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    {/* Image select — filtered by location */}
                    {(() => {
                      const selectedLoc = (editNode as any)._location || '';
                      const raw = prov === 'hetzner' ? hetznerImages : prov === 'ionos' ? ionosImages : [];
                      // IONOS: filter by selected location
                      const allImages = prov === 'ionos' && selectedLoc
                        ? raw.filter((img) => img.location === selectedLoc || img.location.startsWith(selectedLoc))
                        : raw;
                      return allImages.length > 0 ? (
                        <FormControl size="small">
                          <InputLabel>Image</InputLabel>
                          <Select value={(editNode as any)._image || ''} label="Image" onChange={(e) => setEditNode({ ...editNode, _image: e.target.value } as any)}>
                            {allImages.map((img) => (
                              <MenuItem key={img.id} value={img.id}>{img.name}{img.location ? ` (${img.location})` : ''}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : null;
                    })()}
                    {/* Fixed IP option — same for all providers */}
                    <FormControlLabel
                      control={<Checkbox checked={(editNode as any)._fixedIp ?? (prov === 'hetzner')} onChange={(e) => setEditNode({ ...editNode, _fixedIp: e.target.checked } as any)} />}
                      label={prov === 'ionos' ? 'Fixed IP (+5,00 €/mo)' : 'Fixed IPv4 (0,00 €/mo)'}
                    />
                  </>
                );
              })()}
            </>
          )}

          {/* Manual fields (for edit or non-cloud providers) */}
          {(editNode.id || (editNode.provider !== 'hetzner' && editNode.provider !== 'ionos')) && (
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

          {/* Summary: selected config */}
          {!editNode.id && (editNode.cpu > 0 || (editNode as any)._server_type) && (
            <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Zusammenfassung</Typography>
                <Typography variant="body2">
                  {editNode.cpu} vCPU · {editNode.ram >= 1024 ? `${Math.round(editNode.ram / 1024)} GB` : `${editNode.ram} MB`} RAM · {editNode.disk} GB SSD
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {editNode.provider?.toUpperCase()} · {(editNode as any)._location || editNode.region || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  OS: {(editNode as any)._image ? ([...hetznerImages, ...ionosImages].find((i) => i.id === (editNode as any)._image)?.name || (editNode as any)._image) : 'Ubuntu 22.04'}
                  {(editNode as any)._fixedIp ? ' · Fixed IP' : ' · DHCP'}
                </Typography>
                {(() => {
                  const prov = editNode.provider || '';
                  const profs = prov === 'hetzner' ? hetznerProfiles : prov === 'ionos' ? ionosProfiles : [];
                  const sel = profs.find((p) => p.id === (editNode as any)._server_type);
                  const fixedIpExtra = prov === 'ionos' && (editNode as any)._fixedIp ? 5 : 0;
                  const totalPrice = sel?.price_monthly ? sel.price_monthly + fixedIpExtra : fixedIpExtra;
                  return totalPrice ? (
                    <Typography variant="h6" color="primary" sx={{ mt: 0.5 }}>
                      €{totalPrice.toFixed(2)}/mo
                      {fixedIpExtra > 0 && <Typography component="span" variant="caption" color="text.secondary"> (inkl. Fixed IP)</Typography>}
                    </Typography>
                  ) : null;
                })()}
              </CardContent>
            </Card>
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
          {/* Cloud provider: create VM via API (universal for Hetzner + IONOS) */}
          {(editNode.provider === 'hetzner' || editNode.provider === 'ionos') && !editNode.id && ((editNode as any)._server_type as string) && (
            <Button variant="contained" color="success" disabled={creating} onClick={async () => {
              setCreating(true);
              try {
                const payload: Record<string, unknown> = {
                  name: editNode.name || `node-${editNode.provider}`,
                  provider: editNode.provider,
                  server_type: (editNode as any)._server_type,
                  location: (editNode as any)._location || '',
                };
                if ((editNode as any)._image) {
                  payload.image = (editNode as any)._image;
                }
                payload.ipv4_public = (editNode as any)._fixedIp ?? true;
                const res = await api.post('/admin/infra/nodes/create-from-provider', payload);
                setNodeDialog(false);
                if (res.data.root_password || res.data.ip) {
                  setVmResult({ ip: res.data.ip || '', password: res.data.root_password || '', provider: editNode.provider || '' });
                } else {
                  setToast({ open: true, message: 'VM erstellt!', severity: 'success' });
                }
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

          {/* 1. Kunde */}
          <FormControl size="small">
            <InputLabel>1. Kunde</InputLabel>
            <Select value={editInstance.tenant_id || ''} label="1. Kunde" onChange={(e) => {
              const tid = Number(e.target.value);
              const tenant = tenantList.find((t) => t.id === tid);
              // Auto-generate unique subdomain
              const baseName = (tenant?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
              const existingNames = instances.filter((inst) => inst.is_active).map((inst) => inst.name);
              let subName = baseName;
              let counter = 2;
              while (existingNames.includes(subName)) {
                subName = `${baseName}${counter}`;
                counter++;
              }
              setEditInstance({ ...editInstance, tenant_id: tid, tenant_ids: [tid], license_key: '', product: '', _domain_prefix: '', max_connections: 0, name: subName });
              setTenantLicenses([]);
              api.get('/products', { headers: { 'X-Tenant-Id': String(tid) } }).then((res) => {
                const lics: any[] = [];
                const seen = new Set<string>();
                for (const p of (res.data || [])) {
                  for (const l of (p.licenses || [])) {
                    if ((l.effective_status === 'active' || l.effective_status === 'grace') && !seen.has(l.license_key)) {
                      seen.add(l.license_key);
                      lics.push({ ...l, _product: p.product });
                    }
                  }
                }
                setTenantLicenses(lics);
              }).catch(() => setTenantLicenses([]));
            }}>
              {tenantList.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name} ({t.tenant_type})</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 2. Node (admin/superadmin wählt, client bekommt auto) */}
          {editInstance.tenant_id && (
            <FormControl size="small">
              <InputLabel>2. Node</InputLabel>
              <Select value={editInstance.node_id || ''} label="2. Node" onChange={(e) => setEditInstance({ ...editInstance, node_id: Number(e.target.value) })}>
                {nodes.filter((n) => n.status === 'online' && n.coolify_server_id).map((n) => (
                  <MenuItem key={n.id} value={n.id}>{n.name} ({n.provider}) — {n.instance_count}/{n.max_containers}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* 3. Produkt (aus Lizenzen des Kunden, nur mit Docker Image) */}
          {editInstance.node_id && tenantLicenses.length > 0 && (
            <FormControl size="small">
              <InputLabel>3. Produkt</InputLabel>
              <Select value={editInstance.product || ''} label="3. Produkt" onChange={(e) => {
                const prod = String(e.target.value);
                const tmpl = templates.find((t) => t.product === prod);
                setEditInstance({ ...editInstance, product: prod, license_key: '', docker_image: tmpl?.docker_image || '', _domain_prefix: tmpl?.domain_prefix || '' });
              }}>
                {[...new Set(tenantLicenses.map((l: any) => l._product))].map((prod) => {
                  const tmpl = templates.find((t) => t.product === prod);
                  return <MenuItem key={String(prod)} value={String(prod)} disabled={!tmpl?.docker_image}>
                    {String(prod)} {!tmpl?.docker_image ? '(kein Docker Image)' : ''}
                  </MenuItem>;
                })}
              </Select>
            </FormControl>
          )}

          {/* 4. Lizenz-Auswahl (klickbare Liste) */}
          {editInstance.product && (() => {
            const productLics = tenantLicenses.filter((l: any) => l._product === editInstance.product);
            if (productLics.length === 0) return null;
            return (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                {(() => {
                  const totalLicensed = productLics.reduce((s: number, l: any) => s + (l.max_connections || 0), 0);
                  // Subtract already used by other instances of same product for this tenant
                  const usedByOthers = instances
                    .filter((inst) => inst.product === editInstance.product && inst.is_active && inst.id !== editInstance.id
                      && inst.tenants.some((t) => t.tenant_id === editInstance.tenant_id))
                    .reduce((s, inst) => s + inst.max_connections, 0);
                  const totalAvailable = Math.max(0, totalLicensed - usedByOthers);
                  const allocated = Number(editInstance.max_connections) || 0;
                  return (<>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2">4. Connections zuweisen</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Lizenziert: {totalLicensed} · Belegt: {usedByOthers} · Verfügbar: {totalAvailable}
                      </Typography>
                    </Box>
                    {/* License overview */}
                    {productLics.map((l: any) => (
                      <Box key={l.license_key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25, px: 1 }}>
                        <Typography variant="caption" color="text.secondary">{l.license_name} ({l.license_key})</Typography>
                        <Typography variant="caption">{l.max_connections} conn · {l.expires_at ? `bis ${new Date(l.expires_at).toLocaleDateString()}` : '∞'}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <TextField size="small" type="number" label="Connections"
                        value={allocated}
                        onChange={(e) => {
                          const v = Math.min(Math.max(0, Number(e.target.value)), totalAvailable);
                          setEditInstance({ ...editInstance, max_connections: v, license_key: productLics[0]?.license_key || '' });
                        }}
                        slotProps={{ htmlInput: { min: 0, max: totalAvailable } }}
                        sx={{ width: 120 }} />
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress variant="determinate" value={totalAvailable > 0 ? (allocated / totalAvailable) * 100 : 0}
                          sx={{ height: 8, borderRadius: 4 }} />
                      </Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{allocated} / {totalAvailable}</Typography>
                    </Box>
                  </>);
                })()}
              </Box>
            );
          })()}

          {/* 5. Subdomain */}
          {(Number(editInstance.max_connections) > 0 && editInstance.license_key) && (
            <>
              <Box sx={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                <TextField size="small" label="5. Subdomain" value={editInstance.name || ''}
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
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
                {editInstance.name || '?'}.{editInstance._domain_prefix || 'product'}.{settings.find((s: SettingRow) => s.category === 'cloudflare' && s.key === 'root_domain')?.value_full || 'flxo.cloud'}
              </Typography>
            </>
          )}

          {/* Edit mode */}
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
          <Button onClick={() => setInstanceDialog(false)} disabled={deploying}>{t('button.cancel')}</Button>
          <Button variant="contained" color="success"
            disabled={deploying || !editInstance.tenant_id || !editInstance.node_id || !editInstance.product || !editInstance.license_key || !Number(editInstance.max_connections) || !editInstance.name}
            onClick={saveInstance}
            startIcon={deploying ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {deploying ? 'Deploying...' : editInstance.id ? t('button.save') : 'Erstellen & Deployen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── TAB 4: Cronjobs ── */}
      {tab === 4 && (
        <CronjobsTab />
      )}

      {/* VM Created Result Dialog */}
      <Dialog open={!!vmResult} onClose={() => setVmResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle>VM erstellt</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>Server wurde erfolgreich erstellt.</Alert>
          <Table size="small">
            <TableBody>
              {vmResult?.ip && (
                <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => { navigator.clipboard?.writeText(vmResult.ip); setToast({ open: true, message: 'IP kopiert', severity: 'success' }); }}>
                  <TableCell sx={{ fontWeight: 600 }}>IP</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{vmResult.ip}</TableCell>
                  <TableCell sx={{ width: 40 }}><IconButton size="small"><ContentCopyIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              )}
              {vmResult?.password && (
                <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => { navigator.clipboard?.writeText(vmResult.password); setToast({ open: true, message: 'Passwort kopiert', severity: 'success' }); }}>
                  <TableCell sx={{ fontWeight: 600 }}>Root Passwort</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{vmResult.password}</TableCell>
                  <TableCell sx={{ width: 40 }}><IconButton size="small"><ContentCopyIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              )}
              {vmResult?.provider && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Provider</TableCell>
                  <TableCell>{vmResult.provider.toUpperCase()}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Alert severity="warning" sx={{ mt: 2 }}>Bitte Passwort jetzt speichern — es wird nicht erneut angezeigt!</Alert>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setVmResult(null)}>Schließen</Button>
        </DialogActions>
      </Dialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}

function CronjobsTab() {
  const [jobs, setJobs] = useState<{ key: string; value: string; description: string; enabled?: boolean }[]>([]);
  const [saving, setSaving] = useState('');
  const [running, setRunning] = useState('');

  useEffect(() => {
    api.get('/admin/infra/cronjobs').then((r) => setJobs(r.data || [])).catch(() => {});
  }, []);

  const save = async (key: string, value: string) => {
    setSaving(key);
    try {
      await api.put('/admin/infra/cronjobs', { key, value });
      setJobs((prev) => prev.map((j) => j.key === key ? { ...j, value } : j));
    } catch { /* ignore */ }
    setSaving('');
  };

  const toggle = async (key: string) => {
    const job = jobs.find((j) => j.key === key);
    if (!job) return;
    const newEnabled = job.value === '0' ? '30' : '0';
    await save(key, newEnabled);
  };

  const runNow = async (key: string) => {
    setRunning(key);
    try {
      await api.post('/admin/infra/cronjobs/run', { key });
    } catch { /* ignore */ }
    setRunning('');
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>Cronjobs</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Aufgabe</TableCell>
              <TableCell sx={{ width: 80 }}>Status</TableCell>
              <TableCell sx={{ width: 150 }}>Intervall (Min)</TableCell>
              <TableCell sx={{ width: 200 }}>Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((j) => {
              const active = j.value !== '0';
              return (
                <TableRow key={j.key}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{j.description}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{j.key}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={active ? 'Aktiv' : 'Gestoppt'} size="small" color={active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={j.value}
                      onChange={(e) => setJobs((prev) => prev.map((x) => x.key === j.key ? { ...x, value: e.target.value } : x))}
                      sx={{ width: 80 }} inputProps={{ min: 0 }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="contained" disabled={saving === j.key}
                        onClick={() => save(j.key, j.value)}>
                        {saving === j.key ? '...' : 'Save'}
                      </Button>
                      <Button size="small" variant="outlined" color={active ? 'error' : 'success'}
                        onClick={() => toggle(j.key)}>
                        {active ? 'Stop' : 'Start'}
                      </Button>
                      <Button size="small" variant="outlined" disabled={running === j.key}
                        onClick={() => runNow(j.key)}>
                        {running === j.key ? '...' : 'Jetzt ausführen'}
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
