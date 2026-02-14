/**
 * @file AllLicensesTab — Overview of all client licenses across all servers
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Chip } from '@mui/material';
import api from '../api/client';
import CrudTable from '../components/CrudTable';

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

export default function AllLicensesTab() {
  const { t } = useTranslation();
  const [allLicenses, setAllLicenses] = useState<AllLicense[]>([]);

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
            <Chip size="small" label={l.license_name} color="primary" />
          )},
          { id: 'connections', header: t('license.connections'), render: (l) => (
            <Typography component="span" sx={{ fontWeight: 600 }}>{l.max_connections}</Typography>
          )},
          { id: 'valid_until', header: t('license.valid_until'), render: (l) => l.valid_until || '\u2014' },
          { id: 'server', header: t('license.installed_on'), render: (l) => (
            l.bound_to ? (
              <Chip size="small" label={l.server_name || l.bound_to} color="info" variant="outlined" />
            ) : (
              <Typography variant="body2" color="text.secondary">\u2014</Typography>
            )
          ), searchText: (l) => l.server_name || l.bound_to || '' },
        ]}
        columnOrderKey="all-licenses-columns"
        searchable
        getStatus={(l) => ({
          label: l.licensed ? t('license.licensed') : t('license.not_installed'),
          color: l.licensed ? 'success' : 'default',
        })}
        getEnabled={(l) => l.licensed}
      />
    </Box>
  );
}
