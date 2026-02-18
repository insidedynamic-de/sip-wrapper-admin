/**
 * @file LicenseTab — License management (CRUD), activation, connection summary
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, TextField, Button, Chip,
  IconButton, Tooltip, Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import Toast from '../components/Toast';

interface LicenseEntry {
  license_key: string;
  product: string;
  subproduct: string;
  license_name: string;
  type: 'partner' | 'client' | 'internal' | 'trial' | 'demo' | 'nfr';
  client_name: string;
  licensed: boolean;
  valid_until: string;
  days_remaining: number;
  max_connections: number;
  version: string;
  server_id?: string;
  bound_to?: string;
  features?: string[];
  sku?: string;
}

interface AvailableLicense {
  license_key: string;
  product: string;
  subproduct: string;
  license_name: string;
  max_connections: number;
  valid_until: string;
  bound_to?: string;
  server_name?: string;
  licensed: boolean;
  type?: string;
  features?: string[];
  sku?: string;
}

export default function LicenseTab() {
  const { t } = useTranslation();

  const [licenses, setLicenses] = useState<LicenseEntry[]>([]);
  const [availableLicenses, setAvailableLicenses] = useState<AvailableLicense[]>([]);
  const [totalConnections, setTotalConnections] = useState(0);
  const [routingCount, setRoutingCount] = useState(0);
  const [serverId, setServerId] = useState('');
  const [companyId, setCompanyId] = useState('');

  // Activate license
  const [licenseKey, setLicenseKey] = useState('');

  // View dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLicense, setDialogLicense] = useState<LicenseEntry | null>(null);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  /** Notify sidebar, integrations page, etc. that licenses changed */
  const notifyLicenseChanged = () => window.dispatchEvent(new Event('license-changed'));

  const load = useCallback(async () => {
    try {
      const [licRes, routeRes, compRes] = await Promise.all([
        api.get('/license'),
        api.get('/routes'),
        api.get('/company'),
      ]);
      const data = licRes.data || {};
      setLicenses(data.licenses || []);
      setTotalConnections(data.total_connections || 0);
      setServerId(data.server_id || '');
      setCompanyId(compRes.data?.company_id || '');
      // Count enabled routings (inbound + outbound user routes)
      const rd = routeRes.data;
      if (rd) {
        const inb = (rd.inbound || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        const usr = (rd.user_routes || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        setRoutingCount(inb + usr);
      }
    } catch { /* ignore */ }
    // Fetch available licenses separately (endpoint may not exist)
    try {
      const availRes = await api.get('/license/available');
      const all: AvailableLicense[] = availRes.data || [];
      setAvailableLicenses(all.filter((a) => !a.bound_to && !a.licensed && (!a.valid_until || new Date(a.valid_until) >= new Date())));
    } catch {
      setAvailableLicenses([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client type label
  const typeLabel = (l: LicenseEntry) => t(`license.type_${l.type}`) || l.type;

  // Activate license
  const doActivateLicense = async () => {
    try {
      await api.put('/license', { license_key: licenseKey });
      setLicenseKey('');
      showToast(t('status.success'), true);
      load();
      notifyLicenseChanged();
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { message?: string } } })?.response?.data;
      const msgKey = resp?.message;
      if (msgKey === 'license_duplicate') {
        showToast(t('license.error_duplicate'), false);
      } else if (msgKey === 'license_invalid') {
        showToast(t('license.error_invalid'), false);
      } else {
        showToast(t('status.error'), false);
      }
    }
  };
  const activateLicense = () => setConfirmSave({ open: true, action: doActivateLicense });

  // Reactivate a deactivated license (same flow as activate with existing key)
  const reactivateLicense = (l: LicenseEntry) => {
    setConfirmSave({
      open: true,
      action: async () => {
        try {
          await api.put('/license', { license_key: l.license_key });
          showToast(t('status.success'), true);
          load();
          notifyLicenseChanged();
        } catch {
          showToast(t('status.error'), false);
        }
      },
    });
  };

  // Refresh
  const refreshLicense = async () => {
    try {
      await api.post('/license/refresh');
      showToast(t('license.refresh_success'), true);
      load();
    } catch { showToast(t('license.refresh_failed'), false); }
  };

  // View license
  const openView = (l: LicenseEntry) => {
    setDialogLicense(l);
    setDialogOpen(true);
  };

  // Deactivate license (Abmeldung)
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const requestDeactivate = (l: LicenseEntry) => {
    setConfirmDeactivate({
      open: true,
      name: l.license_key,
      action: async () => {
        try {
          await api.delete(`/license/${encodeURIComponent(l.license_key)}`);
          showToast(t('license.deactivate_success'), true);
          load();
          notifyLicenseChanged();
        } catch (err: unknown) {
          const resp = (err as { response?: { data?: { message?: string } } })?.response?.data;
          if (resp?.message === 'license_already_deactivated') {
            showToast(t('license.error_already_deactivated'), false);
          } else {
            showToast(t('status.error'), false);
          }
        }
      },
    });
  };
  const handleConfirmDeactivate = async () => {
    const a = confirmDeactivate.action;
    setConfirmDeactivate({ open: false, name: '', action: null });
    if (a) await a();
  };

  // Delete license
  const requestDelete = (l: LicenseEntry) => {
    setConfirmDelete({
      open: true,
      name: l.license_key,
      action: async () => {
        await api.delete(`/license/${encodeURIComponent(l.license_key)}`);
        load();
        notifyLicenseChanged();
      },
    });
  };

  // Install available license
  const [confirmInstall, setConfirmInstall] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const requestInstall = (al: AvailableLicense) => {
    setConfirmInstall({
      open: true,
      name: `${al.license_name} (${al.license_key})`,
      action: async () => {
        try {
          await api.put('/license', { license_key: al.license_key });
          showToast(t('status.success'), true);
          load();
          notifyLicenseChanged();
        } catch (err: unknown) {
          const resp = (err as { response?: { data?: { message?: string } } })?.response?.data;
          const msgKey = resp?.message;
          if (msgKey === 'license_duplicate') {
            showToast(t('license.error_duplicate'), false);
          } else {
            showToast(t('status.error'), false);
          }
        }
      },
    });
  };
  const handleConfirmInstall = async () => {
    const a = confirmInstall.action;
    setConfirmInstall({ open: false, name: '', action: null });
    if (a) await a();
  };

  // Confirm handlers
  const handleConfirmSave = async () => {
    const a = confirmSave.action;
    setConfirmSave({ open: false, action: null });
    if (a) await a();
  };
  const handleConfirmDelete = async () => {
    const a = confirmDelete.action;
    setConfirmDelete({ open: false, name: '', action: null });
    if (a) await a();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshLicense}>
          {t('license.refresh_license')}
        </Button>
      </Box>

      {/* Connection summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 2 }}>
          <Box sx={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">{t('license.routing_connections')}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: routingCount > totalConnections ? 'error.main' : 'text.primary' }}>
                {routingCount} / {totalConnections}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">{t('license.total_licenses')}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{licenses.length}</Typography>
            </Box>
            {companyId && (
              <Box>
                <Typography variant="body2" color="text.secondary">{t('setup.company_id')}</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{companyId}</Typography>
              </Box>
            )}
            {serverId && (
              <Box>
                <Typography variant="body2" color="text.secondary">{t('license.server_id')}</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{serverId}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Available licenses */}
      {availableLicenses.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t('license.available_licenses')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('license.available_hint')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
            {availableLicenses.map((al) => (
              <Card key={al.license_key} variant="outlined" sx={{ transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }}>
                <CardContent sx={{ pb: '8px !important', pt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Chip size="small" label={al.license_name} color="primary" />
                    <Tooltip title={t('license.install')}>
                      <IconButton size="small" color="success" onClick={() => requestInstall(al)}>
                        <AddCircleOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                    {al.license_key}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {al.product} / {al.subproduct}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                    {al.max_connections > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {t('license.connections')}: <strong>{al.max_connections}</strong>
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {t('license.valid_until')}: {al.valid_until}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {availableLicenses.length === 0 && licenses.length > 0 && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('license.no_available')}
        </Alert>
      )}

      {/* Licenses table */}
      <CrudTable<LicenseEntry>
        rows={licenses}
        getKey={(l) => l.license_key}
        columns={[
          { id: 'key', header: t('license.license_key'), render: (l) => (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{l.license_key}</Typography>
          ), searchText: (l) => l.license_key },
          { id: 'product', header: t('license.product'), render: (l) => l.product || '\u2014' },
          { id: 'subproduct', header: t('license.subproduct'), render: (l) => l.subproduct || '\u2014' },
          { id: 'license_name', header: t('license.license_name'), render: (l) => (
            <Chip size="small" label={l.license_name} color="primary" />
          )},
          { id: 'type', header: t('license.client_type'), render: (l) => (
            <Chip size="small" label={typeLabel(l)}
              color={l.type === 'partner' ? 'info' : l.type === 'internal' ? 'warning' : 'success'} />
          )},
          { id: 'client', header: t('license.client'), render: (l) => l.client_name || '\u2014', searchText: (l) => l.client_name },
          { id: 'valid_until', header: t('license.valid_until'), render: (l) => l.valid_until || '\u2014' },
          { id: 'connections', header: t('license.connections'), render: (l) => (
            <Typography component="span" sx={{ fontWeight: 600 }}>{l.max_connections}</Typography>
          )},
          { id: 'sku', header: t('license.sku'), render: (l) => (
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{l.sku || '\u2014'}</Typography>
          )},
        ]}
        columnOrderKey="license-columns"
        searchable
        getStatus={(l) => ({
          label: l.licensed ? t('license.licensed') : t('license.deactivated'),
          color: l.licensed ? 'success' : 'error',
        })}
        getEnabled={(l) => l.licensed}
        onToggle={(l) => l.licensed ? requestDeactivate(l) : reactivateLicense(l)}
        onView={openView}
        onDelete={requestDelete}
      />

      {/* Activate License */}
      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('license.activate_license')}</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              label={t('license.license_key')}
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              sx={{ flex: 1 }}
              size="small"
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
            <Button variant="contained" onClick={activateLicense} disabled={!licenseKey.trim()}>
              {t('license.activate_license')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* License View Dialog */}
      <FormDialog
        open={dialogOpen}
        readOnly
        title={t('license.license_info')}
        dirty={false}
        onClose={() => setDialogOpen(false)}
        onSave={() => {}}
      >
        {dialogLicense && (
          <>
            <TextField label={t('license.license_key')} value={dialogLicense.license_key} disabled />
            <TextField label={t('license.product')} value={dialogLicense.product} disabled />
            <TextField label={t('license.subproduct')} value={dialogLicense.subproduct} disabled />
            <TextField label={t('license.license_name')} value={dialogLicense.license_name} disabled />
            <TextField label={t('license.client_type')} value={typeLabel(dialogLicense)} disabled />
            <TextField label={t('license.client_name')} value={dialogLicense.client_name} disabled />
            <TextField label={t('license.valid_until')} value={dialogLicense.valid_until || '\u2014'} disabled />
            <TextField label={t('license.connections')} value={dialogLicense.max_connections} disabled />
            {dialogLicense.sku && (
              <TextField label={t('license.sku')} value={dialogLicense.sku} disabled />
            )}
            {dialogLicense.features && dialogLicense.features.length > 0 && (
              <TextField label={t('license.features')} value={dialogLicense.features.join(', ')} disabled />
            )}
            <TextField label={t('license.version')} value={dialogLicense.version || '\u2014'} disabled />
            {dialogLicense.server_id && (
              <TextField label={t('license.server_id')} value={dialogLicense.server_id} disabled />
            )}
          </>
        )}
      </FormDialog>

      <ConfirmDialog open={confirmSave.open} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmSave} onCancel={() => setConfirmSave({ open: false, action: null })} />

      <ConfirmDialog open={confirmDeactivate.open} variant="delete"
        title={t('license.deactivate_title')}
        message={t('license.deactivate_message', { name: confirmDeactivate.name })}
        confirmLabel={t('license.deactivate')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmDeactivate} onCancel={() => setConfirmDeactivate({ open: false, name: '', action: null })} />

      <ConfirmDialog open={confirmInstall.open} variant="save"
        title={t('license.install_title')}
        message={t('license.install_message', { name: confirmInstall.name })}
        confirmLabel={t('license.install')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmInstall} onCancel={() => setConfirmInstall({ open: false, name: '', action: null })} />

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete({ open: false, name: '', action: null })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
