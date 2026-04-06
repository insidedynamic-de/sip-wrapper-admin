/**
 * @file SaasLogs — Audit logs with role-based scoping
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, IconButton, CircularProgress, Button,
  TextField, InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api/client';

interface LogEntry {
  id: number;
  action: string;
  actor_email: string;
  tenant_id: number;
  ip: string;
  details: string;
  created_at: string;
}

const actionColor: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  LOGIN_SUCCESS: 'success',
  LOGIN_FAILED: 'error',
  LOGOUT: 'default',
  REGISTER: 'info',
  MFA_ENABLED: 'success',
  MFA_FAILED: 'error',
  ACCOUNT_LOCKED: 'error',
  TENANT_UPDATED: 'info',
  USER_CREATED_BY_ADMIN: 'info',
  USER_UPDATED_BY_ADMIN: 'warning',
  USER_DEACTIVATED: 'error',
  LICSERVER_LINKED: 'success',
  CLIENT_IMPORTED: 'info',
};

export default function SaasLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/logs', { params: { offset: page * pageSize, limit: pageSize } });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    const handler = () => fetchLogs();
    window.addEventListener('tenant-switched', handler);
    return () => window.removeEventListener('tenant-switched', handler);
  }, [fetchLogs]);

  const filtered = search
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.actor_email.toLowerCase().includes(search.toLowerCase()) ||
        l.details.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Logs</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Search..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }}
            sx={{ width: 220 }}
          />
          <IconButton onClick={fetchLogs}><RefreshIcon /></IconButton>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <TableContainer component={Card}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Zeit</TableCell>
                  <TableCell>Aktion</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Keine Logs</TableCell></TableRow>
                ) : filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip label={l.action} size="small"
                        color={actionColor[l.action] || 'default'}
                        sx={{ fontSize: 11, fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{l.actor_email || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.details}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>{l.ip || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {total} Einträge
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Zurück</Button>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                {page + 1} / {Math.max(1, Math.ceil(total / pageSize))}
              </Typography>
              <Button size="small" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Weiter</Button>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
