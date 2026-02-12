import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import api from '../api/client';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { ESLEvent, ESLStatus } from '../api/types';

const LEVEL_COLORS: Record<string, 'info' | 'warning' | 'error' | 'default' | 'success'> = {
  info: 'info', warning: 'warning', error: 'error', debug: 'default',
};

export default function Logs() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<ESLEvent[]>([]);
  const [status, setStatus] = useState<ESLStatus | null>(null);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const lastTs = useRef(0);

  const load = useCallback(async () => {
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

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 3000);

  const start = () => api.post('/esl/start').then(() => load());
  const stop = () => api.post('/esl/stop').then(() => load());
  const clear = () => { api.post('/esl/clear'); setEvents([]); lastTs.current = 0; };

  const filtered = events.filter((e) => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (filter && !e.text?.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('logs.esl_events')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {status?.running ? (
            <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={stop}>
              {t('button.cancel')}
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

      {/* Status */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Chip
          label={status?.connected ? t('logs.esl_connected') : t('logs.esl_disconnected')}
          color={status?.connected ? 'success' : 'error'}
          size="small"
        />
        <Typography variant="body2" color="text.secondary">
          {t('logs.events_buffer')}: {status?.buffer_stats?.buffer_size || 0} / {status?.buffer_stats?.max_size || 0}
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder={t('logs.search')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 300 }}
        />
        <TextField
          select size="small" value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          sx={{ width: 120 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="info">Info</MenuItem>
          <MenuItem value="warning">Warning</MenuItem>
          <MenuItem value="error">Error</MenuItem>
          <MenuItem value="debug">Debug</MenuItem>
        </TextField>
      </Box>

      {/* Events */}
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
                {filtered.slice(-200).reverse().map((e, i) => (
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
    </Box>
  );
}
