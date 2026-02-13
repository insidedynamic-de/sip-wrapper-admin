/**
 * @file Monitoring — System monitoring: CPU, RAM, Disk, Network, OS, Hardware, Security
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, Typography, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  LinearProgress, Chip, IconButton, Tooltip, Snackbar, Alert, TextField, InputAdornment,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import ComputerIcon from '@mui/icons-material/Computer';
import ShieldIcon from '@mui/icons-material/Shield';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api/client';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { loadPreferences, formatDateTime } from '../store/preferences';
import FormDialog from '../components/FormDialog';
import type { SystemInfo, SecurityLog, BlacklistEntry, WhitelistEntry } from '../api/types';

/** Format bytes to human-readable */
function fmtBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

/** Format bytes/s to human-readable rate */
function fmtRate(bps: number): string {
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}

/** Format uptime seconds to readable */
function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '< 1m';
}

/** Color for usage percentage */
function usageColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 90) return 'error';
  if (pct >= 70) return 'warning';
  return 'success';
}

export default function Monitoring() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [aclDialog, setAclDialog] = useState<{ open: boolean; ip: string }>({ open: false, ip: '' });
  const [aclForm, setAclForm] = useState({ username: '', extension: '', caller_id: '' });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [secSearch, setSecSearch] = useState('');
  const [secPage, setSecPage] = useState(0);
  const [secRowsPerPage, setSecRowsPerPage] = useState(10);

  const showToast = (success: boolean) => {
    setToast({ open: true, message: success ? t('status.success') : t('status.error'), severity: success ? 'success' : 'error' });
  };

  const refresh = useCallback(async () => {
    try {
      const [sysRes, secRes, logRes] = await Promise.all([
        api.get('/system/info'),
        api.get('/security'),
        api.get('/logs/security'),
      ]);
      setInfo(sysRes.data);
      setBlacklist(secRes.data?.blacklist || []);
      setWhitelist(secRes.data?.whitelist?.entries || []);
      if (secRes.data?.auto_blacklist) setThreshold(secRes.data.auto_blacklist.threshold || 5);
      setSecurityLogs(logRes.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const prefs = loadPreferences();
  useAutoRefresh(refresh, prefs.refreshInterval * 1000);

  if (!info) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.monitoring')}</Typography>
        <Typography color="text.secondary">{t('status.loading')}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.monitoring')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<MonitorHeartIcon />} iconPosition="start" label={t('monitoring.overview')} />
        <Tab icon={<DeveloperBoardIcon />} iconPosition="start" label={t('monitoring.hardware')} />
        <Tab icon={<ShieldIcon />} iconPosition="start" label={t('monitoring.security')} />
      </Tabs>

      {/* Overview — live gauges */}
      {tab === 0 && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* CPU */}
          <Card sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6">CPU</Typography>
                <Chip
                  size="small"
                  label={`${info.cpu.usage}%`}
                  color={usageColor(info.cpu.usage)}
                  sx={{ ml: 'auto' }}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={info.cpu.usage}
                color={usageColor(info.cpu.usage)}
                sx={{ height: 10, borderRadius: 1, mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                {info.cpu.model}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {info.cpu.cores} {t('monitoring.cores')} / {info.cpu.threads} {t('monitoring.threads')} @ {info.cpu.frequency}
              </Typography>
              {info.cpu.temperature != null && (
                <Typography variant="body2" color="text.secondary">
                  {t('monitoring.temperature')}: {info.cpu.temperature}°C
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* RAM */}
          <Card sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6">RAM</Typography>
                <Chip
                  size="small"
                  label={`${info.memory.usage}%`}
                  color={usageColor(info.memory.usage)}
                  sx={{ ml: 'auto' }}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={info.memory.usage}
                color={usageColor(info.memory.usage)}
                sx={{ height: 10, borderRadius: 1, mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                {fmtBytes(info.memory.used)} / {fmtBytes(info.memory.total)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('monitoring.free')}: {fmtBytes(info.memory.free)}
              </Typography>
            </CardContent>
          </Card>

          {/* Disk(s) */}
          <Card sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="primary" />
                <Typography variant="h6">{t('monitoring.storage')}</Typography>
              </Box>
              {info.disks.map((d) => (
                <Box key={d.mount} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" fontFamily="monospace">{d.mount}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {fmtBytes(d.used)} / {fmtBytes(d.total)} ({d.fs_type})
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={d.usage}
                    color={usageColor(d.usage)}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Network */}
          <Card sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <NetworkCheckIcon color="primary" />
                <Typography variant="h6">{t('monitoring.network')}</Typography>
              </Box>
              {info.network.map((n) => (
                <Box key={n.interface} sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight={600} fontFamily="monospace" sx={{ mb: 0.5 }}>
                    {n.interface}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary">
                      RX: {fmtBytes(n.rx_bytes)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      TX: {fmtBytes(n.tx_bytes)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip size="small" label={`↓ ${fmtRate(n.rx_rate)}`} color="info" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 12 }} />
                    <Chip size="small" label={`↑ ${fmtRate(n.tx_rate)}`} color="warning" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 12 }} />
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* OS / Uptime */}
          <Card sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ComputerIcon color="primary" />
                <Typography variant="h6">{t('monitoring.os')}</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.hostname')}</TableCell>
                      <TableCell>{info.os.hostname}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.os_name')}</TableCell>
                      <TableCell>{info.os.name} {info.os.version}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.kernel')}</TableCell>
                      <TableCell>{info.os.kernel}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.arch')}</TableCell>
                      <TableCell>{info.os.arch}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.uptime')}</TableCell>
                      <TableCell>
                        <Chip size="small" label={fmtUptime(info.os.uptime)} color="success" />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Hardware tab */}
      {tab === 1 && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* CPU details */}
          <Card sx={{ flex: '1 1 400px', minWidth: 350 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6">CPU</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.model')}</TableCell>
                      <TableCell>{info.cpu.model}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.cores')}</TableCell>
                      <TableCell>{info.cpu.cores}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.threads')}</TableCell>
                      <TableCell>{info.cpu.threads}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.frequency')}</TableCell>
                      <TableCell>{info.cpu.frequency}</TableCell>
                    </TableRow>
                    {info.cpu.temperature != null && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.temperature')}</TableCell>
                        <TableCell>{info.cpu.temperature}°C</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Board */}
          <Card sx={{ flex: '1 1 400px', minWidth: 350 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DeveloperBoardIcon color="primary" />
                <Typography variant="h6">{t('monitoring.board')}</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.manufacturer')}</TableCell>
                      <TableCell>{info.board.manufacturer}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.model')}</TableCell>
                      <TableCell>{info.board.model}</TableCell>
                    </TableRow>
                    {info.board.serial && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.serial')}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{info.board.serial}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* RAM details */}
          <Card sx={{ flex: '1 1 400px', minWidth: 350 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6">RAM</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.total')}</TableCell>
                      <TableCell>{fmtBytes(info.memory.total)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.used')}</TableCell>
                      <TableCell>{fmtBytes(info.memory.used)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.free')}</TableCell>
                      <TableCell>{fmtBytes(info.memory.free)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('monitoring.usage')}</TableCell>
                      <TableCell>{info.memory.usage}%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Storage details */}
          <Card sx={{ flex: '1 1 400px', minWidth: 350 }}>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StorageIcon color="primary" />
                <Typography variant="h6">{t('monitoring.storage')}</Typography>
              </Box>
              {info.disks.map((d) => (
                <Box key={d.mount} sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{d.mount}</Typography>
                    <Chip size="small" label={`${d.usage}%`} color={usageColor(d.usage)} />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={d.usage}
                    color={usageColor(d.usage)}
                    sx={{ height: 8, borderRadius: 1, mb: 0.5 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      {fmtBytes(d.used)} / {fmtBytes(d.total)} ({d.fs_type})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('monitoring.free')}: {fmtBytes(d.free)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Security — auth monitoring */}
      {tab === 2 && (() => {
        const failMap = new Map<string, { count: number; lastTime: string; details: string }>();
        for (const log of securityLogs) {
          if (log.event === 'auth_failure' || log.event === 'brute_force') {
            const entry = failMap.get(log.ip);
            if (entry) {
              entry.count++;
              if (log.timestamp > entry.lastTime) {
                entry.lastTime = log.timestamp;
                entry.details = log.details;
              }
            } else {
              failMap.set(log.ip, { count: 1, lastTime: log.timestamp, details: log.details });
            }
          }
        }
        const sortedIps = [...failMap.entries()]
          .sort((a, b) => b[1].count - a[1].count);
        const isBlocked = (ip: string) => blacklist.some((b) => b.ip === ip || ip.startsWith(b.ip.replace('/24', '').replace('/16', '')));
        const isWhitelisted = (ip: string) => whitelist.some((w) => w.ip === ip);

        // Search filter
        const q = secSearch.toLowerCase();
        const filteredIps = q
          ? sortedIps.filter(([ip, data]) => ip.toLowerCase().includes(q) || data.details.toLowerCase().includes(q))
          : sortedIps;
        const pagedIps = filteredIps.slice(secPage * secRowsPerPage, secPage * secRowsPerPage + secRowsPerPage);

        const quickBlock = async (ip: string) => {
          try {
            await api.post('/security/blacklist', { ip, comment: `Auto-blocked: ${threshold}+ failed attempts` });
            showToast(true);
            refresh();
          } catch { showToast(false); }
        };
        const quickAllow = async (ip: string) => {
          try {
            await api.post('/security/whitelist', { ip, comment: 'Allowed from monitoring' });
            showToast(true);
            refresh();
          } catch { showToast(false); }
        };

        return (
          <Card>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">{t('security.auth_monitoring')}</Typography>
                <TextField
                  size="small"
                  placeholder={t('table.search')}
                  value={secSearch}
                  onChange={(e) => { setSecSearch(e.target.value); setSecPage(0); }}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                  sx={{ width: 260 }}
                />
              </Box>
              {filteredIps.length === 0 ? (
                <Typography color="text.secondary">{t('security.no_failed_auth')}</Typography>
              ) : (
                <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('field.ip_address')}</TableCell>
                        <TableCell>{t('security.failed_attempts')}</TableCell>
                        <TableCell sx={{ width: 100 }}>{t('security.progress')}</TableCell>
                        <TableCell>{t('field.details')}</TableCell>
                        <TableCell>{t('security.last_attempt')}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('field.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedIps.map(([ip, data]) => {
                        const pct = Math.min((data.count / threshold) * 100, 100);
                        const blocked = isBlocked(ip);
                        const allowed = isWhitelisted(ip);
                        return (
                          <TableRow key={ip} sx={blocked ? { opacity: 0.5 } : undefined}>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{ip}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {data.count}/{threshold}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                color={pct >= 100 ? 'error' : pct >= 60 ? 'warning' : 'success'}
                                sx={{ height: 8, borderRadius: 1 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                                {data.details}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                              {formatDateTime(data.lastTime)}
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                              {!blocked && (
                                <Tooltip title={t('security.block_ip')}>
                                  <IconButton size="small" color="error" onClick={() => quickBlock(ip)}>
                                    <BlockIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {!allowed && !blocked && (
                                <Tooltip title={t('security.allow_ip')}>
                                  <IconButton size="small" color="success" onClick={() => quickAllow(ip)}>
                                    <CheckCircleOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {!blocked && (
                                <Tooltip title={t('security.add_acl_user')}>
                                  <IconButton size="small" color="info" onClick={() => {
                                    // Extract username from details like: Invalid credentials for user "asterisk"
                                    const match = data.details.match(/user\s+"?([^"]+)"?/i);
                                    const detectedUser = match ? match[1] : '';
                                    setAclForm({ username: detectedUser, extension: '', caller_id: '' });
                                    setAclDialog({ open: true, ip });
                                  }}>
                                    <PersonAddIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                {filteredIps.length > secRowsPerPage && (
                  <TablePagination
                    component="div"
                    count={filteredIps.length}
                    page={secPage}
                    onPageChange={(_, p) => setSecPage(p)}
                    rowsPerPage={secRowsPerPage}
                    onRowsPerPageChange={(e) => { setSecRowsPerPage(parseInt(e.target.value)); setSecPage(0); }}
                    rowsPerPageOptions={[10, 25, 50]}
                  />
                )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Add ACL User from Monitoring */}
      <FormDialog
        open={aclDialog.open}
        title={t('modal.add_acl_user')}
        dirty={!!(aclForm.username || aclForm.extension)}
        onClose={() => { setAclDialog({ open: false, ip: '' }); setAclForm({ username: '', extension: '', caller_id: '' }); }}
        onSave={async () => {
          try {
            await api.post('/acl-users', { ...aclForm, ip: aclDialog.ip });
            setAclDialog({ open: false, ip: '' });
            setAclForm({ username: '', extension: '', caller_id: '' });
            showToast(true);
          } catch { showToast(false); }
        }}
        saveLabel={t('button.add')}
      >
        <TextField label={t('field.ip_address')} value={aclDialog.ip} disabled />
        <TextField label={t('field.user')} value={aclForm.username}
          onChange={(e) => setAclForm({ ...aclForm, username: e.target.value })} />
        <TextField label={t('field.extension')} value={aclForm.extension}
          onChange={(e) => setAclForm({ ...aclForm, extension: e.target.value })} />
        <TextField label={t('field.caller_id')} value={aclForm.caller_id}
          onChange={(e) => setAclForm({ ...aclForm, caller_id: e.target.value })} />
      </FormDialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
