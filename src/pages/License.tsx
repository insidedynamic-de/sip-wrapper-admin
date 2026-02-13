/**
 * @file License — License info, company data, and invoice settings
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid, Chip,
  Snackbar, Alert, Switch, FormControlLabel,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';

interface LicenseInfo {
  license_key: string;
  client_name: string;
  licensed: boolean;
  expires: string;
  trial: boolean;
  nfr: boolean;
  days_remaining: number;
  max_connections: number;
  version: string;
}

export default function License() {
  const { t } = useTranslation();
  const [license, setLicense] = useState<LicenseInfo>({
    license_key: '', client_name: '', licensed: false, expires: '',
    trial: false, nfr: false, days_remaining: 0, max_connections: 0, version: '',
  });
  const [routingCount, setRoutingCount] = useState(0);
  const [company, setCompany] = useState({
    company_name: '', company_email: '', company_phone: '',
    company_address: '', company_zip: '', company_city: '', company_country: '',
  });
  const [invoice, setInvoice] = useState({
    same_as_company: true, invoice_name: '', invoice_address: '', invoice_email: '',
  });
  const [licenseKey, setLicenseKey] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [dialogForm, setDialogForm] = useState({ license_key: '', client_name: '' });
  const [dialogInitial, setDialogInitial] = useState({ license_key: '', client_name: '' });
  const dialogDirty = JSON.stringify(dialogForm) !== JSON.stringify(dialogInitial);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  const load = useCallback(async () => {
    try {
      const [licRes, compRes, invRes, routeRes] = await Promise.all([
        api.get('/license'),
        api.get('/company'),
        api.get('/invoice'),
        api.get('/routes'),
      ]);
      setLicense({
        license_key: '', client_name: '', licensed: false, expires: '',
        trial: false, nfr: false, days_remaining: 0, max_connections: 0, version: '',
        ...licRes.data,
      });
      // Count enabled routings (1 routing = 1 connection = 1 license)
      const rd = routeRes.data;
      if (rd) {
        const inb = (rd.inbound || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        const outb = (rd.outbound || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        const usr = (rd.user_routes || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        setRoutingCount(inb + outb + usr);
      }
      setLicenseKey(licRes.data?.license_key || '');
      setCompany({
        company_name: '', company_email: '', company_phone: '',
        company_address: '', company_zip: '', company_city: '', company_country: '',
        ...compRes.data,
      });
      setInvoice({
        same_as_company: true, invoice_name: '', invoice_address: '', invoice_email: '',
        ...invRes.data,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doActivateLicense = async () => {
    try {
      await api.put('/license', { license_key: licenseKey });
      showToast(t('status.success'), true);
      load();
    } catch { showToast(t('status.error'), false); }
  };
  const activateLicense = () => setConfirmSave({ open: true, action: doActivateLicense });

  const openViewLicense = () => {
    setViewMode(true);
    const f = { license_key: license.license_key, client_name: license.client_name };
    setDialogForm(f);
    setDialogInitial(f);
    setDialogOpen(true);
  };

  const openEditLicense = () => {
    setViewMode(false);
    const f = { license_key: license.license_key, client_name: license.client_name };
    setDialogForm(f);
    setDialogInitial(f);
    setDialogOpen(true);
  };

  const doSaveLicense = async () => {
    try {
      await api.put('/license', { license_key: dialogForm.license_key, client_name: dialogForm.client_name });
      setDialogOpen(false);
      showToast(t('status.success'), true);
      load();
    } catch { showToast(t('status.error'), false); }
  };
  const saveLicense = () => setConfirmSave({ open: true, action: doSaveLicense });

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

  const handleConfirmSave = async () => {
    const a = confirmSave.action;
    setConfirmSave({ open: false, action: null });
    if (a) await a();
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('license.license_info')}</Typography>

      {/* License Status Table */}
      <CrudTable<LicenseInfo>
        rows={[license]}
        getKey={() => 'license'}
        columns={[
          { header: t('license.client'), render: (l) => l.client_name || '\u2014' },
          { header: t('license.version'), render: (l) => l.version || '\u2014' },
          { header: t('license.expires'), render: (l) => l.expires || '\u2014' },
          { header: t('license.days_remaining'), render: (l) => l.trial && l.days_remaining > 0
            ? <Typography component="span" sx={{ fontWeight: 600, color: l.days_remaining <= 7 ? 'error.main' : 'text.primary' }}>{l.days_remaining}</Typography>
            : '\u2014'
          },
          { header: t('license.routing_connections'), render: () => (
            <Typography component="span" sx={{ fontWeight: 600, color: routingCount > license.max_connections ? 'error.main' : 'text.primary' }}>
              {routingCount} / {license.max_connections}
            </Typography>
          )},
          ...(license.nfr ? [{ header: 'NFR', render: () => <Chip size="small" label={t('license.nfr')} color={'info' as const} /> }] : []),
        ]}
        getStatus={(l) => ({
          label: l.trial ? t('license.trial_mode') : l.licensed ? t('license.licensed') : '\u2014',
          color: l.trial ? 'warning' : l.licensed ? 'success' : 'default',
        })}
        onView={openViewLicense}
        onEdit={openEditLicense}
      />

      {/* License Key Activation */}
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
            <Button variant="contained" onClick={activateLicense}>
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

      {/* License View/Edit Dialog */}
      <FormDialog
        open={dialogOpen}
        readOnly={viewMode}
        title={viewMode ? t('license.license_info') : t('license.update_license')}
        dirty={dialogDirty}
        onClose={() => setDialogOpen(false)}
        onSave={saveLicense}
      >
        <TextField
          label={t('license.license_key')}
          value={dialogForm.license_key}
          onChange={(e) => setDialogForm({ ...dialogForm, license_key: e.target.value })}
          disabled={viewMode}
          placeholder="XXXX-XXXX-XXXX-XXXX"
        />
        <TextField
          label={t('license.client_name')}
          value={dialogForm.client_name}
          onChange={(e) => setDialogForm({ ...dialogForm, client_name: e.target.value })}
          disabled={viewMode}
        />
        <TextField label={t('license.version')} value={license.version || '\u2014'} disabled />
        <TextField label={t('license.expires')} value={license.expires || '\u2014'} disabled />
        <TextField label={t('license.routing_connections')} value={`${routingCount} / ${license.max_connections}`} disabled />
        {license.trial && (
          <TextField label={t('license.days_remaining')} value={license.days_remaining} disabled />
        )}
      </FormDialog>

      <ConfirmDialog open={confirmSave.open} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmSave} onCancel={() => setConfirmSave({ open: false, action: null })} />

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
