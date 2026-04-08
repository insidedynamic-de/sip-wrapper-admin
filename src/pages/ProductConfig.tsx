/**
 * @file ProductConfig — Product configuration via proxy.
 * Shows instance header + embedded Configuration page using proxied API.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert, Button, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api, { setInstancePrefix } from '../api/client';
import { getImpersonateUser, getUserFromToken } from '../store/auth';
import Configuration from './Configuration';

interface InstanceInfo {
  id: number;
  product: string;
  name: string;
  domain: string;
  instance_url: string;
  status: string;
  max_connections: number;
}


export default function ProductConfig() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [proxyPrefix, setProxyPrefix] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getUserFromToken();
  const isAdminViewing = !getImpersonateUser() && user?.tenant_type === 'provider';

  // Clear prefix on unmount
  useEffect(() => {
    return () => { setInstancePrefix(''); };
  }, []);

  useEffect(() => {
    if (!instanceId) return;
    api.get(`/instance/${instanceId}`).then((res) => {
      setInstance(res.data);
      const prefix = `/instance/${instanceId}`;
      setProxyPrefix(prefix);
      setInstancePrefix(prefix);
    }).catch((err) => {
      if (err.response?.status === 403) {
        setError('Kein Zugriff auf diese Instanz');
      } else {
        setError(err.response?.data?.detail || 'Instance not found');
      }
    }).finally(() => setLoading(false));
  }, [instanceId]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  if (error || !instance) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Instance not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>Zurück</Button>
      </Box>
    );
  }

  if (instance.status !== 'online') {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Instanz "{instance.name}" ist {instance.status}.
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>Zurück</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>
          Dashboard
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>{instance.product.replace('Linkify ', '')}</Typography>
        <Chip label={instance.name} size="small" variant="outlined" />
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{instance.domain}</Typography>
        <Chip label={instance.status} size="small" color="success" />
      </Box>

      {/* Warning if admin viewing client instance directly */}
      {isAdminViewing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sie sehen eine Kundeninstanz als Administrator. Änderungen wirken sich auf den Kunden aus.
        </Alert>
      )}

      {/* Configuration page — all api calls automatically prefixed via setInstancePrefix */}
      {proxyPrefix && <Configuration />}
    </Box>
  );
}

/** Simple product dashboard — shows health + basic info from instance API */
function ProductDashboard({ prefix, instance }: { prefix: string; instance: InstanceInfo | null }) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [gateways, setGateways] = useState<unknown[]>([]);
  const [users, setUsers] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`${prefix}/health`).catch(() => ({ data: null })),
      api.get(`${prefix}/gateways`).catch(() => ({ data: [] })),
      api.get(`${prefix}/users`).catch(() => ({ data: [] })),
    ]).then(([hRes, gRes, uRes]) => {
      setHealth(hRes.data);
      setGateways(gRes.data || []);
      setUsers(uRes.data || []);
    }).finally(() => setLoading(false));
  }, [prefix]);

  if (loading) return <CircularProgress />;

  return (
    <Box>
      {health && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Status: {String((health as Record<string, unknown>).status || 'ok')} · Version: {String((health as Record<string, unknown>).version || '?')}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, flex: 1, textAlign: 'center' }}>
          <Typography variant="h4">{gateways.length}</Typography>
          <Typography variant="body2" color="text.secondary">Gateways</Typography>
        </Box>
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, flex: 1, textAlign: 'center' }}>
          <Typography variant="h4">{users.length}</Typography>
          <Typography variant="body2" color="text.secondary">Users</Typography>
        </Box>
        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, flex: 1, textAlign: 'center' }}>
          <Typography variant="h4">{instance?.max_connections || 0}</Typography>
          <Typography variant="body2" color="text.secondary">Max Connections</Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary">
        Die vollständige Konfiguration (Gateways, Users, Routes, Security) wird in Kürze hier verfügbar sein.
      </Typography>
    </Box>
  );
}
