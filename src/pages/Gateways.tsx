/**
 * @file Gateways — SIP gateway/provider management with CRUD
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Chip,
  TextField, Snackbar, Alert, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import SearchableSelect from '../components/SearchableSelect';
import type { Gateway, GatewayStatus } from '../api/types';

const TRANSPORT_OPTIONS = ['udp', 'tcp', 'tls'];
const TYPE_OPTIONS = ['provider', 'pbx', 'ai_platform', 'other'];

function gwChipColor(state: string): 'success' | 'error' | 'warning' {
  if (state === 'REGED') return 'success';
  if (state === 'FAIL' || state === 'NOREG') return 'error';
  return 'warning';
}

export default function Gateways() {
  const { t } = useTranslation();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gwStatuses, setGwStatuses] = useState<GatewayStatus[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editGw, setEditGw] = useState<Gateway | null>(null);
  const defaultForm = { name: '', description: '', type: 'provider', host: '', port: 5060, username: '', password: '', register: true, transport: 'udp', auth_username: '', enabled: true };
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string }>({ open: false, name: '' });

  const load = useCallback(async () => {
    const [gwRes, statusRes] = await Promise.all([
      api.get('/gateways'),
      api.get('/gateways/status'),
    ]);
    setGateways(gwRes.data || []);
    setGwStatuses(statusRes.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const openAdd = () => {
    setEditGw(null);
    setViewMode(false);
    const fresh = { ...defaultForm };
    setForm(fresh);
    setInitialForm(fresh);
    setDialogOpen(true);
  };

  const openView = (gw: Gateway) => {
    setEditGw(gw);
    setViewMode(true);
    const gwForm = { ...gw, description: gw.description || '', auth_username: gw.auth_username || '', enabled: gw.enabled !== false };
    setForm(gwForm);
    setInitialForm(gwForm);
    setDialogOpen(true);
  };

  const openEdit = (gw: Gateway) => {
    setEditGw(gw);
    setViewMode(false);
    const gwForm = { ...gw, description: gw.description || '', auth_username: gw.auth_username || '', enabled: gw.enabled !== false };
    setForm(gwForm);
    setInitialForm(gwForm);
    setDialogOpen(true);
  };

  const requestSave = () => setConfirmSave(true);

  const doSave = async () => {
    setConfirmSave(false);
    try {
      if (editGw) await api.put(`/gateways/${editGw.name}`, form);
      else await api.post('/gateways', form);
      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const toggleEnabled = async (gw: Gateway) => {
    try {
      await api.put(`/gateways/${gw.name}`, { enabled: !(gw.enabled !== false) });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const requestDelete = (name: string) => setConfirmDelete({ open: true, name });

  const doDelete = async () => {
    const name = confirmDelete.name;
    setConfirmDelete({ open: false, name: '' });
    try {
      await api.delete(`/gateways/${name}`);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const f = (key: string, val: string | number | boolean) => setForm({ ...form, [key]: val });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('gateway.sip_gateways')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{t('gateway.add_gateway')}</Button>
      </Box>

      <CrudTable<Gateway>
        rows={gateways}
        getKey={(gw) => gw.name}
        columns={[
          { id: 'name', header: t('field.name'), render: (gw) => gw.description ? `${gw.name} (${gw.description})` : gw.name, searchText: (gw) => `${gw.name} ${gw.description || ''}` },
          { id: 'type', header: t('field.type'), render: (gw) => <Chip size="small" label={gw.type} />, searchText: (gw) => gw.type },
          { id: 'host', header: t('field.host'), render: (gw) => `${gw.host}:${gw.port}`, searchText: (gw) => `${gw.host}:${gw.port}` },
          { id: 'transport', header: t('field.transport'), field: 'transport' },
        ]}
        columnOrderKey="gateways-columns"
        searchable
        getStatus={(gw) => {
          const st = gwStatuses.find((s) => s.name === gw.name);
          return st
            ? { label: st.state, color: gwChipColor(st.state) }
            : { label: '\u2014', color: 'default' };
        }}
        getEnabled={(gw) => gw.enabled !== false}
        onToggle={(gw) => toggleEnabled(gw)}
        onView={openView}
        onEdit={openEdit}
        onDelete={(gw) => requestDelete(gw.name)}
      />

      <FormDialog
        open={dialogOpen}
        readOnly={viewMode}
        title={viewMode ? t('modal.view_gateway') : editGw ? t('modal.edit_gateway') : t('modal.add_gateway')}
        dirty={dirty}
        onClose={() => setDialogOpen(false)}
        onSave={requestSave}
      >
        <TextField label={t('field.name')} value={form.name} onChange={(e) => f('name', e.target.value)} disabled={viewMode} />
        <TextField label={t('extension.description')} value={form.description} onChange={(e) => f('description', e.target.value)} disabled={viewMode} />
        <SearchableSelect options={TYPE_OPTIONS} value={form.type} onChange={(v) => f('type', v)} label={t('field.type')} disabled={viewMode} />
        <TextField label={t('field.host')} value={form.host} onChange={(e) => f('host', e.target.value)} disabled={viewMode} />
        <TextField label={t('field.port')} type="number" value={form.port} onChange={(e) => f('port', parseInt(e.target.value) || 5060)} disabled={viewMode} />
        <TextField label={t('auth.username')} value={form.username} onChange={(e) => f('username', e.target.value)} disabled={viewMode} />
        <TextField label={t('auth.password')} type="password" value={form.password} onChange={(e) => f('password', e.target.value)} disabled={viewMode} />
        <TextField label={t('gateway.auth_username')} value={form.auth_username} onChange={(e) => f('auth_username', e.target.value)} helperText={t('gateway.auth_username_hint')} disabled={viewMode} />
        <SearchableSelect options={TRANSPORT_OPTIONS} value={form.transport} onChange={(v) => f('transport', v)} label={t('field.transport')} disabled={viewMode} />
        <FormControlLabel
          control={<Switch checked={form.enabled} onChange={(e) => f('enabled', e.target.checked)} color="success" disabled={viewMode} />}
          label={form.enabled ? t('status.enabled') : t('status.disabled')}
        />
      </FormDialog>

      <ConfirmDialog open={confirmSave} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={doSave} onCancel={() => setConfirmSave(false)} />

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={doDelete} onCancel={() => setConfirmDelete({ open: false, name: '' })} />

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
