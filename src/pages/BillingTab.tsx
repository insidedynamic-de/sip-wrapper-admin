/**
 * @file BillingTab — Company information and invoice address
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Switch, FormControlLabel,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

export default function BillingTab() {
  const { t } = useTranslation();

  const [company, setCompany] = useState({
    company_id: '', company_name: '', company_email: '',
    company_address: '', company_zip: '', company_city: '', company_country: '',
  });
  const [invoice, setInvoice] = useState({
    invoice_same_as_company: false, invoice_name: '', invoice_address: '',
    invoice_zip: '', invoice_city: '', invoice_email: '',
  });

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });

  const showToast = (msg: string, ok: boolean) => setToast({ open: true, message: msg, severity: ok ? 'success' : 'error' });

  const load = useCallback(async () => {
    try {
      const [compRes, invRes] = await Promise.all([
        api.get('/company'),
        api.get('/invoice'),
      ]);
      setCompany({
        company_id: '', company_name: '', company_email: '',
        company_address: '', company_zip: '', company_city: '', company_country: '',
        ...(compRes.data || {}),
      });
      setInvoice({
        invoice_same_as_company: false, invoice_name: '', invoice_address: '',
        invoice_zip: '', invoice_city: '', invoice_email: '',
        ...(invRes.data || {}),
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Company save
  const doSaveCompany = async () => {
    try {
      await api.put('/company', company);
      await api.post('/config/apply');
      showToast(t('status.success'), true);
    } catch { showToast(t('status.error'), false); }
  };
  const saveCompany = () => setConfirmSave({ open: true, action: doSaveCompany });

  // Invoice save
  const doSaveInvoice = async () => {
    try {
      await api.put('/invoice', invoice);
      await api.post('/config/apply');
      showToast(t('status.success'), true);
    } catch { showToast(t('status.error'), false); }
  };
  const saveInvoice = () => setConfirmSave({ open: true, action: doSaveInvoice });

  // Confirm handler
  const handleConfirmSave = async () => {
    const a = confirmSave.action;
    setConfirmSave({ open: false, action: null });
    if (a) await a();
  };

  return (
    <Box>
      {/* Company Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ px: 4, py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('company.company_info')}</Typography>
          <Grid container spacing={2}>
            {company.company_id && (
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label={t('setup.company_id')} value={company.company_id}
                  slotProps={{ input: { readOnly: true } }}
                  helperText={t('setup.company_id_hint')} />
              </Grid>
            )}
            <Grid size={{ xs: 12, md: company.company_id ? 4 : 6 }}>
              <TextField fullWidth label={t('company.company_name')} value={company.company_name}
                onChange={(e) => setCompany({ ...company, company_name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: company.company_id ? 4 : 6 }}>
              <TextField fullWidth label={t('setup.email')} value={company.company_email}
                onChange={(e) => setCompany({ ...company, company_email: e.target.value })} />
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
                checked={invoice.invoice_same_as_company}
                onChange={(e) => setInvoice({ ...invoice, invoice_same_as_company: e.target.checked })}
              />
            }
            label={t('invoice.same_as_company')}
            sx={{ mb: 2 }}
          />
          {!invoice.invoice_same_as_company && (
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
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label={t('invoice.invoice_address')} value={invoice.invoice_address}
                  onChange={(e) => setInvoice({ ...invoice, invoice_address: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label={t('invoice.invoice_zip')} value={invoice.invoice_zip}
                  onChange={(e) => setInvoice({ ...invoice, invoice_zip: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label={t('invoice.invoice_city')} value={invoice.invoice_city}
                  onChange={(e) => setInvoice({ ...invoice, invoice_city: e.target.value })} />
              </Grid>
            </Grid>
          )}
          <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 2 }} onClick={saveInvoice}>
            {t('button.save_reload')}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog open={confirmSave.open} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmSave} onCancel={() => setConfirmSave({ open: false, action: null })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
