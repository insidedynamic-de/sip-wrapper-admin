/**
 * @file Dashboard — Overview with stat cards, gateway status, registrations, calls
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, Typography, Chip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, LinearProgress, IconButton, Dialog, DialogTitle,
  DialogContent, FormControlLabel, Checkbox, Tooltip,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneMissedIcon from '@mui/icons-material/PhoneMissed';
import RouterIcon from '@mui/icons-material/Router';
import PersonIcon from '@mui/icons-material/Person';
import DialpadIcon from '@mui/icons-material/Dialpad';
import ShieldIcon from '@mui/icons-material/Shield';
import BadgeIcon from '@mui/icons-material/Badge';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
import BarChartIcon from '@mui/icons-material/BarChart';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import api from '../api/client';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { loadPreferences, isDemoMode } from '../store/preferences';
import { loadDemoStore, saveDemoStore } from '../api/demoData';
import type { Gateway, GatewayStatus, Registration, ActiveCall, CallLog, Extension, CallStatEntry, User, AclUser } from '../api/types';

// ── Dashboard card visibility persistence ──
const CARDS_STORAGE_KEY = 'sip-wrapper-dashboard-cards';

function loadHiddenCards(): Set<string> {
  try {
    const raw = localStorage.getItem(CARDS_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveHiddenCards(hidden: Set<string>) {
  localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify([...hidden]));
}

// ── Demo call simulation data ──
const DEMO_NUMBERS = [
  '+4930111111', '+4940222222', '+4989333333', '+49211444444', '+4922155555',
  '+4930777000', '+4940888111', '+4989666222', '+49711333444', '+4930999888',
  '+41445551234', '+431987654', '+3227712345', '+31207654321', '+352261234',
];
const DEMO_GATEWAYS = ['sipgate', 'telekom', 'plivo-ai'];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
let demoUuidCounter = 100;

/** Create a demo call — only uses extensions from registered users + ACL users */
function createDemoCall(validExtensions: string[]): ActiveCall {
  const exts = validExtensions.length > 0 ? validExtensions : ['1001'];
  const dir = Math.random() > 0.5 ? 'inbound' : 'outbound';
  const ext = pick(exts);
  const num = pick(DEMO_NUMBERS);
  return {
    uuid: `demo-${++demoUuidCounter}`,
    direction: dir,
    caller_id: dir === 'inbound' ? num : ext,
    destination: dir === 'inbound' ? ext : num,
    state: Math.random() > 0.3 ? 'ringing' : 'early',
    duration: '00:00',
    gateway: pick(DEMO_GATEWAYS),
  };
}

