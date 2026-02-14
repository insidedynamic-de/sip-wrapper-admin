/**
 * @file AllLicensesTab — Overview of all client licenses across all servers
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import api from '../api/client';
import CrudTable from '../components/CrudTable';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

interface AllLicense {
  license_key: string;
  product: string;
  subproduct: string;
  license_name: string;
  max_connections: number;
  valid_until: string;
  bound_to?: string;
  server_name?: string;
  licensed: boolean;
}

const isExpired = (l: AllLicense) => {
  if (!l.valid_until) return false;
  return new Date(l.valid_until) < new Date();
};

export default function AllLicensesTab() {
  const { t } = useTranslation();
  const [allLicenses, setAllLicenses] = useState<AllLicense[]>([]);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmInstall, setConfirmInstall] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const notifyLicenseChanged = () => window.dispatchEvent(new Event('license-changed'));

  const load = useCallback(async () => {
    try {
      const res = await api.get('/license/available');
      setAllLicenses(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('license-changed', handler);
    return () => window.removeEventListener('license-changed', handler);
  }, [load]);

  const requestInstall = (l: AllLicense) => {
    setConfirmInstall({
      open: true,
      name: `${l.license_name} (${l.license_key})`,
      action: async () => {
        try {
          await api.put('/license', { license_key: l.license_key });
          setToast({ open: true, message: t('status.success'), severity: 'success' });
          load();
          notifyLicenseChanged();
        } catch (err: unknown) {
          const resp = (err as { response?: { data?: { message?: string } } })?.response?.data;
          const msgKey = resp?.message;
          if (msgKey === 'license_duplicate') {
            setToast({ open: true, message: t('license.error_duplicate'), severity: 'error' });
          } else {
            setToast({ open: true, message: t('status.error'), severity: 'error' });
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

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('license.all_licenses_hint')}
      </Typography>

      <CrudTable<AllLicense>
        rows={allLicenses}
        getKey={(l) => l.license_key}
        columns={[
          { id: 'key', header: t('license.license_key'), render: (l) => (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{l.license_key}</Typography>
          ), searchText: (l) => l.license_key },
          { id: 'product', header: t('license.product'), render: (l) => l.product || '\u2014' },
          { id: 'subproduct', header: t('license.subproduct'), render: (l) => l.subproduct || '\u2014' },
          { id: 'license_name', header: t('license.license_name'), render: (l) => (
            <Chip size="small" label={l.license_name} color={l.bound_to ? 'default' : 'primary'} />
          )},
          { id: 'connections', header: t('license.connections'), render: (l) => (
            <Typography component="span" sx={{ fontWeight: 600 }}>{l.max_connections}</Typography>
          )},
          { id: 'valid_until', header: t('license.valid_until'), render: (l) => (
            <Typography variant="body2" color={isExpired(l) ? 'error.main' : 'text.primary'} sx={isExpired(l) ? { fontWeight: 600 } : undefined}>
              {l.valid_until || '\u2014'}
            </Typography>
          )},
          { id: 'server', header: t('license.installed_on'), render: (l) => (
            l.bound_to ? (
              <Chip size="small" label={l.server_name || l.bound_to} color="info" variant="outlined" />
            ) : isExpired(l) ? (
              <Typography variant="body2" color="text.secondary">\u2014</Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title={t('license.install')}>
                  <IconButton size="small" color="success" onClick={() => requestInstall(l)}>
                    <AddCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )
          ), searchText: (l) => l.server_name || l.bound_to || '' },
        ]}
        columnOrderKey="all-licenses-columns"
        searchable
        getStatus={(l) => ({
          label: isExpired(l) ? t('license.expired') : l.bound_to ? t('license.assigned') : t('license.available_status'),
          color: isExpired(l) ? 'error' : l.bound_to ? 'default' : 'success',
        })}
        getEnabled={(l) => !l.bound_to && !isExpired(l)}
        dimDisabled
      />

      <ConfirmDialog open={confirmInstall.open} variant="save"
        title={t('license.install_title')}
        message={t('license.install_message', { name: confirmInstall.name })}
        confirmLabel={t('license.install')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmInstall} onCancel={() => setConfirmInstall({ open: false, name: '', action: null })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
