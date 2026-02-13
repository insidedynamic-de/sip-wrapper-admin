/**
 * @file RoutesPage — Routing configuration: Defaults + unified Extension Routes
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button,
  TextField, Snackbar, Alert, Tooltip,
  RadioGroup, Radio, FormControlLabel, FormLabel,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import type { Route, Gateway, GatewayStatus, Extension, User, Registration } from '../api/types';

interface ExtensionRoute {
  extension: string;
  username: string;
  gateway: string;
  description: string;
  extDescription: string;
  direction: 'inbound' | 'outbound';
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editRoute, setEditRoute] = useState<ExtensionRoute | null>(null);
  const [form, setForm] = useState({ extension: '', gateway: '', direction: 'inbound' as 'inbound' | 'outbound', description: '' });
  const [initialForm, setInitialForm] = useState({ extension: '', gateway: '', direction: 'inbound' as 'inbound' | 'outbound', description: '' });
  const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const load = useCallback(async () => {
    const [r, g, gs, e, u, reg] = await Promise.all([
      api.get('/routes'), api.get('/gateways'), api.get('/gateways/status'),
      api.get('/extensions'), api.get('/users'), api.get('/registrations'),
    ]);
    setRoutes(r.data);
    setGateways(g.data || []);
    setGatewayStatuses(gs.data || []);
    setExtensions(e.data || []);
    setUsers(u.data || []);
    setRegistrations(reg.data || []);
    if (r.data?.defaults) setDefaults(r.data.defaults);
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

    // Inbound routes
    for (const ib of routes.inbound || []) {
      const ext = extensions.find((e) => e.extension === ib.extension);
      const user = users.find((u) => u.extension === ib.extension);
      rows.push({
        extension: ib.extension,
        username: user?.username || '',
        gateway: ib.gateway,
        description: ib.description || '',
        extDescription: ext?.description || '',
        direction: 'inbound',
        enabled: ib.enabled !== false,
      });
    }

    // Outbound routes (user_routes)
    for (const ur of routes.user_routes || []) {
      const user = users.find((u) => u.username === ur.username);
      const ext = user ? extensions.find((e) => e.extension === user.extension) : null;
      rows.push({
        extension: user?.extension || '',
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

  const gwOptions = gateways.map((g) => ({
    label: g.description ? `${g.name} \u2014 ${g.description}` : g.name,
    value: g.name,
  }));
  const extOptions = extensions
    .filter((e) => e.enabled !== false)
    .map((e) => ({ label: `${e.extension} \u2014 ${e.description}`, value: e.extension }));

  // ── Open Add / View / Edit ──

  const openAdd = () => {
    setEditRoute(null);
    setViewMode(false);
    const f = { extension: '', gateway: '', direction: 'inbound' as const, description: '' };
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
    // Check for duplicate (same extension + gateway + direction)
    const isDuplicate = extRoutes.some((r) =>
      r.extension === form.extension && r.gateway === form.gateway && r.direction === form.direction &&
      !(editRoute && r.extension === editRoute.extension && r.gateway === editRoute.gateway && r.direction === editRoute.direction)
    );
    if (isDuplicate) {
      setToast({ open: true, message: t('route.error_duplicate'), severity: 'error' });
      return;
    }
    try {
      const dirChanged = editRoute && editRoute.direction !== form.direction;
      const extChanged = editRoute && editRoute.extension !== form.extension;

      // If direction or extension changed, delete old route first then create new
      if (editRoute && (dirChanged || extChanged)) {
        if (editRoute.direction === 'inbound') {
          await api.delete(`/routes/inbound/${editRoute.gateway}`);
        } else {
          await api.delete(`/routes/user/${editRoute.username}`);
        }
        // Create as new
        if (form.direction === 'inbound') {
          await api.post('/routes/inbound', {
            gateway: form.gateway, extension: form.extension, description: form.description, enabled: editRoute.enabled,
          });
        } else {
          const user = users.find((u) => u.extension === form.extension);
          if (user) {
            await api.post('/routes/user', {
              username: user.username, gateway: form.gateway, description: form.description, enabled: editRoute.enabled,
            });
          }
        }
      } else if (editRoute) {
        // Simple update — same direction and extension
        if (form.direction === 'inbound') {
          await api.put(`/routes/inbound/${editRoute.gateway}`, {
            gateway: form.gateway, extension: form.extension, description: form.description,
          });
        } else {
          await api.put(`/routes/user/${editRoute.username}`, {
            username: editRoute.username, gateway: form.gateway, description: form.description,
          });
        }
      } else {
        // New route
        if (form.direction === 'inbound') {
          await api.post('/routes/inbound', {
            gateway: form.gateway, extension: form.extension, description: form.description, enabled: true,
          });
        } else {
          const user = users.find((u) => u.extension === form.extension);
          if (user) {
            await api.post('/routes/user', {
              username: user.username, gateway: form.gateway, description: form.description, enabled: true,
            });
          }
        }
      }
      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
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
        if (r.direction === 'inbound') {
          await api.delete(`/routes/inbound/${r.gateway}`);
        } else {
          await api.delete(`/routes/user/${r.username}`);
        }
        load();
      },
    });
  };

  // ── Toggle enabled ──

  const toggleEnabled = async (r: ExtensionRoute) => {
    try {
      const newEnabled = !r.enabled;
      if (r.direction === 'inbound') {
        await api.put(`/routes/inbound/${r.gateway}`, { enabled: newEnabled });
      } else {
        await api.put(`/routes/user/${r.username}`, { enabled: newEnabled });
      }
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
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
            rows={extRoutes}
            getKey={(r) => `${r.direction}-${r.extension}-${r.gateway}`}
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
                render: (r) => (
                  <Tooltip title={r.direction === 'inbound' ? t('route.type_inbound') : t('route.type_outbound')}>
                    {r.direction === 'inbound'
                      ? <CallReceivedIcon sx={{ fontSize: 18, color: 'info.main' }} />
                      : <CallMadeIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
                  </Tooltip>
                ),
              },
            ]}
            columnOrderKey="routes-extension-columns"
            searchable
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
            onChange={(e) => setForm({ ...form, direction: e.target.value as 'inbound' | 'outbound' })}
          >
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

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
