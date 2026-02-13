/**
 * @file Logs — System, Call, and Security logs with tabs
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Chip, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import TerminalIcon from '@mui/icons-material/Terminal';
import PhoneIcon from '@mui/icons-material/Phone';
import ShieldIcon from '@mui/icons-material/Shield';
import api from '../api/client';
import SearchableSelect from '../components/SearchableSelect';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { ESLEvent, ESLStatus, CallLog, SecurityLog } from '../api/types';

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

export default function Logs() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  // System logs (ESL)
  const [events, setEvents] = useState<ESLEvent[]>([]);
  const [status, setStatus] = useState<ESLStatus | null>(null);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const lastTs = useRef(0);

  // Call logs
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callFilter, setCallFilter] = useState('');

  // Security logs
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [secFilter, setSecFilter] = useState('');

  // Category filter for system logs
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
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

  const loadSecurity = useCallback(async () => {
    try {
      const res = await api.get('/logs/security');
      setSecurityLogs(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadEsl(); loadCalls(); loadSecurity(); }, [loadEsl, loadCalls, loadSecurity]);
  useAutoRefresh(loadEsl, 3000);

  const start = () => api.post('/esl/start').then(() => loadEsl());
  const stop = () => api.post('/esl/stop').then(() => loadEsl());
  const clear = () => { api.post('/esl/clear'); setEvents([]); lastTs.current = 0; };

  const filteredEvents = events.filter((e) => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (selectedCategories.size > 0 && !selectedCategories.has(e.type)) return false;
    if (filter && !e.text?.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const filteredCalls = callLogs.filter((c) => {
    if (!callFilter) return true;
    const q = callFilter.toLowerCase();
    return c.caller_id.toLowerCase().includes(q) || c.destination.toLowerCase().includes(q) || c.gateway.toLowerCase().includes(q);
  });

  const filteredSecurity = securityLogs.filter((s) => {
    if (!secFilter) return true;
    const q = secFilter.toLowerCase();
    return s.ip.toLowerCase().includes(q) || s.details.toLowerCase().includes(q) || s.event.toLowerCase().includes(q);
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.logs')}</Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<TerminalIcon />} iconPosition="start" label={t('logs.tab_system')} />
        <Tab icon={<PhoneIcon />} iconPosition="start" label={t('logs.tab_calls')} />
        <Tab icon={<ShieldIcon />} iconPosition="start" label={t('logs.tab_security')} />
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
            />
          </Box>

          {/* Category filter chips */}
          {categories.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                label="All"
                size="small"
                variant={selectedCategories.size === 0 ? 'filled' : 'outlined'}
                color={selectedCategories.size === 0 ? 'primary' : 'default'}
                onClick={() => setSelectedCategories(new Set())}
              />
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  size="small"
                  variant={selectedCategories.has(cat) ? 'filled' : 'outlined'}
                  color={selectedCategories.has(cat) ? 'primary' : 'default'}
                  onClick={() => {
                    const next = new Set(selectedCategories);
                    if (next.has(cat)) next.delete(cat);
                    else next.add(cat);
                    setSelectedCategories(next);
                  }}
                />
              ))}
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
                    {filteredEvents.slice(-200).reverse().map((e, i) => (
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
            </CardContent>
          </Card>
        </>
      )}

      {/* Call Logs */}
      {tab === 1 && (
        <>
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder={t('logs.search')}
              value={callFilter}
              onChange={(e) => setCallFilter(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ width: 300 }}
            />
          </Box>

          <Card>
            <CardContent sx={{ p: 0 }}>
              {filteredCalls.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Typography color="text.secondary">{t('logs.no_calls')}</Typography>
                </Box>
              ) : (
                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 160 }}>{t('calls.time')}</TableCell>
                        <TableCell sx={{ width: 100 }}>{t('calls.direction')}</TableCell>
                        <TableCell>{t('calls.from')}</TableCell>
                        <TableCell>{t('calls.to')}</TableCell>
                        <TableCell sx={{ width: 100 }}>{t('calls.duration')}</TableCell>
                        <TableCell sx={{ width: 100 }}>{t('calls.result')}</TableCell>
                        <TableCell sx={{ width: 100 }}>{t('field.gateway')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCalls.map((c) => (
                        <TableRow key={c.uuid} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {new Date(c.start_time).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={c.direction === 'inbound' ? '\u2193 IN' : '\u2191 OUT'}
                              color={c.direction === 'inbound' ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{c.caller_id}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{c.destination}</TableCell>
                          <TableCell>{formatDuration(c.duration)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={t(`logs.call_result_${c.result}`)}
                              color={CALL_RESULT_COLORS[c.result] || 'default'}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{c.gateway}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Security Logs */}
      {tab === 2 && (
        <>
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder={t('logs.search')}
              value={secFilter}
              onChange={(e) => setSecFilter(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ width: 300 }}
            />
          </Box>

          <Card>
            <CardContent sx={{ p: 0 }}>
              {filteredSecurity.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Typography color="text.secondary">{t('logs.no_security')}</Typography>
                </Box>
              ) : (
                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 160 }}>{t('calls.time')}</TableCell>
                        <TableCell sx={{ width: 80 }}>{t('logs.level')}</TableCell>
                        <TableCell sx={{ width: 130 }}>{t('logs.event')}</TableCell>
                        <TableCell sx={{ width: 150 }}>{t('field.ip_address')}</TableCell>
                        <TableCell>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSecurity.map((s, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {new Date(s.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={s.level} color={LEVEL_COLORS[s.level] || 'default'} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>{s.event}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{s.ip}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{s.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
