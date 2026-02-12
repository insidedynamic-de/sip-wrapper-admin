import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import RouterIcon from '@mui/icons-material/Router';
import PersonIcon from '@mui/icons-material/Person';
import api from '../api/client';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { loadPreferences } from '../store/preferences';
import type { GatewayStatus, Registration, ActiveCall } from '../api/types';

export default function Dashboard() {
  const { t } = useTranslation();
  const [gateways, setGateways] = useState<GatewayStatus[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [callCount, setCallCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [gwRes, regRes, callRes] = await Promise.all([
        api.get('/gateways/status'),
        api.get('/registrations'),
        api.get('/active-calls'),
      ]);
      setGateways(gwRes.data || []);
      setRegistrations(regRes.data || []);
      setCalls(callRes.data?.calls || []);
      setCallCount(callRes.data?.count || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const prefs = loadPreferences();
  useAutoRefresh(refresh, prefs.refreshInterval * 1000);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.dashboard')}</Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <RouterIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{gateways.length}</Typography>
                <Typography color="text.secondary">{t('section.gateways')}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{registrations.length}</Typography>
                <Typography color="text.secondary">{t('dashboard.user_registrations')}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PhoneIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{callCount}</Typography>
                <Typography color="text.secondary">{t('dashboard.active_calls')}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Gateway Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('dashboard.gateway_status')}</Typography>
          {gateways.length === 0 ? (
            <Typography color="text.secondary">{t('dashboard.no_gateways')}</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('field.name')}</TableCell>
                    <TableCell>{t('status.online')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gateways.map((gw) => (
                    <TableRow key={gw.name}>
                      <TableCell>{gw.name}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={gw.state || gw.status}
                          color={gw.state === 'REGED' || gw.status === 'UP' ? 'success' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Registrations */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('dashboard.user_registrations')}</Typography>
          {registrations.length === 0 ? (
            <Typography color="text.secondary">{t('dashboard.no_users_registered')}</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('field.user')}</TableCell>
                    <TableCell>{t('field.ip_address')}</TableCell>
                    <TableCell>{t('field.user_agent')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registrations.map((reg, i) => (
                    <TableRow key={i}>
                      <TableCell>{reg.user}</TableCell>
                      <TableCell>{reg.ip}:{reg.port}</TableCell>
                      <TableCell>{reg.user_agent}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Active Calls */}
      {calls.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t('dashboard.active_calls')}</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('calls.direction')}</TableCell>
                    <TableCell>{t('calls.from')}</TableCell>
                    <TableCell>{t('calls.to')}</TableCell>
                    <TableCell>{t('calls.duration')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.uuid}>
                      <TableCell>{call.direction}</TableCell>
                      <TableCell>{call.caller_id}</TableCell>
                      <TableCell>{call.destination}</TableCell>
                      <TableCell>{call.duration}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
