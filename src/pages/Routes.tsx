import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, Grid,
  TextField, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import type { Route, Gateway, InboundRoute, OutboundRoute, UserRoute, Extension, User } from '../api/types';

type OutboundWithIndex = OutboundRoute & { _index: number };

export default function RoutesPage() {
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<Route | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [defaults, setDefaults] = useState({ gateway: '', extension: '1000', caller_id: '' });

  // Dialog state
  const [dialog, setDialog] = useState<{ type: string; open: boolean }>({ type: '', open: false });
  const [viewMode, setViewMode] = useState(false);
  const [editItem, setEditItem] = useState<{ type: string; key: string | number } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [initialForm, setInitialForm] = useState<Record<string, string>>({});
  const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const load = useCallback(async () => {
    const [r, g, e, u] = await Promise.all([api.get('/routes'), api.get('/gateways'), api.get('/extensions'), api.get('/users')]);
    setRoutes(r.data);
    setGateways(g.data || []);
    setExtensions(e.data || []);
    setUsers(u.data || []);
    if (r.data?.defaults) setDefaults(r.data.defaults);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doSaveDefaults = async () => {
    try {
      await api.put('/routes/defaults', defaults);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };
  const saveDefaults = () => setConfirmSave({ open: true, action: doSaveDefaults });

  // ── Open Add / View / Edit ──

  const openAdd = (type: string) => {
    setEditItem(null);
    setViewMode(false);
    setForm({});
    setInitialForm({});
    setDialog({ type, open: true });
  };

  const openViewInbound = (r: InboundRoute) => {
    setEditItem({ type: 'inbound', key: r.gateway });
    setViewMode(true);
    const f = { gateway: r.gateway, extension: r.extension };
    setForm(f); setInitialForm(f);
    setDialog({ type: 'inbound', open: true });
  };

  const openEditInbound = (r: InboundRoute) => {
    setEditItem({ type: 'inbound', key: r.gateway });
    setViewMode(false);
    const f = { gateway: r.gateway, extension: r.extension };
    setForm(f); setInitialForm(f);
    setDialog({ type: 'inbound', open: true });
  };

  const openViewOutbound = (r: OutboundWithIndex) => {
    setEditItem({ type: 'outbound', key: r._index });
    setViewMode(true);
    const f = { pattern: r.pattern, gateway: r.gateway, prepend: r.prepend || '', strip: String(r.strip || 0) };
    setForm(f); setInitialForm(f);
    setDialog({ type: 'outbound', open: true });
  };

  const openEditOutbound = (r: OutboundWithIndex) => {
    setEditItem({ type: 'outbound', key: r._index });
    setViewMode(false);
    const f = { pattern: r.pattern, gateway: r.gateway, prepend: r.prepend || '', strip: String(r.strip || 0) };
    setForm(f); setInitialForm(f);
    setDialog({ type: 'outbound', open: true });
  };

  const openViewUser = (r: UserRoute) => {
    setEditItem({ type: 'user', key: r.username });
    setViewMode(true);
    const f = { username: r.username, gateway: r.gateway };
    setForm(f); setInitialForm(f);
    setDialog({ type: 'user', open: true });
  };

  const openEditUser = (r: UserRoute) => {
    setEditItem({ type: 'user', key: r.username });
    setViewMode(false);
    const f = { username: r.username, gateway: r.gateway };
    setForm(f); setInitialForm(f);
    setDialog({ type: 'user', open: true });
  };

  // ── Save (Add or Edit) ──

  const doSaveRoute = async () => {
    try {
      if (editItem) {
        // Edit existing
        if (dialog.type === 'inbound') {
          await api.put(`/routes/inbound/${editItem.key}`, { gateway: form.gateway, extension: form.extension });
        } else if (dialog.type === 'outbound') {
          await api.put(`/routes/outbound/${editItem.key}`, { pattern: form.pattern, gateway: form.gateway, prepend: form.prepend, strip: parseInt(form.strip) || 0 });
        } else if (dialog.type === 'user') {
          await api.put(`/routes/user/${editItem.key}`, { username: form.username, gateway: form.gateway });
        }
      } else {
        // Add new
        if (dialog.type === 'inbound') {
          await api.post('/routes/inbound', { gateway: form.gateway, extension: form.extension, enabled: true });
        } else if (dialog.type === 'outbound') {
          await api.post('/routes/outbound', { pattern: form.pattern, gateway: form.gateway, prepend: form.prepend, strip: parseInt(form.strip) || 0, enabled: true });
        } else if (dialog.type === 'user') {
          await api.post('/routes/user', { username: form.username, gateway: form.gateway, enabled: true });
        }
      }
      setDialog({ type: '', open: false });
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };
  const saveRoute = () => setConfirmSave({ open: true, action: doSaveRoute });

  // ── Delete ──

  const requestDeleteInbound = (gateway: string) => {
    setConfirmDelete({ open: true, name: gateway, action: async () => { await api.delete(`/routes/inbound/${gateway}`); load(); } });
  };

  const requestDeleteOutbound = (index: number, pattern: string) => {
    setConfirmDelete({ open: true, name: pattern, action: async () => { await api.delete(`/routes/outbound/${index}`); load(); } });
  };

  const requestDeleteUser = (username: string) => {
    setConfirmDelete({ open: true, name: username, action: async () => { await api.delete(`/routes/user/${username}`); load(); } });
  };

  // ── Toggle ──

  const toggleInbound = async (gateway: string, enabled: boolean) => {
    try { await api.put(`/routes/inbound/${gateway}`, { enabled }); load(); }
    catch { setToast({ open: true, message: t('status.error'), severity: 'error' }); }
  };
  const toggleOutbound = async (index: number, enabled: boolean) => {
    try { await api.put(`/routes/outbound/${index}`, { enabled }); load(); }
    catch { setToast({ open: true, message: t('status.error'), severity: 'error' }); }
  };
  const toggleUserRoute = async (username: string, enabled: boolean) => {
    try { await api.put(`/routes/user/${username}`, { enabled }); load(); }
    catch { setToast({ open: true, message: t('status.error'), severity: 'error' }); }
  };

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

  const gwNames = gateways.map((g) => g.name);
  const extOptions = extensions.filter((e) => e.enabled !== false).map((e) => ({ label: `${e.extension} — ${e.description}`, value: e.extension }));
  const userOptions = users.filter((u) => u.enabled !== false).map((u) => ({ label: `${u.username} — ${u.caller_id || u.extension}`, value: u.username }));
  const outboundRows: OutboundWithIndex[] = (routes?.outbound || []).map((r, i) => ({ ...r, _index: i }));

  const dialogTitle = () => {
    if (viewMode) return t('route.view_route');
    if (editItem) return t('route.edit_route');
    return t('route.add_route');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('section.routes')}</Typography>

      {/* Defaults */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('section.default_routes')}</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <SearchableSelect
                options={gwNames} value={defaults.gateway}
                onChange={(v) => setDefaults({ ...defaults, gateway: v })}
                label={t('config.default_gateway')} helperText={t('config.outbound_calls_via')}
                allowEmpty emptyLabel="-- None --" fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <SearchableSelect
                options={extOptions}
                value={defaults.extension}
                onChange={(v) => setDefaults({ ...defaults, extension: v })}
                label={t('config.default_extension')} helperText={t('config.inbound_default')} fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label={t('field.caller_id')} value={defaults.caller_id}
                onChange={(e) => setDefaults({ ...defaults, caller_id: e.target.value })}
                helperText={t('config.caller_id_desc')} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={saveDefaults}>{t('button.save_defaults')}</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inbound Routes */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">{t('section.inbound_routing')}</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => openAdd('inbound')}>
              {t('route.add_inbound')}
            </Button>
          </Box>
          <CrudTable<InboundRoute>
            rows={routes?.inbound || []}
            getKey={(r, i) => `inbound-${i}`}
            columns={[
              { header: t('field.gateway'), field: 'gateway' },
              { header: t('field.extension'), field: 'extension' },
            ]}
            getEnabled={(r) => r.enabled !== false}
            onToggle={(r) => toggleInbound(r.gateway, r.enabled === false)}
            onView={openViewInbound}
            onEdit={openEditInbound}
            onDelete={(r) => requestDeleteInbound(r.gateway)}
            dimDisabled
            withCard={false}
          />
        </CardContent>
      </Card>

      {/* Outbound Routes */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">{t('section.outbound_routing')}</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => openAdd('outbound')}>
              {t('route.add_route')}
            </Button>
          </Box>
          <CrudTable<OutboundWithIndex>
            rows={outboundRows}
            getKey={(r) => `outbound-${r._index}`}
            columns={[
              { header: t('field.pattern'), field: 'pattern' },
              { header: t('field.gateway'), field: 'gateway' },
            ]}
            getEnabled={(r) => r.enabled !== false}
            onToggle={(r) => toggleOutbound(r._index, r.enabled === false)}
            onView={openViewOutbound}
            onEdit={openEditOutbound}
            onDelete={(r) => requestDeleteOutbound(r._index, r.pattern)}
            dimDisabled
            withCard={false}
          />
        </CardContent>
      </Card>

      {/* User Routes */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">{t('section.user_routing')}</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => openAdd('user')}>
              {t('route.add_user_route')}
            </Button>
          </Box>
          <CrudTable<UserRoute>
            rows={routes?.user_routes || []}
            getKey={(r, i) => `user-${i}`}
            columns={[
              { header: t('field.user'), field: 'username' },
              { header: t('field.gateway'), field: 'gateway' },
            ]}
            getEnabled={(r) => r.enabled !== false}
            onToggle={(r) => toggleUserRoute(r.username, r.enabled === false)}
            onView={openViewUser}
            onEdit={openEditUser}
            onDelete={(r) => requestDeleteUser(r.username)}
            dimDisabled
            withCard={false}
          />
        </CardContent>
      </Card>

      {/* Route Dialog (Add / Edit / View) */}
      <FormDialog
        open={dialog.open}
        readOnly={viewMode}
        title={dialogTitle()}
        dirty={formDirty}
        onClose={() => setDialog({ type: '', open: false })}
        onSave={saveRoute}
      >
        {dialog.type === 'inbound' && (
          <>
            <SearchableSelect options={gwNames} value={form.gateway || ''} onChange={(v) => setForm({ ...form, gateway: v })} label={t('field.gateway')} disabled={viewMode} />
            <SearchableSelect
              options={extOptions}
              value={form.extension || ''} onChange={(v) => setForm({ ...form, extension: v })} label={t('field.extension')} disabled={viewMode}
            />
          </>
        )}
        {dialog.type === 'outbound' && (
          <>
            <TextField label={t('field.pattern')} value={form.pattern || ''} onChange={(e) => setForm({ ...form, pattern: e.target.value })} disabled={viewMode} />
            <SearchableSelect options={gwNames} value={form.gateway || ''} onChange={(v) => setForm({ ...form, gateway: v })} label={t('field.gateway')} disabled={viewMode} />
          </>
        )}
        {dialog.type === 'user' && (
          <>
            <SearchableSelect
              options={userOptions}
              value={form.username || ''}
              onChange={(v) => setForm({ ...form, username: v })}
              label={t('field.user')}
              disabled={viewMode || !!editItem}
            />
            <SearchableSelect options={gwNames} value={form.gateway || ''} onChange={(v) => setForm({ ...form, gateway: v })} label={t('field.gateway')} disabled={viewMode} />
          </>
        )}
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
