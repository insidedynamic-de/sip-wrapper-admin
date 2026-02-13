/**
 * @file Dashboard — Overview with stat cards, gateway status, registrations, calls
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, Typography, Chip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, LinearProgress,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneMissedIcon from '@mui/icons-material/PhoneMissed';
import RouterIcon from '@mui/icons-material/Router';
import PersonIcon from '@mui/icons-material/Person';
import DialpadIcon from '@mui/icons-material/Dialpad';
import ShieldIcon from '@mui/icons-material/Shield';
import BadgeIcon from '@mui/icons-material/Badge';
import api from '../api/client';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { loadPreferences, isDemoMode } from '../store/preferences';
import type { Gateway, GatewayStatus, Registration, ActiveCall, CallLog, Extension } from '../api/types';

// ── Demo call simulation data ──
const DEMO_NUMBERS = [
  '+4930111111', '+4940222222', '+4989333333', '+49211444444', '+4922155555',
  '+4930777000', '+4940888111', '+4989666222', '+49711333444', '+4930999888',
  '+41445551234', '+431987654', '+3227712345', '+31207654321', '+352261234',
];
const DEMO_EXTENSIONS = ['1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008'];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
let demoUuidCounter = 100;

function createDemoCall(): ActiveCall {
  const dir = Math.random() > 0.5 ? 'inbound' : 'outbound';
  const ext = pick(DEMO_EXTENSIONS);
  const num = pick(DEMO_NUMBERS);
  return {
    uuid: `demo-${++demoUuidCounter}`,
    direction: dir,
    caller_id: dir === 'inbound' ? num : ext,
    destination: dir === 'inbound' ? ext : num,
    state: Math.random() > 0.3 ? 'ringing' : 'early',
    duration: '00:00',
  };
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [allGateways, setAllGateways] = useState<Gateway[]>([]);
  const [gateways, setGateways] = useState<GatewayStatus[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [callCount, setCallCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [licenseInfo, setLicenseInfo] = useState<{ licensed: boolean; trial: boolean; nfr: boolean; max_connections: number }>({ licensed: false, trial: false, nfr: false, max_connections: 0 });
  const [routingCount, setRoutingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Live-updating calls with full demo simulation
  const [liveCalls, setLiveCalls] = useState<ActiveCall[]>([]);
  const liveRef = useRef<ActiveCall[]>([]);
  const demoTotalRef = useRef(0);
  const [demoTotalToday, setDemoTotalToday] = useState(0);
  const demo = isDemoMode();

  // Sync from API data
  useEffect(() => {
    liveRef.current = [...calls];
    setLiveCalls([...calls]);
    demoTotalRef.current = 0;
    setDemoTotalToday(0);
  }, [calls]);

  // Every-second tick: durations + state transitions + add/remove calls
  useEffect(() => {
    const tickDuration = (d: string) => {
      const parts = d.split(':').map(Number);
      let s = (parts[0] || 0) * 60 + (parts[1] || 0) + 1;
      return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };

    const interval = setInterval(() => {
      const cur = liveRef.current;
      if (!demo && cur.length === 0) return;

      const raw: (ActiveCall | null)[] = cur.map((c) => {
        // Tick duration for active calls
        const dur = c.state === 'active' ? tickDuration(c.duration) : c.duration;

        // State transitions (demo only)
        if (demo) {
          if (c.state === 'early' && Math.random() < 0.15) {
            return { ...c, state: 'ringing', duration: dur };
          }
          if (c.state === 'ringing' && Math.random() < 0.12) {
            return { ...c, state: 'active', duration: '00:00' };
          }
          // End active calls after some time
          if (c.state === 'active') {
            const parts = dur.split(':').map(Number);
            const totalSec = (parts[0] || 0) * 60 + (parts[1] || 0);
            if (totalSec > 30 && Math.random() < 0.04) return null;
            if (totalSec > 120 && Math.random() < 0.1) return null;
          }
          // Missed/failed ringing
          if (c.state === 'ringing') {
            const parts = c.duration.split(':').map(Number);
            const ringTime = (parts[0] || 0) * 60 + (parts[1] || 0);
            if (ringTime > 20 && Math.random() < 0.08) return null;
          }
        }
        return { ...c, duration: dur };
      });

      // Remove ended calls (nulls)
      const ended = raw.filter((c) => c === null).length;
      let alive = raw.filter((c): c is ActiveCall => c !== null);

      // In demo: add new calls randomly (every ~6-10s on average)
      if (demo && Math.random() < 0.12 && alive.length < 8) {
        alive.push(createDemoCall());
      }

      // Tick ringing durations too (so we know how long they've been ringing)
      alive = alive.map((c) =>
        c.state === 'ringing' || c.state === 'early'
          ? { ...c, duration: tickDuration(c.duration) }
          : c,
      );

      liveRef.current = alive;
      setLiveCalls([...alive]);

      if (ended > 0) {
        demoTotalRef.current += ended;
        setDemoTotalToday(demoTotalRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [demo, calls]);

  const refresh = useCallback(async () => {
    try {
      const [gwRes, gwAllRes, regRes, callRes, usersRes, logRes, secRes, extRes, licRes, routeRes] = await Promise.all([
        api.get('/gateways/status'),
        api.get('/gateways'),
        api.get('/registrations'),
        api.get('/active-calls'),
        api.get('/users'),
        api.get('/logs/calls'),
        api.get('/security'),
        api.get('/extensions'),
        api.get('/license'),
        api.get('/routes'),
      ]);
      setAllGateways(gwAllRes.data || []);
      setGateways(gwRes.data || []);
      setRegistrations(regRes.data || []);
      setCalls(callRes.data?.calls || []);
      setCallCount(callRes.data?.count || 0);
      setTotalUsers((usersRes.data || []).length);
      setCallLogs(logRes.data || []);
      setBlockedCount((secRes.data?.blacklist || []).length);
      setExtensions(extRes.data || []);
      if (licRes.data) setLicenseInfo({ licensed: licRes.data.licensed, trial: licRes.data.trial, nfr: !!licRes.data.nfr, max_connections: licRes.data.max_connections || 0 });
      if (routeRes.data) {
        const rd = routeRes.data;
        const inb = (rd.inbound || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        const outb = (rd.outbound || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        const usr = (rd.user_routes || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        setRoutingCount(inb + outb + usr);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const prefs = loadPreferences();
  useAutoRefresh(refresh, prefs.refreshInterval * 1000);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  const isGwEnabled = (name: string) => {
    const gw = allGateways.find((g) => g.name === name);
    return gw ? gw.enabled !== false : true;
  };
  const gwRegistered = gateways.filter((g) => g.state === 'REGED' && isGwEnabled(g.name)).length;
  const extActive = extensions.filter((e) => e.enabled !== false).length;
  const failedCalls = callLogs.filter((c) => c.result === 'failed' || c.result === 'missed').length;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.dashboard')}</Typography>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3 }}>
        {/* Gateways: registered / total */}
        <Card sx={{ minWidth: 180 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <RouterIcon color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4">
                {gwRegistered}
                <Typography component="span" variant="h5" color="text.secondary">/{allGateways.filter((g) => g.enabled !== false).length}</Typography>
              </Typography>
              <Typography color="text.secondary" variant="body2">{t('dashboard.gateways_registered')}</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Users: online / total */}
        <Card sx={{ minWidth: 180 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonIcon color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4">
                {registrations.length}
                <Typography component="span" variant="h5" color="text.secondary">/{totalUsers}</Typography>
              </Typography>
              <Typography color="text.secondary" variant="body2">{t('dashboard.users_online')}</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Extensions: active / total */}
        <Card sx={{ minWidth: 180 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <DialpadIcon color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4">
                {extActive}
                <Typography component="span" variant="h5" color="text.secondary">/{extensions.length}</Typography>
              </Typography>
              <Typography color="text.secondary" variant="body2">{t('dashboard.extensions_active')}</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Active Calls */}
        <Card sx={{ minWidth: 180 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PhoneIcon color={liveCalls.length > 0 ? 'success' : 'primary'} sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4">{liveCalls.length}</Typography>
              <Typography color="text.secondary" variant="body2">{t('dashboard.active_calls')}</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Total Calls / Failed */}
        <Card sx={{ minWidth: 180 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PhoneMissedIcon color={failedCalls > 0 ? 'error' : 'primary'} sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4">
                {callLogs.length}
                <Typography component="span" variant="h5" color={failedCalls > 0 ? 'error.main' : 'text.secondary'}>
                  /{failedCalls}
                </Typography>
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {t('dashboard.total_calls')} / {t('dashboard.failed_calls')}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Blocked IPs */}
        <Card sx={{ minWidth: 180 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ShieldIcon color={blockedCount > 0 ? 'error' : 'primary'} sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4">{blockedCount}</Typography>
              <Typography color="text.secondary" variant="body2">{t('dashboard.blocked_ips')}</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* License */}
        <Card sx={{ minWidth: 180 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BadgeIcon color={licenseInfo.licensed ? 'primary' : 'error'} sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h4">
                {routingCount}
                <Typography component="span" variant="h5" color={routingCount > licenseInfo.max_connections ? 'error.main' : 'text.secondary'}>
                  /{licenseInfo.max_connections}
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography color="text.secondary" variant="body2">{t('dashboard.license_status')}</Typography>
                {licenseInfo.trial && <Chip size="small" label={t('license.trial_mode')} color="warning" sx={{ height: 18, fontSize: 11 }} />}
                {licenseInfo.nfr && <Chip size="small" label="NFR" color="info" sx={{ height: 18, fontSize: 11 }} />}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

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
                  {gateways.map((gw) => {
                    const enabled = isGwEnabled(gw.name);
                    return (
                      <TableRow key={gw.name} sx={!enabled ? { opacity: 0.5 } : undefined}>
                        <TableCell>{gw.name}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={!enabled ? t('status.deactivated') : (gw.state || gw.status)}
                            color={
                              !enabled ? 'default'
                                : gw.state === 'REGED' ? 'success'
                                  : (gw.state === 'FAIL' || gw.state === 'NOREG') ? 'error'
                                    : 'warning'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Active Calls (always visible, live-updating durations) */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h6">{t('dashboard.active_calls')}</Typography>
            <Chip size="small" label={liveCalls.length} color={liveCalls.length > 0 ? 'success' : 'default'} />
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.total_calls_today')}: {callLogs.length + demoTotalToday}
            </Typography>
            {liveCalls.length > 0 && (
              <LinearProgress
                sx={{ flex: 1, maxWidth: 120, borderRadius: 1, height: 6 }}
                color="success"
              />
            )}
          </Box>
          {liveCalls.length === 0 ? (
            <Typography color="text.secondary">{t('dashboard.no_active_calls')}</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('calls.direction')}</TableCell>
                    <TableCell>{t('calls.from')}</TableCell>
                    <TableCell>{t('calls.to')}</TableCell>
                    <TableCell>{t('field.status')}</TableCell>
                    <TableCell>{t('calls.duration')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {liveCalls.map((call) => (
                    <TableRow key={call.uuid}>
                      <TableCell>
                        <Chip
                          size="small"
                          label={call.direction}
                          color={call.direction === 'inbound' ? 'info' : 'secondary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{call.caller_id}</TableCell>
                      <TableCell>{call.destination}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={call.state}
                          color={
                            call.state === 'active' ? 'success'
                              : call.state === 'ringing' ? 'warning'
                                : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {call.duration}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
