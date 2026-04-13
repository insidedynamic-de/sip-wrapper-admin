/**
 * @file ProductConfig — Product configuration via proxy.
 * Shows instance header + embedded Configuration page using proxied API.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, CircularProgress, Typography, Alert, Button, Chip,
  Dialog, DialogTitle, DialogContent, IconButton, Table, TableBody,
  TableRow, TableCell, Tooltip, Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import api, { setInstancePrefix, setInstanceOffline } from '../api/client';
import { getImpersonateUser, getUserFromToken } from '../store/auth';
import { useTranslation } from 'react-i18next';
import Configuration from './Configuration';

interface PortsConfig {
  sip_port?: number;
  sip_ext_port?: number;
  api_port?: number;
  esl_port?: number;
  rtp_start?: number;
  rtp_end?: number;
}

interface InstanceInfo {
  id: number;
  product: string;
  name: string;
  domain: string;
  instance_url: string;
  status: string;
  max_connections: number;
  ports?: PortsConfig;
}


export default function ProductConfig() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [proxyPrefix, setProxyPrefix] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connOpen, setConnOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [licenseBlocked, setLicenseBlocked] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'loading' | 'online' | 'offline' | 'suspended'>('loading');
  const user = getUserFromToken();
  const isAdminViewing = !getImpersonateUser() && user?.tenant_type === 'provider';

  // Clear prefix + offline flag on unmount
  useEffect(() => {
    return () => { setInstancePrefix(''); setInstanceOffline(false); };
  }, []);

  // Shared health+license check (used by both initial load and periodic refresh)
  const checkHealth = async () => {
    try {
      // Temporarily allow requests for health check even when offline
      setInstanceOffline(false);
      const healthRes = await api.get('/health').catch(() => null);
      if (!healthRes) {
        setLiveStatus('offline');
        setLicenseBlocked(false);
        setInstanceOffline(true);
      } else {
        setInstanceOffline(false);
        const licRes = await api.get('/license').catch(() => null);
        if (licRes?.data && !licRes.data.active) {
          setLicenseBlocked(true);
          setLiveStatus('suspended');
        } else {
          setLicenseBlocked(false);
          setLiveStatus('online');
        }
      }
    } catch {
      setLiveStatus('offline');
      setInstanceOffline(true);
    }
  };

  // Auto-refresh live status every 30 seconds (includes LicServer re-validation)
  useEffect(() => {
    if (!proxyPrefix) return;
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [proxyPrefix]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!instanceId) return;
    api.get(`/instance/${instanceId}`).then(async (res) => {
      setInstance(res.data);
      const prefix = `/instance/${instanceId}`;
      setProxyPrefix(prefix);
      setInstancePrefix(prefix);
      await checkHealth();
    }).catch((err) => {
      if (err.response?.status === 403) {
        setError('Kein Zugriff auf diese Instanz');
      } else {
        setError(err.response?.data?.detail || 'Instance not found');
      }
    }).finally(() => setLoading(false));
  }, [instanceId]);

  const copyToClipboard = (value: string, label: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(label);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  if (error || !instance) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Instance not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>Zurück</Button>
      </Box>
    );
  }

  if (instance.status !== 'online' && instance.status !== 'suspended') {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Instanz "{instance.name}" ist {instance.status}.
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>Zurück</Button>
      </Box>
    );
  }

  // License blocked overlay is rendered below, over the content

  const ports = instance.ports || {};
  const connRows: { label: string; value: string }[] = [
    { label: 'Hostname', value: instance.domain },
    ...(ports.sip_port ? [{ label: 'SIP Port (intern)', value: String(ports.sip_port) }] : []),
    ...(ports.sip_ext_port ? [{ label: 'SIP Port (extern)', value: String(ports.sip_ext_port) }] : []),
    ...(ports.api_port ? [{ label: 'API Port', value: String(ports.api_port) }] : []),
    ...(ports.rtp_start && ports.rtp_end ? [{ label: 'RTP Range', value: `${ports.rtp_start}-${ports.rtp_end}` }] : []),
    { label: 'Max Connections', value: String(instance.max_connections) },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>
          Dashboard
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>{instance.product.replace('Linkify ', '')}</Typography>
        <Chip label={instance.name} size="small" variant="outlined" />
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{instance.domain}</Typography>
        <Chip
          label={liveStatus === 'loading' ? t('status.checking') : liveStatus === 'offline' ? t('status.offline') : liveStatus === 'suspended' ? t('instance.license_suspended') : t('status.online')}
          size="small"
          color={liveStatus === 'online' ? 'success' : liveStatus === 'suspended' ? 'warning' : liveStatus === 'loading' ? 'default' : 'error'}
        />
        <Chip
          label={liveStatus === 'loading' ? 'Instanz: Prüfe...' : liveStatus === 'offline' ? 'Instanz: Gestoppt' : 'Instanz: Läuft'}
          size="small"
          variant="outlined"
          color={liveStatus === 'loading' ? 'default' : liveStatus === 'offline' ? 'error' : 'success'}
          sx={{ fontSize: 11 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" sx={{ mr: 1 }}
          onClick={async () => {
            try {
              await api.post(`/admin/infra/instances/${instanceId}/update`);
            } catch { /* ignore */ }
          }}>Update</Button>
        <Button size="small" variant="outlined" color="warning" sx={{ mr: 1 }}
          onClick={async () => {
            try {
              await api.post(`/admin/infra/instances/${instanceId}/restart`);
            } catch { /* ignore */ }
          }}>Restart</Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<InfoOutlinedIcon />}
          onClick={() => setConnOpen(true)}
        >
          {t('dashboard.connection_info', 'Connection Info')}
        </Button>
      </Box>

      {/* Warning if admin viewing client instance directly */}
      {isAdminViewing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sie sehen eine Kundeninstanz als Administrator. Änderungen wirken sich auf den Kunden aus.
        </Alert>
      )}

      {/* Configuration page — all api calls automatically prefixed via setInstancePrefix */}
      <Box sx={{ position: 'relative' }}>
        {/* Offline overlay */}
        {liveStatus === 'offline' && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 10,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: 2, minHeight: 400,
          }}>
            <CloudOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
              {t('status.offline')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center', maxWidth: 500 }}>
              {t('instance.offline_desc', 'Instanz ist nicht erreichbar. Polling wurde gestoppt.')}
            </Typography>
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={checkHealth}>
              {t('instance.check_status', 'Status prüfen')}
            </Button>
          </Box>
        )}
        {/* License blocked overlay */}
        {licenseBlocked && liveStatus !== 'offline' && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 10,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: 2, minHeight: 400,
          }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main', mb: 2 }}>
              {t('instance.license_suspended')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center', maxWidth: 500 }}>
              {t('instance.license_suspended_desc')}
            </Typography>
            <Button variant="contained" onClick={async () => {
              try {
                await api.post('/license/refresh');
                const licRes = await api.get('/license');
                if (licRes.data?.active) setLicenseBlocked(false);
              } catch { /* ignore */ }
            }}>
              Lizenz prüfen
            </Button>
          </Box>
        )}
        {proxyPrefix && <Configuration />}
      </Box>

      {/* Connection Info Modal */}
      <Dialog open={connOpen} onClose={() => setConnOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {t('dashboard.connection_info', 'Connection Info')}
          <IconButton size="small" onClick={() => setConnOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableBody>
              {connRows.map((row) => (
                <TableRow
                  key={row.label}
                  hover
                  sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                  onClick={() => copyToClipboard(row.value, row.label)}
                >
                  <TableCell sx={{ fontWeight: 600, width: 160, border: 'none' }}>{row.label}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', border: 'none' }}>{row.value}</TableCell>
                  <TableCell sx={{ width: 40, border: 'none', textAlign: 'right' }}>
                    <Tooltip title={t('common.copy', 'Kopieren')}>
                      <ContentCopyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={!!copied}
        autoHideDuration={1500}
        onClose={() => setCopied('')}
        message={`${copied} kopiert`}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