// Save ended demo calls to call log
function saveEndedCalls(ended: ActiveCall[]) {
  if (ended.length === 0) return;
  const store = loadDemoStore();
  for (const c of ended) {
    const parts = c.duration.split(':').map(Number);
    const durSec = (parts[0] || 0) * 60 + (parts[1] || 0);
    const result: CallLog['result'] = c.state === 'active' ? 'answered' : c.state === 'ringing' ? 'missed' : 'failed';
    store.callLogs.unshift({
      uuid: c.uuid,
      direction: (c.direction === 'inbound' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
      caller_id: c.caller_id,
      destination: c.destination,
      start_time: new Date(Date.now() - durSec * 1000).toISOString(),
      duration: durSec,
      result,
      gateway: c.gateway || 'sipgate',
    });
  }
  if (store.callLogs.length > 200) store.callLogs = store.callLogs.slice(0, 200);
  saveDemoStore(store);
}

// Demo security event simulation — realistic escalation per IP
const ATTACK_IPS = [
  '45.134.26.', '185.53.91.', '103.45.67.', '91.200.12.', '198.51.100.',
  '77.83.44.', '5.188.86.', '89.248.167.', '218.92.0.', '61.177.172.',
];
const ATTACK_USERS = ['admin', 'root', 'test', 'user', 'pbx', 'voip', 'sip', 'asterisk'];

// Track per-IP failure count for escalation: auth_failure → brute_force → blocked → banned
const ipFailureTracker = new Map<string, number>();

function createDemoSecurityEvent(): { event: string; ip: string; details: string; level: 'info' | 'warning' | 'error' } {
  // 15% chance of a normal registration event
  if (Math.random() < 0.15) {
    const reg = pick(['alice', 'bob', 'carol', 'eva']);
    return { event: 'registration', ip: `192.168.1.${Math.floor(Math.random() * 200 + 1)}`, details: `User ${reg} registered successfully`, level: 'info' };
  }

  // Pick an attacker IP (reuse existing or create new)
  const prefix = pick(ATTACK_IPS);
  const suffix = Math.floor(Math.random() * 20 + 1); // Small range so IPs repeat
  const ip = prefix + suffix;
  const count = (ipFailureTracker.get(ip) || 0) + 1;
  ipFailureTracker.set(ip, count);

  // Escalation: 1-3 → auth_failure, 4-5 → brute_force, 6 → blocked, 7+ → banned
  if (count <= 3) {
    const user = pick(ATTACK_USERS);
    return { event: 'auth_failure', ip, details: `Invalid credentials for user "${user}" (attempt ${count})`, level: 'warning' };
  }
  if (count <= 5) {
    return { event: 'brute_force', ip, details: `Brute force detected: ${count} failures in 60s`, level: 'error' };
  }
  if (count === 6) {
    return { event: 'blocked', ip, details: `IP auto-blocked: exceeded 5 failed attempts`, level: 'error' };
  }
  // 7+ → Fail2Ban / firewall ban
  ipFailureTracker.delete(ip); // Reset so IP can appear again later
  return { event: 'banned', ip, details: `IP sent to Fail2Ban — firewall ban applied`, level: 'error' };
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [allGateways, setAllGateways] = useState<Gateway[]>([]);
  const [gateways, setGateways] = useState<GatewayStatus[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [aclUserList, setAclUserList] = useState<AclUser[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [licenseInfo, setLicenseInfo] = useState<{ licensed: boolean; trial: boolean; nfr: boolean; max_connections: number }>({ licensed: false, trial: false, nfr: false, max_connections: 0 });
  const [routingCount, setRoutingCount] = useState(0);
  const [callStats, setCallStats] = useState<CallStatEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Dashboard card visibility
  const [hidden, setHidden] = useState<Set<string>>(loadHiddenCards);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const hideCard = (id: string) => {
    const next = new Set(hidden);
    next.add(id);
    setHidden(next);
    saveHiddenCards(next);
  };

  const toggleCard = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
    saveHiddenCards(next);
  };

  const isVisible = (id: string) => !hidden.has(id);

  // Live-updating calls with full demo simulation
  const [liveCalls, setLiveCalls] = useState<ActiveCall[]>([]);
  const liveRef = useRef<ActiveCall[]>([]);
  const demoTotalRef = useRef(0);
  const demoFailedRef = useRef(0);
  const [demoTotalToday, setDemoTotalToday] = useState(0);
  const [demoFailedToday, setDemoFailedToday] = useState(0);
  const demo = isDemoMode();

  // Valid extensions for demo calls: registered SIP users + ACL users
  const validExtsRef = useRef<string[]>([]);
  useEffect(() => {
    const regExts = registrations
      .map((r) => userList.find((u) => u.username === r.user)?.extension)
      .filter(Boolean) as string[];
    const aclExts = aclUserList.map((a) => a.extension);
    validExtsRef.current = [...new Set([...regExts, ...aclExts])];
  }, [registrations, userList, aclUserList]);

  // Sync from API data
  useEffect(() => {
    liveRef.current = [...calls];
    setLiveCalls([...calls]);
    demoTotalRef.current = 0;
    demoFailedRef.current = 0;
    setDemoTotalToday(0);
    setDemoFailedToday(0);
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

      // Remove ended calls (nulls) and track which ones ended
      let alive = raw.filter((c): c is ActiveCall => c !== null);
      const aliveIds = new Set(alive.map((c) => c.uuid));
      const endedCalls = cur.filter((c) => !aliveIds.has(c.uuid));

      // In demo: add new calls randomly — only registered + ACL user extensions
      if (demo && Math.random() < 0.12 && alive.length < 8) {
        alive.push(createDemoCall(validExtsRef.current));
      }

      // Tick ringing durations too (so we know how long they've been ringing)
      alive = alive.map((c) =>
        c.state === 'ringing' || c.state === 'early'
          ? { ...c, duration: tickDuration(c.duration) }
          : c,
      );

      liveRef.current = alive;
      setLiveCalls([...alive]);

      // Save ended calls to demo store call logs
      if (demo && endedCalls.length > 0) {
        demoTotalRef.current += endedCalls.length;
        const endedFailed = endedCalls.filter((c) => c.state !== 'active').length;
        demoFailedRef.current += endedFailed;
        setDemoTotalToday(demoTotalRef.current);
        setDemoFailedToday(demoFailedRef.current);
        saveEndedCalls(endedCalls);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [demo, calls]);

  // Security event simulation (demo only) — every ~10-20s
  useEffect(() => {
    if (!demo) return;
    const secInterval = setInterval(() => {
      if (Math.random() < 0.15) {
        const evt = createDemoSecurityEvent();
        const store = loadDemoStore();
        store.securityLogs.unshift({
          timestamp: new Date().toISOString(),
          ...evt,
        });
        if (store.securityLogs.length > 200) store.securityLogs = store.securityLogs.slice(0, 200);
        saveDemoStore(store);
      }
    }, 3000);
    return () => clearInterval(secInterval);
  }, [demo]);

  const refresh = useCallback(async () => {
    try {
      const [gwRes, gwAllRes, regRes, callRes, usersRes, aclRes, logRes, secRes, extRes, licRes, routeRes, statsRes] = await Promise.all([
        api.get('/gateways/status'),
        api.get('/gateways'),
        api.get('/registrations'),
        api.get('/active-calls'),
        api.get('/users'),
        api.get('/acl-users'),
        api.get('/logs/calls'),
        api.get('/security'),
        api.get('/extensions'),
        api.get('/license'),
        api.get('/routes'),
        api.get('/logs/call-stats'),
      ]);
      setAllGateways(gwAllRes.data || []);
      setGateways(gwRes.data || []);
      setRegistrations(regRes.data || []);
      setCalls(callRes.data?.calls || []);
      // callRes.data?.count available if needed
      const users: User[] = usersRes.data || [];
      const aclUsers: AclUser[] = aclRes.data || [];
      setUserList(users);
      setAclUserList(aclUsers);
      setCallLogs(logRes.data || []);
      setBlockedCount((secRes.data?.blacklist || []).length);
      setExtensions(extRes.data || []);
      setCallStats(statsRes.data || []);
      if (licRes.data) setLicenseInfo({ licensed: licRes.data.licensed, trial: licRes.data.trial, nfr: !!licRes.data.nfr, max_connections: licRes.data.max_connections || 0 });
      if (routeRes.data) {
        const rd = routeRes.data;
        // Count enabled routes (inbound + outbound user routes)
        const inb = (rd.inbound || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        const usr = (rd.user_routes || []).filter((r: { enabled?: boolean }) => r.enabled !== false).length;
        setRoutingCount(inb + usr);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const prefs = loadPreferences();
  // Demo mode: faster refresh so all cards stay current
  const refreshMs = demo ? 5000 : prefs.refreshInterval * 1000;
  useAutoRefresh(refresh, refreshMs);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  const isGwEnabled = (name: string) => {
    const gw = allGateways.find((g) => g.name === name);
    return gw ? gw.enabled !== false : true;
  };
  const gwRegistered = gateways.filter((g) => g.state === 'REGED' && isGwEnabled(g.name)).length;
  const extActive = extensions.filter((e) => e.enabled !== false).length;
  const failedCallsBase = callLogs.filter((c) => c.result === 'failed' || c.result === 'missed').length;
  const liveTotalCalls = callLogs.length + demoTotalToday;
  const liveFailedCalls = failedCallsBase + demoFailedToday;

  // Live registration count: base registrations + users with active calls in demo mode
  const liveRegCount = (() => {
    const regUsers = new Set(registrations.map((r) => r.user));
    if (!demo) return regUsers.size;
    for (const call of liveCalls) {
      const ext = call.direction === 'inbound' ? call.destination : call.caller_id;
      const user = userList.find((u) => u.extension === ext);
      if (user) regUsers.add(user.username);
    }
    return regUsers.size;
  })();

  // Dismiss button overlay styles (appears on hover)
  const dismissSx = {
    position: 'absolute', top: 2, right: 2, zIndex: 1,
    opacity: 0, transition: 'opacity 0.2s',
    bgcolor: 'background.paper',
    '&:hover': { bgcolor: 'action.hover' },
  } as const;
  const hoverWrapSx = { position: 'relative', '&:hover .dash-x': { opacity: 1 } } as const;

  // All available dashboard cards for the customize dialog
  const allCards = [
    { id: 'gateways', label: t('dashboard.gateways_registered') },
    { id: 'users', label: t('dashboard.users_online') },
    { id: 'extensions', label: t('dashboard.extensions_active') },
    { id: 'ext_routes', label: t('section.extension_routes') },
    { id: 'active_calls', label: t('dashboard.active_calls') },
    { id: 'total_calls', label: t('dashboard.total_calls') },
    { id: 'blocked_ips', label: t('dashboard.blocked_ips') },
    { id: 'license', label: t('dashboard.license_status') },
    { id: 'gateway_status', label: t('dashboard.gateway_status') },
    { id: 'registrations', label: t('dashboard.user_registrations') },
    { id: 'live_calls', label: t('dashboard.active_calls') + ' (Live)' },
    { id: 'call_stats', label: t('dashboard.call_stats') },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{t('nav.dashboard')}</Typography>
        <Tooltip title={t('dashboard.customize')}>
          <IconButton onClick={() => setCustomizeOpen(true)}>
            <TuneIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3 }}>
        {/* Gateways: registered / total */}
        {isVisible('gateways') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('gateways')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
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
          </Box>
        )}

        {/* Users: online / total */}
        {isVisible('users') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('users')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
            <Card sx={{ minWidth: 180 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PersonIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {liveRegCount}
                    <Typography component="span" variant="h5" color="text.secondary">/{userList.length + aclUserList.length}</Typography>
                  </Typography>
                  <Typography color="text.secondary" variant="body2">{t('dashboard.users_online')}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Extensions: active / total */}
        {isVisible('extensions') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('extensions')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
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
          </Box>
        )}

        {/* Extension Routes: used / licensed */}
        {isVisible('ext_routes') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('ext_routes')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
            <Card sx={{ minWidth: 180 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AltRouteIcon color={routingCount > licenseInfo.max_connections ? 'error' : 'primary'} sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {routingCount}
                    <Typography component="span" variant="h5" color={routingCount > licenseInfo.max_connections ? 'error.main' : 'text.secondary'}>
                      /{licenseInfo.max_connections}
                    </Typography>
                  </Typography>
                  <Typography color="text.secondary" variant="body2">{t('section.extension_routes')}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Active Calls */}
        {isVisible('active_calls') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('active_calls')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
            <Card sx={{ minWidth: 180 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PhoneIcon color={liveCalls.length > 0 ? 'success' : 'primary'} sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{liveCalls.length}</Typography>
                  <Typography color="text.secondary" variant="body2">{t('dashboard.active_calls')}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Total Calls / Failed */}
        {isVisible('total_calls') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('total_calls')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
            <Card sx={{ minWidth: 180 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PhoneMissedIcon color={liveFailedCalls > 0 ? 'error' : 'primary'} sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">
                    {liveTotalCalls}
                    <Typography component="span" variant="h5" color={liveFailedCalls > 0 ? 'error.main' : 'text.secondary'}>
                      /{liveFailedCalls}
                    </Typography>
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {t('dashboard.total_calls')} / {t('dashboard.failed_calls')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Blocked IPs */}
        {isVisible('blocked_ips') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('blocked_ips')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
            <Card sx={{ minWidth: 180 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ShieldIcon color={blockedCount > 0 ? 'error' : 'primary'} sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{blockedCount}</Typography>
                  <Typography color="text.secondary" variant="body2">{t('dashboard.blocked_ips')}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* License */}
        {isVisible('license') && (
          <Box sx={hoverWrapSx}>
            <IconButton className="dash-x" size="small" onClick={() => hideCard('license')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
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
        )}
      </Box>

      {/* Gateway Status */}
      {isVisible('gateway_status') && (
        <Box sx={{ ...hoverWrapSx, mb: 3 }}>
          <IconButton className="dash-x" size="small" onClick={() => hideCard('gateway_status')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          <Card>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('dashboard.gateway_status')}</Typography>
              {(() => {
                const regedGateways = gateways.filter((gw) => gw.state === 'REGED' && isGwEnabled(gw.name));
                return regedGateways.length === 0 ? (
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
                        {regedGateways.map((gw) => (
                          <TableRow key={gw.name}>
                            <TableCell>{gw.name}</TableCell>
                            <TableCell>
                              <Chip size="small" label="REGED" color="success" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              })()}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Registrations */}
      {isVisible('registrations') && (
        <Box sx={{ ...hoverWrapSx, mb: 3 }}>
          <IconButton className="dash-x" size="small" onClick={() => hideCard('registrations')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          <Card>
            <CardContent sx={{ px: 4, py: 3 }}>
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
                      {registrations.map((reg, i) => {
                        const u = userList.find((usr) => usr.username === reg.user);
                        const userLabel = u ? `${reg.user} (${u.extension})` : reg.user;
                        return (
                          <TableRow key={i}>
                            <TableCell>{userLabel}</TableCell>
                            <TableCell>{reg.ip}:{reg.port}</TableCell>
                            <TableCell>{reg.user_agent}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Active Calls (live-updating durations) */}
      {isVisible('live_calls') && (
        <Box sx={hoverWrapSx}>
          <IconButton className="dash-x" size="small" onClick={() => hideCard('live_calls')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          <Card>
            <CardContent sx={{ px: 4, py: 3 }}>
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
                        <TableCell>{t('dashboard.connection')}</TableCell>
                        <TableCell>{t('calls.direction')}</TableCell>
                        <TableCell>{t('calls.from')}</TableCell>
                        <TableCell>{t('calls.to')}</TableCell>
                        <TableCell>{t('field.status')}</TableCell>
                        <TableCell>{t('calls.duration')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {liveCalls.map((call) => {
                        const gw = allGateways.find((g) => g.name === call.gateway);
                        const gwLabel = gw?.description ? `${call.gateway} (${gw.description})` : (call.gateway || '\u2014');
                        return (
                          <TableRow key={call.uuid}>
                            <TableCell>
                              <Typography variant="body2" noWrap>{gwLabel}</Typography>
                            </TableCell>
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Call Statistics (per-connection) */}
      {isVisible('call_stats') && (
        <Box sx={{ ...hoverWrapSx, mt: 3 }}>
          <IconButton className="dash-x" size="small" onClick={() => hideCard('call_stats')} sx={dismissSx}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          <Card>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BarChartIcon color="primary" />
                <Typography variant="h6">{t('dashboard.call_stats')}</Typography>
              </Box>
              {callStats.length === 0 ? (
                <Typography color="text.secondary">{t('dashboard.no_call_stats')}</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('dashboard.connection')}</TableCell>
                        <TableCell>{t('calls.direction')}</TableCell>
                        <TableCell align="right">{t('dashboard.today')}</TableCell>
                        <TableCell align="right">{t('dashboard.this_month')}</TableCell>
                        <TableCell align="right">{t('dashboard.last_90_days')}</TableCell>
                        <TableCell align="right">{t('dashboard.last_180_days')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {callStats.map((stat) => {
                        const gw = allGateways.find((g) => g.name === stat.gateway);
                        const gwLabel = gw?.description ? `${stat.gateway} (${gw.description})` : stat.gateway;
                        return (
                          <TableRow key={`${stat.gateway}-${stat.direction}`}>
                            <TableCell>{gwLabel}</TableCell>
                            <TableCell>
                              <Tooltip title={stat.direction === 'inbound' ? t('route.type_inbound') : t('route.type_outbound')}>
                                {stat.direction === 'inbound'
                                  ? <CallReceivedIcon sx={{ fontSize: 18, color: 'info.main' }} />
                                  : <CallMadeIcon sx={{ fontSize: 18, color: 'warning.main' }} />}
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">{stat.today}</TableCell>
                            <TableCell align="right">{stat.month}</TableCell>
                            <TableCell align="right">{stat.days_90}</TableCell>
                            <TableCell align="right">{stat.days_180}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Customize Dashboard Dialog */}
      <Dialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {t('dashboard.customize')}
          <IconButton size="small" onClick={() => setCustomizeOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {allCards.map((card) => (
            <FormControlLabel
              key={card.id}
              control={<Checkbox checked={isVisible(card.id)} onChange={() => toggleCard(card.id)} />}
              label={card.label}
              sx={{ display: 'block' }}
            />
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
