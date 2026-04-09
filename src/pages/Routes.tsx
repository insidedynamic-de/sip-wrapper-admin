/**
 * @file RoutesPage — Routing configuration: Defaults + unified Extension Routes
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button,
  TextField, Tooltip, Chip, Checkbox,
  RadioGroup, Radio, FormControlLabel, FormLabel,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import type { Route, Gateway, GatewayStatus, Extension, User, Registration } from '../api/types';

type RouteDirection = 'inbound' | 'outbound' | 'both';

interface ExtensionRoute {
  extension: string;
  username: string;
  gateway: string;
  description: string;
  extDescription: string;
  direction: RouteDirection;
  enabled: boolean;
}

export default function RoutesPage() {
  const { t } = useTranslation();

  const [routes, setRoutes] = useState<Route | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [, setGatewayStatuses] = useState<GatewayStatus[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [defaults, setDefaults] = useState({ gateway: '', extension: '1000', caller_id: '' });
  const [maxConnections, setMaxConnections] = useState(0);
  const [hasVapi, setHasVapi] = useState(false);
  const [vapiAssistants, setVapiAssistants] = useState<{ id: string; name: string }[]>([]);
  const [vapiConnected, setVapiConnected] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editRoute, setEditRoute] = useState<ExtensionRoute | null>(null);
  const [form, setForm] = useState({ extension: '', gateway: '', direction: 'both' as RouteDirection, description: '' });
  const [initialForm, setInitialForm] = useState({ extension: '', gateway: '', direction: 'both' as RouteDirection, description: '' });
  const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const load = useCallback(async () => {
    try {
      const [r, g, gs, e, u, reg, lic] = await Promise.all([
        api.get('/routes'), api.get('/gateways'), api.get('/gateways/status'),
        api.get('/extensions'), api.get('/users'), api.get('/registrations'),
        api.get('/license'),
      ]);
      setRoutes(r.data || null);
      setGateways(g.data || []);
      setGatewayStatuses(gs.data || []);
      setExtensions(e.data || []);
      setUsers(u.data || []);
      setRegistrations(reg.data || []);
      if (r.data?.defaults) setDefaults(r.data.defaults);
      if (lic.data) {
        setMaxConnections(lic.data.total_connections || lic.data.max_connections || 0);
        const features: string[] = lic.data.active_features || [];
        const vapiActive = features.includes('vapi');
        setHasVapi(vapiActive);
        if (vapiActive) {
          try {
            const [vapiRes, asstRes] = await Promise.all([
              api.get('/integrations/vapi').catch(() => ({ data: null })),
              api.get('/integrations/vapi/assistants').catch(() => ({ data: [] })),
            ]);
            setVapiConnected(vapiRes.data?.connected || false);
            setVapiAssistants(asstRes.data || []);
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save Defaults ──

  const doSaveDefaults = async () => {
    try {
      await api.put('/routes/defaults', defaults);
      await api.post('/config/apply');
      setToast({ open: true, message: t('status.success'), severity: 'success' });
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };
  const saveDefaults = () => setConfirmSave({ open: true, action: doSaveDefaults });

  // ── Build unified Extension Routes from inbound routes + user routes ──

  const extRoutes: ExtensionRoute[] = useMemo(() => {
    if (!routes) return [];
    const rows: ExtensionRoute[] = [];

    // Build maps for merging
    const inboundByExt = new Map<string, typeof routes.inbound[0]>();
    for (const ib of routes.inbound || []) {
      inboundByExt.set(ib.extension, ib);
    }
    const outboundByExt = new Map<string, typeof routes.user_routes[0]>();
    for (const ur of routes.user_routes || []) {
      const user = users.find((u) => u.username === ur.username);
      if (user) outboundByExt.set(user.extension, ur);
    }

    // Merge: if same extension has both inbound + outbound with same gateway → "both"
    const processed = new Set<string>();

    for (const ib of routes.inbound || []) {
      const ext = extensions.find((e) => e.extension === ib.extension);
      const user = users.find((u) => u.extension === ib.extension);
      const ob = outboundByExt.get(ib.extension);

      if (ob && ob.gateway === ib.gateway) {
        // Bidirectional
        rows.push({
          extension: ib.extension,
          username: user?.username || ob.username,
          gateway: ib.gateway,
          description: ib.description || ob.description || '',
          extDescription: ext?.description || '',
          direction: 'both',
          enabled: ib.enabled !== false && ob.enabled !== false,
        });
        processed.add(ib.extension);
      } else {
        rows.push({
          extension: ib.extension,
          username: user?.username || '',
          gateway: ib.gateway,
          description: ib.description || '',
          extDescription: ext?.description || '',
          direction: 'inbound',
          enabled: ib.enabled !== false,
        });
        processed.add(ib.extension + '_inbound');
      }
    }

    // Outbound routes not merged
    for (const ur of routes.user_routes || []) {
      const user = users.find((u) => u.username === ur.username);
      const userExt = user?.extension || '';
      if (processed.has(userExt)) continue; // already merged as "both"
      const ext = user ? extensions.find((e) => e.extension === user.extension) : null;
      rows.push({
        extension: userExt,
        username: ur.username,
        gateway: ur.gateway,
        description: ur.description || '',
        extDescription: ext?.description || '',
        direction: 'outbound',
        enabled: ur.enabled !== false,
      });
    }

    return rows;
  }, [routes, extensions, users]);

  // Count only enabled routes for license limit check
  // VAPI bundle (all routes pointing to same extension as vapi gateway) counts as 1
  const vapiExtensions = new Set(
    extRoutes.filter((r) => r.enabled && r.gateway === 'vapi').map((r) => r.extension)
  );
  const nonVapiRoutes = extRoutes.filter((r) => r.enabled && r.gateway !== 'vapi'
    && !vapiExtensions.has(r.extension) && !(r.description || '').includes('VAPI OUT'));
  const enabledCount = nonVapiRoutes.length + vapiExtensions.size;

  const gwOptions = gateways.map((g) => ({
    label: g.description ? `${g.name} \u2014 ${g.description}` : g.name,
    value: g.name,
  }));
  const extOptions = [
    { label: '\u2014', value: '' },
    ...extensions
      .filter((e) => e.enabled !== false)
      .map((e) => ({ label: `${e.extension} \u2014 ${e.description}`, value: e.extension })),
  ];

  // ── Open Add / View / Edit ──

  const openAdd = () => {
    setEditRoute(null);
    setViewMode(false);
    const f = { extension: '', gateway: '', direction: 'both' as RouteDirection, description: '' };
    setForm(f);
    setInitialForm(f);
    setDialogOpen(true);
  };

  const openView = (r: ExtensionRoute) => {
    setEditRoute(r);
    setViewMode(true);
    const f = { extension: r.extension, gateway: r.gateway, direction: r.direction, description: r.description };
    setForm(f);
    setInitialForm(f);
    setDialogOpen(true);
  };

  const openEdit = (r: ExtensionRoute) => {
    setEditRoute(r);
    setViewMode(false);
    const f = { extension: r.extension, gateway: r.gateway, direction: r.direction, description: r.description };
    setForm(f);
    setInitialForm(f);
    setDialogOpen(true);
  };

  // ── Save route ──

  const doSaveRoute = async () => {
    try {
      const dirChanged = editRoute && editRoute.direction !== form.direction;
      const extChanged = editRoute && editRoute.extension !== form.extension;

      // License limit check: for new routes, if at/over limit → create as deactivated
      const isNew = !editRoute || dirChanged || extChanged;
      const overLimit = maxConnections > 0 && enabledCount >= maxConnections;
      const forceDisabled = isNew && !editRoute && overLimit;

      const user = users.find((u) => u.extension === form.extension);
      const wantInbound = form.direction === 'inbound' || form.direction === 'both';
      const wantOutbound = form.direction === 'outbound' || form.direction === 'both';
      const enabled = editRoute ? editRoute.enabled : !forceDisabled;

      // Delete old routes if direction/extension changed
      if (editRoute && (dirChanged || extChanged)) {
        if (editRoute.direction === 'inbound' || editRoute.direction === 'both') {
          await api.delete(`/routes/inbound/${editRoute.gateway}`, { data: { extension: editRoute.extension } }).catch(() => {});
        }
        if (editRoute.direction === 'outbound' || editRoute.direction === 'both') {
          await api.delete(`/routes/user/${editRoute.username}`).catch(() => {});
        }
      }

      if (editRoute && !dirChanged && !extChanged) {
        // Simple update
        if (wantInbound) {
          await api.put(`/routes/inbound/${editRoute.gateway}`, {
            extension: form.extension, gateway: form.gateway, description: form.description,
          }).catch(() => {});
        }
        if (wantOutbound && editRoute.username) {
          await api.put(`/routes/user/${editRoute.username}`, {
            gateway: form.gateway, description: form.description,
          }).catch(() => {});
        }
      } else {
        // Create new
        if (wantInbound) {
          await api.post('/routes/inbound', {
            gateway: form.gateway, extension: form.extension, description: form.description, enabled,
          }).catch(() => {});
        }
        if (wantOutbound && user) {
          await api.post('/routes/user', {
            username: user.username, gateway: form.gateway, description: form.description, enabled,
          }).catch(() => {});
        }
      }
      setDialogOpen(false);
      if (forceDisabled) {
        setToast({ open: true, message: t('route.error_license_limit'), severity: 'warning' });
      } else {
        setToast({ open: true, message: t('status.success'), severity: 'success' });
      }
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };
  const saveRoute = () => setConfirmSave({ open: true, action: doSaveRoute });

  // ── Delete route ──

  const requestDelete = (r: ExtensionRoute) => {
    const name = r.username ? `${r.username} (${r.extension})` : r.extension;
    setConfirmDelete({
      open: true,
      name,
      action: async () => {
        if (r.direction === 'inbound' || r.direction === 'both') {
          await api.delete(`/routes/inbound/${r.gateway}`, { data: { extension: r.extension } }).catch(() => {});
        }
        if (r.direction === 'outbound' || r.direction === 'both') {
          await api.delete(`/routes/user/${r.username}`).catch(() => {});
        }
        load();
      },
    });
  };

  // ── Toggle enabled ──

  const togglingRef = useRef(false);

  const toggleEnabled = async (r: ExtensionRoute) => {
    if (togglingRef.current) return;
    togglingRef.current = true;
    const newEnabled = !r.enabled;
    // Block enabling if at license limit
    if (newEnabled && maxConnections > 0 && enabledCount >= maxConnections) {
      setToast({ open: true, message: t('route.error_license_limit'), severity: 'error' });
      togglingRef.current = false;
      return;
    }
    try {
      if (r.direction === 'inbound' || r.direction === 'both') {
        await api.put(`/routes/inbound/${r.gateway}`, { extension: r.extension, enabled: newEnabled }).catch(() => {});
      }
      if (r.direction === 'outbound' || r.direction === 'both') {
        await api.put(`/routes/user/${r.username}`, { enabled: newEnabled }).catch(() => {});
      }
      await load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    } finally {
      togglingRef.current = false;
    }
  };

  // ── Confirm handlers ──

  const handleConfirmSave = async () => {
    const action = confirmSave.action;
    setConfirmSave({ open: false, action: null });
    if (action) await action();
  };

  const handleConfirmDelete = async () => {
    const action = confirmDelete.action;
    setConfirmDelete({ open: false, name: '', action: null });
    if (action) await action();
  };

  const dialogTitle = () => {
    if (viewMode) return t('route.view_route');
    if (editRoute) return t('route.edit_extension_route');
    return t('route.add_extension_route');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{t('section.routes')}</Typography>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={saveDefaults}>{t('button.save_reload')}</Button>
      </Box>

      {/* Defaults — split outbound / inbound */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('section.default_routes')}</Typography>
          <Grid container spacing={4}>
            {/* Outbound default */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CallMadeIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                <Typography variant="subtitle2">{t('route.type_outbound')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SearchableSelect
                  options={gwOptions} value={defaults.gateway}
                  onChange={(v) => setDefaults({ ...defaults, gateway: v })}
                  label={t('config.default_gateway')} helperText={t('config.outbound_calls_via')}
                  allowEmpty emptyLabel="-- None --" fullWidth
                />
                <TextField fullWidth label={t('field.caller_id')} value={defaults.caller_id}
                  onChange={(e) => setDefaults({ ...defaults, caller_id: e.target.value })}
                  helperText={t('config.caller_id_desc')} size="small" />
              </Box>
            </Grid>
            {/* Inbound default */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CallReceivedIcon sx={{ fontSize: 18, color: 'info.main' }} />
                <Typography variant="subtitle2">{t('route.type_inbound')}</Typography>
              </Box>
              <SearchableSelect
                options={extOptions}
                value={defaults.extension}
                onChange={(v) => setDefaults({ ...defaults, extension: v })}
                label={t('config.default_extension')} helperText={t('config.inbound_default')} fullWidth
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Extension Routes */}
      <Card>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{t('section.extension_routes')}</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={openAdd}>
              {t('route.add_extension_route')}
            </Button>
          </Box>
          <CrudTable<ExtensionRoute>
            rows={extRoutes.filter((r) => !vapiExtensions.has(r.extension) && !(r.description || '').includes('VAPI OUT'))}
            getKey={(r, i) => `${r.direction}-${r.extension}-${r.gateway}-${i}`}
            columns={[
              {
                id: 'user',
                header: t('field.user'),
                render: (r) => {
                  const isReg = registrations.some((reg) => {
                    const user = users.find((u) => u.extension === r.extension);
                    return user && reg.user === user.username;
                  });
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={isReg ? t('status.registered') : t('status.not_registered')}>
                        <Box
                          sx={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                            bgcolor: isReg ? 'success.main' : 'error.main',
                          }}
                        />
                      </Tooltip>
                      <Box>
                        <Typography variant="body2">
                          {r.username ? `${r.username} (${r.extension})` : r.extension}
                        </Typography>
                        {r.extDescription && (
                          <Typography variant="caption" color="text.secondary">{r.extDescription}</Typography>
                        )}
                      </Box>
                    </Box>
                  );
                },
                searchText: (r) => `${r.username} ${r.extension} ${r.extDescription}`,
              },
              {
                id: 'gateway',
                header: t('field.gateway'),
                render: (r) => {
                  const gw = gateways.find((g) => g.name === r.gateway);
                  return gw?.description ? `${r.gateway} (${gw.description})` : r.gateway;
                },
                searchText: (r) => r.gateway,
              },
              {
                id: 'description',
                header: t('field.name'),
                render: (r) => r.description || '\u2014',
                searchText: (r) => r.description,
              },
              {
                id: 'direction',
                header: t('route.direction'),
                render: (r) => {
                  if (r.direction === 'both') {
                    return (
                      <Tooltip title={t('route.type_both')}>
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          <CallReceivedIcon sx={{ fontSize: 16, color: 'info.main' }} />
                          <CallMadeIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                        </Box>
                      </Tooltip>
                    );
                  }
                  return (
                    <Tooltip title={r.direction === 'inbound' ? t('route.type_inbound') : t('route.type_outbound')}>
                      {r.direction === 'inbound'
                        ? <CallReceivedIcon sx={{ fontSize: 18, color: 'info.main' }} />
                        : <CallMadeIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
                    </Tooltip>
                  );
                },
              },
            ]}
            columnOrderKey="routes-extension-columns"
            searchable
            getStatus={(r) => r.enabled
              ? { label: t('status.active'), color: 'success' as const }
              : { label: t('status.inactive'), color: 'default' as const }
            }
            getEnabled={(r) => r.enabled}
            onToggle={toggleEnabled}
            onView={openView}
            onEdit={openEdit}
            onDelete={requestDelete}
            dimDisabled
            withCard={false}
          />
        </CardContent>
      </Card>

      {/* Extension Route Dialog */}
      <FormDialog
        open={dialogOpen}
        readOnly={viewMode}
        title={dialogTitle()}
        dirty={formDirty}
        onClose={() => setDialogOpen(false)}
        onSave={saveRoute}
      >
        <Box>
          <FormLabel>{t('route.direction')}</FormLabel>
          <RadioGroup
            row
            value={form.direction}
            onChange={(e) => setForm({ ...form, direction: e.target.value as RouteDirection })}
          >
            <FormControlLabel value="both" control={<Radio />} label={t('route.type_both')} disabled={viewMode} />
            <FormControlLabel value="inbound" control={<Radio />} label={t('route.type_inbound')} disabled={viewMode} />
            <FormControlLabel value="outbound" control={<Radio />} label={t('route.type_outbound')} disabled={viewMode} />
          </RadioGroup>
        </Box>
        <SearchableSelect
          options={extOptions}
          value={form.extension}
          onChange={(v) => setForm({ ...form, extension: v })}
          label={t('field.extension')}
          disabled={viewMode}
        />
        <SearchableSelect
          options={gwOptions}
          value={form.gateway}
          onChange={(v) => setForm({ ...form, gateway: v })}
          label={t('field.gateway')}
          disabled={viewMode}
        />
        <TextField
          label={t('field.name')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          disabled={viewMode}
        />
      </FormDialog>

      <ConfirmDialog open={confirmSave.open} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmSave} onCancel={() => setConfirmSave({ open: false, action: null })} />

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete({ open: false, name: '', action: null })} />

      {/* VAPI Routes */}
      {hasVapi && vapiConnected && (
        <VapiRoutes
          gateways={gateways}
          extensions={extensions}
          users={users}
          assistants={vapiAssistants}
          onToast={(msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' })}
          onReload={load}
        />
      )}

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}

// ── VAPI Routes Component ──

function VapiRoutes({ gateways, extensions, users, assistants, onToast, onReload }: {
  gateways: Gateway[];
  extensions: Extension[];
  users: User[];
  assistants: { id: string; name: string }[];
  onToast: (msg: string, ok: boolean) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const [vapiRoutes, setVapiRoutes] = useState<{ id: string; gateway: string; phone_number: string; extension: string; username: string; assistant_id: string; assistant_name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRouteId, setEditRouteId] = useState('');
  const [form, setForm] = useState({ gateway: '', extension: '', assistant_id: '', inbound: true, outbound: true });
  const [saving, setSaving] = useState(false);
  const [aclUsers, setAclUsers] = useState<{ username: string; ip: string; extension: string }[]>([]);
  const [vapiIps, setVapiIps] = useState('');
  const [addNbOpen, setAddNbOpen] = useState(false);
  const [nbForm, setNbForm] = useState({ extension: '', username: '' });
  const [nbSaving, setNbSaving] = useState(false);

  // Load ACL users + VAPI config
  useEffect(() => {
    api.get('/acl-users').then((r) => setAclUsers(r.data || [])).catch(() => {});
    api.get('/integrations/vapi').then((r) => {
      setVapiIps((r.data?.sip_ips || []).join(', '));
    }).catch(() => {});
  }, []);

  // Load existing VAPI phone numbers with their mappings
  useEffect(() => {
    api.get('/integrations/vapi/phone-numbers').then((res) => {
      const nums = res.data || [];
      setVapiRoutes(nums.map((n: Record<string, string>) => {
        const acl = aclUsers.find((u) => u.extension === n.extension);
        const asst = assistants.find((a) => a.id === n.assistantId);
        return {
          id: n.id,
          gateway: n.provider || 'vapi',
          phone_number: n.number,
          extension: n.extension || '',
          username: acl?.username || '',
          assistant_id: n.assistantId || '',
          assistant_name: asst?.name || '',
        };
      }));
    }).catch(() => {});
  }, [aclUsers, assistants]);

  // Gateway options (nur mit phone_number)
  const gwWithPhone = gateways.filter((g) => g.phone_number && g.name !== 'vapi');
  const gwOptions = gwWithPhone.map((g) => ({ label: `${g.name} (${g.phone_number})`, value: g.name }));

  // Extension options from ACL users with VAPI IPs
  const vapiAcls = aclUsers.filter((u) => {
    const ips = vapiIps.split(',').map((s) => s.trim());
    return ips.some((vip) => u.ip.includes(vip));
  });
  const extOptions = vapiAcls.map((u) => ({
    label: `${u.extension} — ${u.username}`,
    value: u.extension,
  }));

  // Assistant options
  const asstOptions = [
    { label: '\u2014', value: '' },
    ...assistants.map((a) => ({ label: a.name || a.id, value: a.id })),
  ];

  const handleSave = async () => {
    if (!form.extension || !form.assistant_id) {
      onToast('Nebenstelle und Assistant ausfüllen', false);
      return;
    }
    if (form.outbound && !form.gateway) {
      onToast('Gateway für Outbound wählen', false);
      return;
    }
    setSaving(true);
    try {
      const gw = gateways.find((g) => g.name === form.gateway);
      const acl = aclUsers.find((u) => u.extension === form.extension);
      const phoneNumber = gw?.phone_number || '';
      const username = acl?.username || '';

      // Create or update phone number on VAPI
      if (editRouteId) {
        await api.put(`/integrations/vapi/phone-number/${editRouteId}`, {
          assistant_id: form.assistant_id,
          extension: form.extension,
        }).catch(() => {});
      } else {
        await api.post('/integrations/vapi/phone-number', {
          number: phoneNumber || username,
          name: `${username}@TalkHub`,
          assistant_id: form.assistant_id,
          extension: form.extension,
          sip_username: username,
        });
      }

      // Inbound route: VAPI → NB
      if (form.inbound) {
        await api.post('/routes/inbound', {
          gateway: 'vapi',
          extension: form.extension,
          description: `VAPI IN: ${phoneNumber || 'any'} → ${form.extension}`,
          enabled: true,
        }).catch(() => {});
      }

      // Outbound route: NB → Gateway
      if (form.outbound && form.gateway) {
        await api.post('/routes/outbound', {
          pattern: '.*',
          gateway: form.gateway,
          prepend: '',
          strip: '',
          enabled: true,
        }).catch(() => {});

        // User route for this extension
        await api.post('/routes/user', {
          username: username,
          gateway: form.gateway,
          description: `VAPI OUT: ${form.extension} → ${form.gateway}`,
          enabled: true,
        }).catch(() => {});
      }

      await api.post('/config/apply').catch(() => {});

      setDialogOpen(false);
      setEditRouteId('');
      setForm({ gateway: '', extension: '', assistant_id: '', inbound: true, outbound: true });
      onToast(editRouteId ? 'AI Route aktualisiert' : `AI Route erstellt: ${username} ↔ ${form.gateway || 'inbound only'}`, true);
      onReload();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      onToast(e?.response?.data?.detail || 'Fehler', false);
    }
    setSaving(false);
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent sx={{ px: 4, py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">AI Routes</Typography>
          </Box>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            VAPI Route
          </Button>
        </Box>

        {vapiRoutes.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>Typ</TableCell>
                <TableCell>{t('gateway.phone_number')}</TableCell>
                <TableCell>{t('field.extension')}</TableCell>
                <TableCell>ACL User</TableCell>
                <TableCell>Assistant</TableCell>
                <TableCell sx={{ width: 80 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {vapiRoutes.filter((r) => r.extension).map((r) => (
                <TableRow key={r.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell><Chip label="VAPI" size="small" color="secondary" sx={{ height: 20, fontSize: 11 }} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.phone_number}</TableCell>
                  <TableCell>{r.extension}</TableCell>
                  <TableCell>{r.username}</TableCell>
                  <TableCell>{r.assistant_name || r.assistant_id || '\u2014'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={async () => {
                        setEditRouteId(r.id);
                        // Find outbound gateway from user routes
                        let outGw = '';
                        try {
                          const routeRes = await api.get('/routes');
                          const ur = (routeRes.data?.user_routes || []).find((u: { description?: string }) => (u.description || '').includes('VAPI OUT') && (u.description || '').includes(r.extension));
                          if (ur) outGw = ur.gateway;
                        } catch { /* ignore */ }
                        setForm({
                          gateway: outGw,
                          extension: r.extension,
                          assistant_id: r.assistant_id,
                          inbound: true,
                          outbound: !!outGw,
                        });
                        setDialogOpen(true);
                      }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={async () => {
                        try {
                          // Delete inbound routes for this extension
                          await api.delete(`/routes/inbound/vapi`).catch(() => {});
                          // Find and delete provider inbound for same extension
                          const routeRes = await api.get('/routes');
                          const inb = (routeRes.data?.inbound || []).filter((ir: { extension: string; gateway: string }) => ir.extension === r.extension && ir.gateway !== 'vapi');
                          for (const ir of inb) {
                            await api.delete(`/routes/inbound/${ir.gateway}`).catch(() => {});
                          }
                          // Delete user route
                          if (r.username) await api.delete(`/routes/user/${r.username}`).catch(() => {});
                          await api.post('/config/apply').catch(() => {});
                          onToast('AI Route gelöscht', true);
                          onReload();
                        } catch { onToast('Fehler beim Löschen', false); }
                      }}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Keine VAPI Routes. Erstellen Sie eine Route um eine Rufnummer mit einem VAPI Assistant zu verbinden.
          </Typography>
        )}

        {/* Create VAPI Route Dialog */}
        <FormDialog
          open={dialogOpen}
          title="VAPI Route erstellen"
          dirty={!!(form.gateway || form.extension || form.assistant_id)}
          onClose={() => { setDialogOpen(false); setEditRouteId(''); setForm({ gateway: '', extension: '', assistant_id: '', inbound: true, outbound: true }); }}
          onSave={handleSave}
          saveLabel={saving ? '...' : 'Route erstellen'}
        >
          {/* VAPI Seite */}
          <Typography variant="caption" color="primary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>VAPI</Typography>
          <SearchableSelect options={asstOptions} value={form.assistant_id}
            onChange={(v) => setForm({ ...form, assistant_id: v })}
            label="Assistant" />
          {form.extension && (() => {
            const acl = vapiAcls.find((u) => u.extension === form.extension);
            return acl ? (
              <TextField label="SIP URI (wird an VAPI gesendet)" size="small"
                value={`sip:${acl.username}@${vapiIps.split(',')[0]?.trim()}`}
                disabled InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
            ) : null;
          })()}

          {/* TalkHub Seite */}
          <Box sx={{ mt: 2 }} />
          <Typography variant="caption" color="secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>TalkHub</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <SearchableSelect options={extOptions} value={form.extension}
              onChange={(v) => setForm({ ...form, extension: v })}
              label="Nebenstelle (ACL)" sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" sx={{ mt: 1, whiteSpace: 'nowrap' }}
              onClick={() => setAddNbOpen(true)}>
              + NB
            </Button>
          </Box>

          {/* Richtung */}
          <Box sx={{ mt: 2 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Richtung</Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <FormControlLabel
              control={<Checkbox checked={form.inbound} onChange={(e) => setForm({ ...form, inbound: e.target.checked })} />}
              label="Inbound (VAPI → TalkHub)"
            />
            <FormControlLabel
              control={<Checkbox checked={form.outbound} onChange={(e) => setForm({ ...form, outbound: e.target.checked })} />}
              label="Outbound (TalkHub → PSTN)"
            />
          </Box>
          {form.outbound && (
            <SearchableSelect options={gwOptions} value={form.gateway}
              onChange={(v) => setForm({ ...form, gateway: v })}
              label="Outbound Gateway (Rufnummer)" />
          )}

          {/* Preview */}
          {form.extension && form.assistant_id && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12 }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>Vorschau:</Typography>
              {form.inbound && <Typography variant="body2" sx={{ fontSize: 12 }}>↓ Inbound: VAPI Assistant → NB {form.extension}</Typography>}
              {form.outbound && form.gateway && (() => {
                const gw = gateways.find((g) => g.name === form.gateway);
                return <Typography variant="body2" sx={{ fontSize: 12 }}>↑ Outbound: NB {form.extension} → {form.gateway} ({gw?.phone_number})</Typography>;
              })()}
            </Box>
          )}
        </FormDialog>

        {/* Quick Add VAPI NB Dialog */}
        <FormDialog
          open={addNbOpen}
          title="VAPI Nebenstelle erstellen"
          dirty={!!(nbForm.extension || nbForm.username)}
          onClose={() => { setAddNbOpen(false); setNbForm({ extension: '', username: '' }); }}
          onSave={async () => {
            if (!nbForm.extension || !nbForm.username) { onToast('Extension und Username ausfüllen', false); return; }
            setNbSaving(true);
            try {
              await api.post('/extensions', { extension: nbForm.extension, description: 'VAPI', enabled: true });
              await api.post('/acl-users', { username: nbForm.username, ip: vapiIps, extension: nbForm.extension, caller_id: '' });
              await api.post('/config/apply').catch(() => {});
              const r = await api.get('/acl-users');
              setAclUsers(r.data || []);
              setForm((prev) => ({ ...prev, extension: nbForm.extension }));
              setAddNbOpen(false);
              setNbForm({ extension: '', username: '' });
              onToast(`NB ${nbForm.extension} erstellt`, true);
            } catch (err: unknown) {
              const e = err as { response?: { data?: { detail?: string } } };
              onToast(e?.response?.data?.detail || 'Fehler', false);
            }
            setNbSaving(false);
          }}
          saveLabel={nbSaving ? '...' : 'Erstellen'}
        >
          <TextField label="Extension" placeholder="9000" value={nbForm.extension}
            onChange={(e) => setNbForm({ ...nbForm, extension: e.target.value.replace(/\D/g, '') })} />
          <TextField label="Username" placeholder="vapi1" value={nbForm.username}
            onChange={(e) => setNbForm({ ...nbForm, username: e.target.value })} />
          <TextField label="VAPI IPs" value={vapiIps} disabled
            helperText="Automatisch aus VAPI Integration" />
        </FormDialog>
      </CardContent>
    </Card>
  );
}
