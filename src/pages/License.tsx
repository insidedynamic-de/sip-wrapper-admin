/**
 * @file License — License management (CRUD), company data, and invoice settings
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, TextField, Button, Chip,
  Switch, FormControlLabel, IconButton, Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import Toast from '../components/Toast';
import { isDemoMode } from '../store/preferences';

interface LicenseEntry {
  license_key: string;
  client_name: string;
  licensed: boolean;
  expires: string;
  trial: boolean;
  nfr: boolean;
  days_remaining: number;
  max_connections: number;
  version: string;
  server_id?: string;
  bound_to?: string;
}

const DEMO_KEYS = ['DEMO-0000-0000-0001', 'DEMO-0000-0000-0002', 'DEMO-0000-0000-0003'];

export default function License() {
  const { t } = useTranslation();
  const demo = isDemoMode();

  const [licenses, setLicenses] = useState<LicenseEntry[]>([]);
  const [totalConnections, setTotalConnections] = useState(0);
  const [routingCount, setRoutingCount] = useState(0);
  const [serverId, setServerId] = useState('');
  const [company, setCompany] = useState({
    company_name: '', company_email: '', company_phone: '',
    company_address: '', company_zip: '', company_city: '', company_country: '',
  });
  const [invoice, setInvoice] = useState({
    same_as_company: true, invoice_name: '', invoice_address: '', invoice_email: '',
  });

  // Activate license
  const [licenseKey, setLicenseKey] = useState('');

  // View dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLicense, setDialogLicense] = useState<LicenseEntry | null>(null);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  const load = useCallback(async () => {
    try {
      const [licRes, compRes, invRes, routeRes] = await Promise.all([
        api.get('/license'),
        api.get('/company'),
        api.get('/invoice'),
        api.get('/routes'),
      ]);
      const data = licRes.data || {};
      setLicenses(data.licenses || []);
      setTotalConnections(data.total_connections || 0);
      setServerId(data.server_id || '');
      // Count enabled routings (inbound + outbound user routes)
      const rd = routeRes.data;
      if (rd) {
        const inb = (rd.inbound || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        const usr = (rd.user_routes || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        setRoutingCount(inb + usr);
      }
      setCompany({
        company_name: '', company_email: '', company_phone: '',
        company_address: '', company_zip: '', company_city: '', company_country: '',
        ...(compRes.data || {}),
      });
      setInvoice({
        same_as_company: true, invoice_name: '', invoice_address: '', invoice_email: '',
        ...(invRes.data || {}),
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // License type label per entry
  const licType = (l: LicenseEntry) => {
    if (l.trial) return t('license.trial_mode');
    if (l.nfr) return 'NFR';
    if (l.licensed) return t('license.standard');
    return '\u2014';
  };

  // ── Activate license ──
  const doActivateLicense = async () => {
    try {
      await api.put('/license', { license_key: licenseKey });
      setLicenseKey('');
      showToast(t('status.success'), true);
      load();
    } catch (err: unknown) {
      // Show specific error from backend (duplicate / invalid key)
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

  // ── Refresh ──
  const refreshLicense = async () => {
    try {
      await api.post('/license/refresh');
      showToast(t('license.refresh_success'), true);
      load();
    } catch { showToast(t('license.refresh_failed'), false); }
  };

  // ── View license ──
  const openView = (l: LicenseEntry) => {
    setDialogLicense(l);
    setDialogOpen(true);
  };

  // ── Delete license ──
  const requestDelete = (l: LicenseEntry) => {
    setConfirmDelete({
      open: true,
      name: l.license_key,
      action: async () => {
        await api.delete(`/license/${encodeURIComponent(l.license_key)}`);
        load();
      },
    });
  };

  // ── Company / Invoice save ──
  const doSaveCompany = async () => {
    try {
      await api.put('/company', company);
      await api.post('/config/apply');
      showToast(t('status.success'), true);
    } catch { showToast(t('status.error'), false); }
  };
  const saveCompany = () => setConfirmSave({ open: true, action: doSaveCompany });

  const doSaveInvoice = async () => {
    try {
      await api.put('/invoice', invoice);
      await api.post('/config/apply');
      showToast(t('status.success'), true);
    } catch { showToast(t('status.error'), false); }
  };
  const saveInvoice = () => setConfirmSave({ open: true, action: doSaveInvoice });

  // ── Confirm handlers ──
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(t('license.key_copied'), true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{t('license.license_info')}</Typography>
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
            {serverId && (
              <Box>
                <Typography variant="body2" color="text.secondary">{t('license.server_id')}</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{serverId}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Demo keys card — only in demo mode */}
      {demo && (
        <Card sx={{ mb: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
          <CardContent sx={{ px: 4, py: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('license.demo_keys_title')}</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {DEMO_KEYS.map((key) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1, px: 1.5, py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{key}</Typography>
                  <Tooltip title={t('license.copy_key')}>
                    <IconButton size="small" onClick={() => copyToClipboard(key)} sx={{ color: 'inherit' }}>
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Licenses table */}
      <CrudTable<LicenseEntry>
        rows={licenses}
        getKey={(l) => l.license_key}
        columns={[
          { id: 'key', header: t('license.license_key'), render: (l) => (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{l.license_key}</Typography>
          ), searchText: (l) => l.license_key },
          { id: 'client', header: t('license.client'), render: (l) => l.client_name || '\u2014', searchText: (l) => l.client_name },
          { id: 'type', header: t('license.license_type'), render: (l) => (
            <Chip size="small" label={licType(l)}
              color={l.trial ? 'warning' : l.nfr ? 'info' : l.licensed ? 'success' : 'default'} />
          )},
          { id: 'expires', header: t('license.expires'), render: (l) => l.expires || '\u2014' },
          { id: 'connections', header: t('license.connections'), render: (l) => (
            <Typography component="span" sx={{ fontWeight: 600 }}>{l.max_connections}</Typography>
          )},
        ]}
        columnOrderKey="license-columns"
        searchable
        getStatus={(l) => ({
          label: l.licensed ? t('license.licensed') : '\u2014',
          color: l.licensed ? 'success' : 'default',
        })}
        onView={openView}
        onDelete={requestDelete}
      />

      {/* Activate License */}
      <Card sx={{ mt: 3, mb: 3 }}>
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

      {/* Company Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('company.company_info')}</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label={t('company.company_name')} value={company.company_name}
                onChange={(e) => setCompany({ ...company, company_name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Email" value={company.company_email}
                onChange={(e) => setCompany({ ...company, company_email: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label={t('field.contact')} value={company.company_phone}
                onChange={(e) => setCompany({ ...company, company_phone: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label={t('company.country')} value={company.company_country}
                onChange={(e) => setCompany({ ...company, company_country: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('company.address')} value={company.company_address}
                onChange={(e) => setCompany({ ...company, company_address: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('company.zip_code')} value={company.company_zip}
                onChange={(e) => setCompany({ ...company, company_zip: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label={t('company.city')} value={company.company_city}
                onChange={(e) => setCompany({ ...company, company_city: e.target.value })} />
            </Grid>
          </Grid>
          <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 2 }} onClick={saveCompany}>
            {t('button.save_reload')}
          </Button>
        </CardContent>
      </Card>

      {/* Invoice Info */}
      <Card>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('invoice.invoice_info')}</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={invoice.same_as_company}
                onChange={(e) => setInvoice({ ...invoice, same_as_company: e.target.checked })}
              />
            }
            label={t('invoice.same_as_company')}
            sx={{ mb: 2 }}
          />
          {!invoice.same_as_company && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label={t('invoice.invoice_name')} value={invoice.invoice_name}
                  onChange={(e) => setInvoice({ ...invoice, invoice_name: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label={t('invoice.invoice_email')} value={invoice.invoice_email}
                  onChange={(e) => setInvoice({ ...invoice, invoice_email: e.target.value })}
                  helperText={t('invoice.invoice_email_hint')} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label={t('invoice.invoice_address')} value={invoice.invoice_address}
                  onChange={(e) => setInvoice({ ...invoice, invoice_address: e.target.value })} />
              </Grid>
            </Grid>
          )}
          <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 2 }} onClick={saveInvoice}>
            {t('button.save_reload')}
          </Button>
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
            <TextField label={t('license.client_name')} value={dialogLicense.client_name} disabled />
            <TextField label={t('license.license_type')} value={licType(dialogLicense)} disabled />
            <TextField label={t('license.version')} value={dialogLicense.version || '\u2014'} disabled />
            <TextField label={t('license.expires')} value={dialogLicense.expires || '\u2014'} disabled />
            <TextField label={t('license.connections')} value={dialogLicense.max_connections} disabled />
            {dialogLicense.trial && (
              <TextField label={t('license.days_remaining')} value={dialogLicense.days_remaining} disabled />
            )}
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

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete({ open: false, name: '', action: null })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
