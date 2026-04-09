/**
 * @file Logs — System, Call, and Security logs with tabs
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Chip, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TerminalIcon from '@mui/icons-material/Terminal';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
import api from '../api/client';
import SearchableSelect from '../components/SearchableSelect';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { formatDateTime } from '../store/preferences';
import type { ESLEvent, ESLStatus, CallLog, Gateway, User, Extension, Route, AuditEntry, AuditCategory } from '../api/types';

const LEVEL_COLORS: Record<string, 'info' | 'warning' | 'error' | 'default' | 'success'> = {
  info: 'info', warning: 'warning', error: 'error', debug: 'default',
};

const CALL_RESULT_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  answered: 'success', missed: 'warning', failed: 'error', busy: 'default',
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return '\u2014';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const LOG_TAB_IDS = ['system', 'calls', 'audit'];

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

const AUDIT_CATEGORIES: AuditCategory[] = ['auth', 'user', 'gateway', 'route', 'security', 'config', 'license', 'system'];

const CATEGORY_COLORS: Record<AuditCategory, 'info' | 'success' | 'warning' | 'error' | 'default' | 'primary' | 'secondary'> = {
  auth: 'info', user: 'success', gateway: 'primary', route: 'secondary',
  security: 'error', config: 'warning', license: 'default', system: 'default',
};

function tabFromHash(hash: string): number {
  if (!hash) return 0;
  const h = hash.replace(/^#/, '').toLowerCase();
  const idx = LOG_TAB_IDS.indexOf(h);
  return idx >= 0 ? idx : 0;
}

export default function Logs() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  // Only use hash navigation when Logs is a standalone page (not embedded in Configuration)
  const isEmbedded = location.pathname.includes('/products/');
  const [tab, setTab] = useState(isEmbedded ? 0 : tabFromHash(location.hash));

  // Sync tab when URL hash changes externally (standalone only)
  useEffect(() => {
    if (isEmbedded) return;
    const idx = tabFromHash(location.hash);
    if (idx !== tab) setTab(idx);
  }, [location.hash, isEmbedded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (_: unknown, v: number) => {
    setTab(v);
    if (!isEmbedded) navigate({ hash: LOG_TAB_IDS[v] }, { replace: true });
  };

  const PAGE_OPTIONS = [100, 250, 500, 1000];

  // System logs (ESL)
  const [events, setEvents] = useState<ESLEvent[]>([]);
  const [status, setStatus] = useState<ESLStatus | null>(null);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const lastTs = useRef(0);
  const [eslPage, setEslPage] = useState(0);
  const [eslRowsPerPage, setEslRowsPerPage] = useState(250);

  // Call logs
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callFilter, setCallFilter] = useState('');
  const [callPage, setCallPage] = useState(0);
  const [callRowsPerPage, setCallRowsPerPage] = useState(250);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState('');
  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(250);
  const [auditCategory, setAuditCategory] = useState<AuditCategory | ''>('');

  // Context data for enriching call logs
  const [gwList, setGwList] = useState<Gateway[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [extList, setExtList] = useState<Extension[]>([]);
  const [routes, setRoutes] = useState<Route | null>(null);

  // Category filter for system logs — excluded categories (inverted: all active by default)
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const categories = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.type));
    return Array.from(set).sort();
  }, [events]);

  const loadEsl = useCallback(async () => {
    try {
      const res = await api.get('/esl/events', { params: { count: 200, since: lastTs.current } });
      const newEvents: ESLEvent[] = res.data?.events || [];
      if (newEvents.length > 0) {
        lastTs.current = newEvents[newEvents.length - 1].timestamp;
        setEvents((prev) => [...prev, ...newEvents].slice(-500));
      }
      setStatus(res.data?.status || null);
    } catch { /* ignore */ }
  }, []);

  const loadCalls = useCallback(async () => {
    try {
      const res = await api.get('/logs/calls');
      setCallLogs(res.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { limit: auditRowsPerPage, offset: auditPage * auditRowsPerPage };
      if (auditCategory) params.category = auditCategory;
      if (auditFilter) params.search = auditFilter;
      const res = await api.get('/audit', { params });
      setAuditLogs(res.data?.entries || []);
      setAuditTotal(res.data?.total || 0);
    } catch { /* ignore */ }
  }, [auditRowsPerPage, auditPage, auditCategory, auditFilter]);

  const loadContext = useCallback(async () => {
    try {
      const [gwRes, uRes, eRes, rRes] = await Promise.all([
        api.get('/gateways'), api.get('/users'), api.get('/extensions'), api.get('/routes'),
      ]);
      setGwList(gwRes.data || []);
      setUserList(uRes.data || []);
      setExtList(eRes.data || []);
      setRoutes(rRes.data || null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadEsl(); loadCalls(); loadAudit(); loadContext(); }, [loadEsl, loadCalls, loadAudit, loadContext]);
  useAutoRefresh(loadEsl, 3000);

  // Resolve extension number to "username (extension)" or "extension — description"
  const resolveUser = useCallback((ext: string) => {
    const user = userList.find((u) => u.extension === ext);
    if (user) return `${user.username} (${ext})`;
    const e = extList.find((x) => x.extension === ext);
    if (e) return `${ext} \u2014 ${e.description}`;
    return ext;
  }, [userList, extList]);

  // Resolve gateway name to "name (description)"
  const resolveGateway = useCallback((name: string) => {
    const gw = gwList.find((g) => g.name === name);
    return gw?.description ? `${name} (${gw.description})` : name;
  }, [gwList]);

  // Resolve connection/route name from routes data
  const resolveConnection = useCallback((gwName: string, direction: string, callerOrDest: string) => {
    if (!routes) return '\u2014';
    if (direction === 'inbound') {
      const r = (routes.inbound || []).find((ib) => ib.gateway === gwName);
      return r?.description || '\u2014';
    }
    const user = userList.find((u) => u.extension === callerOrDest);
    if (user) {
      const r = (routes.user_routes || []).find((ur) => ur.username === user.username);
      return r?.description || '\u2014';
    }
    return '\u2014';
  }, [routes, userList]);

  const start = () => api.post('/esl/start').then(() => loadEsl());
  const stop = () => api.post('/esl/stop').then(() => loadEsl());
  const clear = () => { api.post('/esl/clear'); setEvents([]); lastTs.current = 0; };

  const filteredEvents = events.filter((e) => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (excludedCategories.has(e.type)) return false;
    if (filter && !e.text?.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const filteredCalls = callLogs.filter((c) => {
    if (!callFilter) return true;
    const q = callFilter.toLowerCase();
    return c.caller_id.toLowerCase().includes(q) || c.destination.toLowerCase().includes(q) || c.gateway.toLowerCase().includes(q);
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.logs')}</Typography>

      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<TerminalIcon />} iconPosition="start" label={t('logs.tab_system')} />
        <Tab icon={<PhoneIcon />} iconPosition="start" label={t('logs.tab_calls')} />
        <Tab icon={<PersonIcon />} iconPosition="start" label={t('logs.tab_audit')} />
      </Tabs>

      {/* System Logs (ESL) */}
      {tab === 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip
                label={status?.connected ? t('logs.esl_connected') : t('logs.esl_disconnected')}
                color={status?.connected ? 'success' : 'error'}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {t('logs.events_buffer')}: {status?.buffer_stats?.buffer_size || 0} / {status?.buffer_stats?.max_size || 0}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {status?.running ? (
                <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={stop}>
                  Stop
                </Button>
              ) : (
                <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={start}>
                  Start
                </Button>
              )}
              <Button size="small" variant="outlined" startIcon={<DeleteSweepIcon />} onClick={clear}>
                Clear
              </Button>
              <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => {
                const text = filteredEvents.slice(-eslRowsPerPage).reverse()
                  .map((e) => `${e.datetime}\t${e.level}\t${e.type}\t${e.text}`).join('\n');
                copyText(text);
              }}>
                Copy
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              size="small"
              placeholder={t('logs.search')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ width: 300 }}
            />
            <SearchableSelect
              options={[
                { label: t('logs.level_all'), value: 'all' },
                { label: 'Info', value: 'info' },
                { label: 'Warning', value: 'warning' },
                { label: 'Error', value: 'error' },
                { label: 'Debug', value: 'debug' },
              ]}
              value={levelFilter}
              onChange={setLevelFilter}
              label={t('logs.level')}
              sx={{ minWidth: 150 }}
            />
          </Box>

          {/* Category filter chips — all active by default, click to exclude */}
          {categories.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                label="All"
                size="small"
                variant="filled"
                color={excludedCategories.size === 0 ? 'primary' : 'default'}
                onClick={() => setExcludedCategories(new Set())}
              />
              {categories.map((cat) => {
                const active = !excludedCategories.has(cat);
                return (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    variant={active ? 'filled' : 'outlined'}
                    color={active ? 'primary' : 'default'}
                    onClick={() => {
                      const next = new Set(excludedCategories);
                      if (active) next.add(cat);
                      else next.delete(cat);
                      setExcludedCategories(next);
                    }}
                  />
                );
              })}
            </Box>
          )}

          <Card>
            <CardContent sx={{ p: 0 }}>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 160 }}>{t('calls.time')}</TableCell>
                      <TableCell sx={{ width: 80 }}>{t('logs.level')}</TableCell>
                      <TableCell sx={{ width: 120 }}>{t('field.type')}</TableCell>
                      <TableCell>Message</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEvents.slice().reverse()
                      .slice(eslPage * eslRowsPerPage, eslPage * eslRowsPerPage + eslRowsPerPage)
                      .map((e, i) => (
                      <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{e.datetime}</TableCell>
                        <TableCell>
                          <Chip size="small" label={e.level} color={LEVEL_COLORS[e.level] || 'default'} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{e.type}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {e.text}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination component="div" count={filteredEvents.length}
                page={eslPage} onPageChange={(_, p) => setEslPage(p)}
                rowsPerPage={eslRowsPerPage}
                onRowsPerPageChange={(e) => { setEslRowsPerPage(parseInt(e.target.value)); setEslPage(0); }}
                rowsPerPageOptions={PAGE_OPTIONS} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Call Logs */}
      {tab === 1 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder={t('logs.search')}
              value={callFilter}
              onChange={(e) => { setCallFilter(e.target.value); setCallPage(0); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ width: 300 }}
            />
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => {
              const visible = filteredCalls.slice(callPage * callRowsPerPage, callPage * callRowsPerPage + callRowsPerPage);
              const text = visible.map((c) =>
                `${c.start_time}\t${c.direction}\t${c.caller_id}\t${c.destination}\t${c.duration}s\t${c.result}\t${c.gateway}`
              ).join('\n');
              copyText(text);
            }}>
              Copy
            </Button>
          </Box>

          <Card>
            <CardContent sx={{ p: 0 }}>
              {filteredCalls.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Typography color="text.secondary">{t('logs.no_calls')}</Typography>
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 160 }}>{t('calls.time')}</TableCell>
                          <TableCell sx={{ width: 80 }}>{t('calls.direction')}</TableCell>
                          <TableCell>{t('calls.from')}</TableCell>
                          <TableCell>{t('calls.to')}</TableCell>
                          <TableCell sx={{ width: 90 }}>{t('calls.duration')}</TableCell>
                          <TableCell sx={{ width: 100 }}>{t('calls.result')}</TableCell>
                          <TableCell>{t('field.gateway')}</TableCell>
                          <TableCell>{t('dashboard.connection')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredCalls
                          .slice(callPage * callRowsPerPage, callPage * callRowsPerPage + callRowsPerPage)
                          .map((c) => {
                            const fromResolved = c.direction === 'inbound' ? c.caller_id : resolveUser(c.caller_id);
                            const toResolved = c.direction === 'inbound' ? resolveUser(c.destination) : c.destination;
                            const connExt = c.direction === 'inbound' ? c.destination : c.caller_id;
                            return (
                              <TableRow key={c.uuid} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                  {formatDateTime(c.start_time)}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={c.direction === 'inbound' ? '\u2193 IN' : '\u2191 OUT'}
                                    color={c.direction === 'inbound' ? 'info' : 'default'}
                                  />
                                </TableCell>
                                <TableCell sx={{ fontSize: 13 }}>{fromResolved}</TableCell>
                                <TableCell sx={{ fontSize: 13 }}>{toResolved}</TableCell>
                                <TableCell>{formatDuration(c.duration)}</TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={t(`logs.call_result_${c.result}`)}
                                    color={CALL_RESULT_COLORS[c.result] || 'default'}
                                  />
                                </TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{resolveGateway(c.gateway)}</TableCell>
                                <TableCell sx={{ fontSize: 12 }}>{resolveConnection(c.gateway, c.direction, connExt)}</TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={filteredCalls.length}
                    page={callPage}
                    onPageChange={(_, p) => setCallPage(p)}
                    rowsPerPage={callRowsPerPage}
                    onRowsPerPageChange={(e) => { setCallRowsPerPage(parseInt(e.target.value, 10)); setCallPage(0); }}
                    rowsPerPageOptions={PAGE_OPTIONS}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Audit / User Actions */}
      {tab === 2 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder={t('logs.search')}
              value={auditFilter}
              onChange={(e) => { setAuditFilter(e.target.value); setAuditPage(0); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ width: 300 }}
            />
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => {
              const text = auditLogs.map((a) =>
                `${a.timestamp}\t${a.category}\t${a.action}\t${a.user}\t${a.ip}\t${a.details}\t${a.success ? 'OK' : 'Error'}`
              ).join('\n');
              copyText(text);
            }}>
              Copy
            </Button>
            <SearchableSelect
              options={[
                { label: t('logs.level_all'), value: '' },
                ...AUDIT_CATEGORIES.map((c) => ({ label: t(`audit.cat_${c}`), value: c })),
              ]}
              value={auditCategory}
              onChange={(v) => { setAuditCategory(v as AuditCategory | ''); setAuditPage(0); }}
              label={t('audit.category')}
              sx={{ minWidth: 180 }}
            />
          </Box>

          {/* Category chips */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={t('logs.level_all')}
              size="small"
              variant={auditCategory === '' ? 'filled' : 'outlined'}
              color={auditCategory === '' ? 'primary' : 'default'}
              onClick={() => { setAuditCategory(''); setAuditPage(0); }}
            />
            {AUDIT_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={t(`audit.cat_${cat}`)}
                size="small"
                variant={auditCategory === cat ? 'filled' : 'outlined'}
                color={auditCategory === cat ? CATEGORY_COLORS[cat] : 'default'}
                onClick={() => { setAuditCategory(auditCategory === cat ? '' : cat); setAuditPage(0); }}
              />
            ))}
          </Box>

          <Card>
            <CardContent sx={{ p: 0 }}>
              {auditLogs.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Typography color="text.secondary">{t('audit.no_entries')}</Typography>
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 160 }}>{t('calls.time')}</TableCell>
                          <TableCell sx={{ width: 100 }}>{t('audit.category')}</TableCell>
                          <TableCell sx={{ width: 120 }}>{t('audit.action')}</TableCell>
                          <TableCell sx={{ width: 80 }}>{t('field.user')}</TableCell>
                          <TableCell sx={{ width: 130 }}>{t('field.ip_address')}</TableCell>
                          <TableCell sx={{ width: 130 }}>{t('audit.hostname')}</TableCell>
                          <TableCell>{t('field.details')}</TableCell>
                          <TableCell sx={{ width: 70 }}>{t('field.status')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLogs.map((a) => (
                          <TableRow key={a.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                              {formatDateTime(a.timestamp)}
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={t(`audit.cat_${a.category}`)} color={CATEGORY_COLORS[a.category] || 'default'} />
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>{a.action}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{a.user}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{a.ip}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{a.hostname}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{a.details}</TableCell>
                            <TableCell>
                              <Chip size="small" label={a.success ? 'OK' : t('status.error')} color={a.success ? 'success' : 'error'} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={auditTotal}
                    page={auditPage}
                    onPageChange={(_, p) => setAuditPage(p)}
                    rowsPerPage={auditRowsPerPage}
                    onRowsPerPageChange={(e) => { setAuditRowsPerPage(parseInt(e.target.value, 10)); setAuditPage(0); }}
                    rowsPerPageOptions={PAGE_OPTIONS}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

    </Box>
  );
}
