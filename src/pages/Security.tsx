/**
 * @file Security — Blacklist, whitelist, auto-blacklist, and Fail2Ban settings
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  IconButton, TextField, Switch, FormControlLabel, Chip, Tooltip,
  InputAdornment, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import Toast from '../components/Toast';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { formatDateTime } from '../store/preferences';
import type { BlacklistEntry, WhitelistEntry, SecurityLog } from '../api/types';

/** Protected localhost IP — always present, cannot be deleted */
const PROTECTED_LOCALHOST = '127.0.0.1';

export default function Security() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [externalIp, setExternalIp] = useState('');
  const [autoBlacklist, setAutoBlacklist] = useState({ enabled: false, max_attempts: 10, time_window: 300, block_duration: 3600 });
  const [fail2ban, setFail2ban] = useState({ enabled: false, threshold: 50, jail_name: 'sip-jail' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [editIp, setEditIp] = useState<string | null>(null);
  const defaultIpForm = { ip: '', comment: '' };
  const [form, setForm] = useState(defaultIpForm);
  const [initialForm, setInitialForm] = useState(defaultIpForm);
  const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Auth monitoring state
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [secSearch, setSecSearch] = useState('');
  const [secPage, setSecPage] = useState(0);
  const [secRowsPerPage, setSecRowsPerPage] = useState(10);
  const [aclDialogOpen, setAclDialogOpen] = useState(false);
  const [aclIp, setAclIp] = useState('');
  const [aclForm, setAclForm] = useState({ username: '', extension: '', caller_id: '' });

  // Fail2Ban live status
  const [f2bStatus, setF2bStatus] = useState<{ available: boolean; jail_exists: boolean; banned_ips: string[] }>({ available: false, jail_exists: false, banned_ips: [] });
  const [f2bSearch, setF2bSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [secRes, settingsRes, logRes, f2bRes] = await Promise.all([
        api.get('/security'),
        api.get('/settings'),
        api.get('/logs/security'),
        api.get('/security/fail2ban').catch(() => ({ data: null })),
      ]);
      setBlacklist(secRes.data?.blacklist || []);
      setWhitelist(secRes.data?.whitelist || []);
      setWhitelistEnabled(secRes.data?.whitelist_enabled || false);
      if (secRes.data?.auto_blacklist) setAutoBlacklist(secRes.data.auto_blacklist);
      if (secRes.data?.fail2ban) setFail2ban(secRes.data.fail2ban);
      setExternalIp(String(settingsRes.data?.external_sip_ip || ''));
      setSecurityLogs(logRes.data || []);
      if (f2bRes.data?.status) setF2bStatus(f2bRes.data.status);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 10000);

  const showToast = (success: boolean) => {
    setToast({ open: true, message: success ? t('status.success') : t('status.error'), severity: success ? 'success' : 'error' });
  };

  // ── Add / Edit entry ──

  const doSaveEntry = async () => {
    try {
      if (editIp) {
        await api.put(`/security/whitelist/${encodeURIComponent(editIp)}`, form);
      } else if (dialogType === 'blacklist') {
        await api.post('/security/blacklist', form);
      } else {
        await api.post('/security/whitelist', form);
      }
      setDialogOpen(false);
      showToast(true);
      load();
    } catch { showToast(false); }
  };
  const saveEntry = () => setConfirmSave({ open: true, action: doSaveEntry });

  // ── Blacklist actions ──

  const requestRemoveBlacklist = (ip: string) => {
    setConfirmDelete({
      open: true, name: ip, action: async () => {
        try { await api.delete(`/security/blacklist/${encodeURIComponent(ip)}`); showToast(true); load(); }
        catch { showToast(false); }
      },
    });
  };

  const sendToFail2ban = async (ip: string) => {
    try {
      await api.post('/security/fail2ban/ban', { ip });
      showToast(true);
      load();
    } catch { showToast(false); }
  };

  const sendToFsFirewall = async (ip: string) => {
    try {
      await api.post('/security/fs-firewall/ban', { ip });
      showToast(true);
      load();
    } catch { showToast(false); }
  };

  // ── Whitelist actions ──

  const requestRemoveWhitelist = (ip: string) => {
    setConfirmDelete({
      open: true, name: ip, action: async () => {
        try { await api.delete(`/security/whitelist/${encodeURIComponent(ip)}`); showToast(true); load(); }
        catch { showToast(false); }
      },
    });
  };

  const handleConfirmSave = async () => { const a = confirmSave.action; setConfirmSave({ open: false, action: null }); if (a) await a(); };
  const handleConfirmDelete = async () => { const a = confirmDelete.action; setConfirmDelete({ open: false, name: '', action: null }); if (a) await a(); };

  // Protected IPs — always shown in whitelist, cannot be deleted or edited
  const protectedIps = new Set([PROTECTED_LOCALHOST]);
  if (externalIp) protectedIps.add(externalIp);

  // Build display list: ensure protected entries always appear at top
  const displayWhitelist = (() => {
    const entries = [...whitelist];
    if (!entries.some((e) => e.ip === PROTECTED_LOCALHOST)) {
      entries.unshift({ ip: PROTECTED_LOCALHOST, comment: t('security.local_protected') });
    }
    if (externalIp && !entries.some((e) => e.ip === externalIp)) {
      entries.splice(1, 0, { ip: externalIp, comment: t('security.external_protected') });
    }
    return entries;
  })();

  const toggleWhitelist = async () => {
    try {
      await api.put('/security/whitelist/toggle', { enabled: !whitelistEnabled });
      setWhitelistEnabled(!whitelistEnabled);
    } catch { showToast(false); }
  };

  const doSaveSecuritySettings = async () => {
    try {
      await Promise.all([
        api.put('/security/auto-blacklist', autoBlacklist),
        api.put('/security/fail2ban', fail2ban),
      ]);
      await api.post('/config/apply');
      showToast(true);
    } catch { showToast(false); }
  };
  const saveSecuritySettings = () => setConfirmSave({ open: true, action: doSaveSecuritySettings });

  const openDialog = (type: 'blacklist' | 'whitelist', entry?: WhitelistEntry) => {
    setDialogType(type);
    setEditIp(entry ? entry.ip : null);
    const fresh = entry ? { ip: entry.ip, comment: entry.comment || '' } : { ...defaultIpForm };
    setForm(fresh);
    setInitialForm(fresh);
    setDialogOpen(true);
  };

  const dialogTitle = () => {
    if (editIp) return t('modal.edit_whitelist');
    if (dialogType === 'blacklist') return t('modal.block_ip_address');
    return t('modal.allow_ip_address');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">{t('nav.security')}</Typography>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={saveSecuritySettings}>{t('button.save_reload')}</Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<ShieldIcon />} iconPosition="start" label={t('security.auth_monitoring')} />
        <Tab label={t('security.blacklist')} />
        <Tab label={t('security.whitelist')} />
        <Tab label={t('security.auto_blacklist')} />
        <Tab icon={<LocalFireDepartmentIcon />} iconPosition="start" label="Fail2Ban" />
        <Tab label={t('security.fail2ban')} />
      </Tabs>

      {/* Auth Monitoring */}
      {tab === 0 && (() => {
        const failMap = new Map<string, { count: number; lastTime: string; details: string; user: string; method: string; domain: string; methods: Set<string>; users: Set<string> }>();
        for (const log of securityLogs) {
          if (log.event === 'auth_failure' || log.event === 'brute_force') {
            const entry = failMap.get(log.ip);
            if (entry) {
              entry.count++;
              if (log.timestamp > entry.lastTime) { entry.lastTime = log.timestamp; entry.details = log.details; }
              if (log.user) entry.users.add(log.user);
              if (log.method) entry.methods.add(log.method);
            } else {
              failMap.set(log.ip, {
                count: 1, lastTime: log.timestamp, details: log.details,
                user: log.user || '', method: log.method || '', domain: log.domain || '',
                methods: new Set(log.method ? [log.method] : []),
                users: new Set(log.user ? [log.user] : []),
              });
            }
          }
        }
        const sortedIps = [...failMap.entries()].sort((a, b) => b[1].count - a[1].count);
        const isBlocked = (ip: string) => blacklist.some((b) => b.ip === ip || ip.startsWith(b.ip.replace('/24', '').replace('/16', '')));
        const isAllowed = (ip: string) => whitelist.some((w) => w.ip === ip);
        const q = secSearch.toLowerCase();
        const filteredIps = q ? sortedIps.filter(([ip, data]) => ip.includes(q) || data.details.toLowerCase().includes(q)) : sortedIps;
        const pagedIps = filteredIps.slice(secPage * secRowsPerPage, secPage * secRowsPerPage + secRowsPerPage);

        const quickBlock = async (ip: string) => {
          try { await api.post('/security/blacklist', { ip, comment: 'Blocked from auth monitoring' }); showToast(true); load(); } catch { showToast(false); }
        };
        const quickAllow = async (ip: string) => {
          try { await api.post('/security/whitelist', { ip, comment: 'Allowed from auth monitoring' }); showToast(true); load(); } catch { showToast(false); }
        };

        return (
          <Card>
            <CardContent sx={{ px: 4, py: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">{t('security.auth_monitoring')}</Typography>
                <TextField size="small" placeholder={t('table.search')} value={secSearch}
                  onChange={(e) => { setSecSearch(e.target.value); setSecPage(0); }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                  sx={{ width: 260 }} />
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
                        <TableCell>{t('field.user')}</TableCell>
                        <TableCell>{t('field.type')}</TableCell>
                        <TableCell>{t('field.details')}</TableCell>
                        <TableCell>{t('security.last_attempt')}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('field.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedIps.map(([ip, data]) => {
                        const pct = Math.min((data.count / autoBlacklist.max_attempts) * 100, 100);
                        const blocked = isBlocked(ip);
                        const allowed = isAllowed(ip);
                        return (
                          <TableRow key={ip} sx={(blocked || allowed) ? { opacity: 0.5 } : undefined}>
                            <TableCell sx={{ fontFamily: 'monospace' }}>
                              {ip}
                              {allowed && <Chip size="small" label="Whitelist" color="success" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                              {blocked && <Chip size="small" label="Blocked" color="error" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{data.count}/{autoBlacklist.max_attempts}</Typography>
                            </TableCell>
                            <TableCell>
                              <LinearProgress variant="determinate" value={pct}
                                color={pct >= 100 ? 'error' : pct >= 60 ? 'warning' : 'success'}
                                sx={{ height: 8, borderRadius: 1 }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              {[...data.users].map((u) => (
                                <Chip key={u} size="small" label={u} sx={{ mr: 0.5, mb: 0.5 }} />
                              ))}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              {[...data.methods].map((m) => (
                                <Chip key={m} size="small" label={m} variant="outlined"
                                  color={m === 'INVITE' ? 'error' : 'default'} sx={{ mr: 0.5 }} />
                              ))}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>{data.details}</Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                              {formatDateTime(data.lastTime)}
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                              {blocked && (
                                <Tooltip title={t('security.unblock_ip')}>
                                  <IconButton size="small" color="warning" onClick={async () => {
                                    try { await api.delete(`/security/blacklist/${ip}`); showToast(true); load(); } catch { showToast(false); }
                                  }}><LockOpenIcon fontSize="small" /></IconButton>
                                </Tooltip>
                              )}
                              {!blocked && (
                                <Tooltip title={t('security.block_ip')}>
                                  <IconButton size="small" color="error" onClick={() => quickBlock(ip)}><BlockIcon fontSize="small" /></IconButton>
                                </Tooltip>
                              )}
                              {!allowed && !blocked && (
                                <Tooltip title={t('security.allow_ip')}>
                                  <IconButton size="small" color="success" onClick={() => quickAllow(ip)}><CheckCircleOutlineIcon fontSize="small" /></IconButton>
                                </Tooltip>
                              )}
                              {!blocked && (
                                <Tooltip title={t('security.add_acl_user')}>
                                  <IconButton size="small" color="info" onClick={() => {
                                    const match = data.details.match(/user\s+"?([^"]+)"?/i);
                                    setAclForm({ username: match ? match[1] : '', extension: '', caller_id: '' });
                                    setAclIp(ip);
                                    setAclDialogOpen(true);
                                  }}><PersonAddIcon fontSize="small" /></IconButton>
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
                  <TablePagination component="div" count={filteredIps.length}
                    page={secPage} onPageChange={(_, p) => setSecPage(p)}
                    rowsPerPage={secRowsPerPage}
                    onRowsPerPageChange={(e) => { setSecRowsPerPage(parseInt(e.target.value)); setSecPage(0); }}
                    rowsPerPageOptions={[10, 25, 50]} />
                )}
                </>
              )}

              {/* Fail2Ban summary */}
              {f2bStatus.banned_ips.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Chip icon={<LocalFireDepartmentIcon />} label={`Fail2Ban: ${f2bStatus.banned_ips.length} ${t('security.banned')}`}
                    color="error" variant="outlined" size="small" />
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Blacklist — unified: DB + Fail2Ban + iptables */}
      {tab === 1 && (() => {
        // Merge DB blacklist with Fail2Ban-only IPs
        const dbIps = new Set(blacklist.map((e) => e.ip));
        const f2bOnlyIps = f2bStatus.banned_ips.filter((ip) => !dbIps.has(ip));
        const merged: Array<BlacklistEntry & { f2b_only?: boolean }> = [
          ...blacklist.map((e) => ({ ...e, f2b_only: false })),
          ...f2bOnlyIps.map((ip) => ({
            ip, comment: '', blocked_count: 0,
            fail2ban_banned: true, fs_firewall_blocked: false, f2b_only: true,
          })),
        ];
        // Mark DB entries that are also in Fail2Ban
        const f2bSet = new Set(f2bStatus.banned_ips);
        for (const e of merged) {
          if (!e.f2b_only && f2bSet.has(e.ip)) e.fail2ban_banned = true;
        }
        return (
        <Card>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">
                {t('security.blocked_ips')}
                <Chip size="small" label={merged.length} sx={{ ml: 1 }} />
              </Typography>
              <Button startIcon={<AddIcon />} onClick={() => openDialog('blacklist')}>{t('security.block_ip')}</Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('field.ip_address')}</TableCell>
                    <TableCell>{t('field.comment')}</TableCell>
                    <TableCell>{t('field.source')}</TableCell>
                    <TableCell align="right">{t('field.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {merged.map((e) => (
                    <TableRow key={e.ip}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{e.ip}</TableCell>
                      <TableCell>{e.comment || (e.f2b_only ? 'Fail2Ban auto-ban' : '')}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {!e.f2b_only && <Chip size="small" label="ACL" color="primary" variant="outlined" sx={{ mr: 0.5, height: 20, fontSize: 11 }} />}
                        {e.fail2ban_banned && <Chip size="small" label="Fail2Ban" color="error" variant="outlined" sx={{ mr: 0.5, height: 20, fontSize: 11 }} />}
                        {e.fs_firewall_blocked && <Chip size="small" label="Firewall" color="warning" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {!e.fail2ban_banned && (
                          <Tooltip title={t('security.send_to_fail2ban')}>
                            <IconButton size="small" color="warning" onClick={() => sendToFail2ban(e.ip)}>
                              <LocalFireDepartmentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {e.fail2ban_banned && (
                          <Tooltip title="Fail2Ban Unban">
                            <IconButton size="small" color="warning" onClick={async () => {
                              try { await api.post('/security/fail2ban/unban', { ip: e.ip }); showToast(true); load(); } catch { showToast(false); }
                            }}><LockOpenIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        )}
                        {!e.f2b_only && !e.fs_firewall_blocked && (
                          <Tooltip title={t('security.send_to_fs_firewall')}>
                            <IconButton size="small" color="info" onClick={() => sendToFsFirewall(e.ip)}>
                              <ShieldIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!e.f2b_only && (
                          <IconButton size="small" color="error" onClick={() => requestRemoveBlacklist(e.ip)}><DeleteIcon fontSize="small" /></IconButton>
                        )}
                        {e.f2b_only && (
                          <Tooltip title={t('security.block_ip')}>
                            <IconButton size="small" color="primary" onClick={async () => {
                              try { await api.post('/security/blacklist', { ip: e.ip, comment: 'Added from Fail2Ban' }); showToast(true); load(); } catch { showToast(false); }
                            }}>
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
        );
      })()}

      {/* Whitelist */}
      {tab === 2 && (
        <Card>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="h6">{t('security.allowed_ips')}</Typography>
                <FormControlLabel
                  control={<Switch checked={whitelistEnabled} onChange={toggleWhitelist} />}
                  label={t('security.enable_whitelist')}
                />
              </Box>
              <Button startIcon={<AddIcon />} onClick={() => openDialog('whitelist')}>{t('security.allow_ip')}</Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('field.ip_address')}</TableCell>
                    <TableCell>{t('field.comment')}</TableCell>
                    <TableCell align="right">{t('field.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayWhitelist.map((e) => {
                    const isProtected = protectedIps.has(e.ip);
                    return (
                      <TableRow key={e.ip} sx={isProtected ? { bgcolor: 'action.hover' } : undefined}>
                        <TableCell>
                          {isProtected && <LockIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle', color: 'text.secondary' }} />}
                          {e.ip}
                        </TableCell>
                        <TableCell>{e.comment}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {!isProtected && (
                            <>
                              <Tooltip title={t('button.edit')}>
                                <IconButton size="small" color="primary" onClick={() => openDialog('whitelist', e)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <IconButton size="small" color="error" onClick={() => requestRemoveWhitelist(e.ip)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Auto-Blacklist */}
      {tab === 3 && (
        <Card>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>{t('security.auto_blacklist_title')}</Typography>
            <FormControlLabel
              control={<Switch checked={autoBlacklist.enabled} onChange={(e) => setAutoBlacklist({ ...autoBlacklist, enabled: e.target.checked })} />}
              label={t('security.enable_auto_blacklist')}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('security.auto_blacklist_desc')}</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
              <TextField type="number" label={t('security.max_attempts')} value={autoBlacklist.max_attempts}
                onChange={(e) => setAutoBlacklist({ ...autoBlacklist, max_attempts: parseInt(e.target.value) || 10 })}
                helperText={t('security.block_after_n')} sx={{ width: 200 }} />
              <TextField type="number" label={t('security.time_window')} value={autoBlacklist.time_window}
                onChange={(e) => setAutoBlacklist({ ...autoBlacklist, time_window: parseInt(e.target.value) || 300 })}
                helperText={t('security.count_in_time')} sx={{ width: 200 }} />
              <TextField type="number" label={t('security.block_duration')} value={autoBlacklist.block_duration}
                onChange={(e) => setAutoBlacklist({ ...autoBlacklist, block_duration: parseInt(e.target.value) || 0 })}
                helperText={t('security.permanent')} sx={{ width: 200 }} />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Fail2Ban */}
      {tab === 4 && (
        <Card>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6">Fail2Ban</Typography>
              <Chip size="small"
                label={f2bStatus.available ? (f2bStatus.jail_exists ? t('field.active') : 'No Jail') : t('field.inactive')}
                color={f2bStatus.available && f2bStatus.jail_exists ? 'success' : 'default'} />
              {f2bStatus.banned_ips.length > 0 && (
                <Chip size="small" label={`${f2bStatus.banned_ips.length} ${t('security.banned')}`} color="error" variant="outlined" />
              )}
            </Box>
            <FormControlLabel
              control={<Switch checked={fail2ban.enabled} onChange={(e) => setFail2ban({ ...fail2ban, enabled: e.target.checked })} />}
              label={t('security.enable_fail2ban')}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('security.fail2ban_desc')}</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField type="number" label={t('security.threshold')} value={fail2ban.threshold}
                onChange={(e) => setFail2ban({ ...fail2ban, threshold: parseInt(e.target.value) || 50 })}
                helperText={t('security.add_after_n')} sx={{ width: 200 }} />
              <TextField label={t('security.jail_name')} value={fail2ban.jail_name}
                onChange={(e) => setFail2ban({ ...fail2ban, jail_name: e.target.value })}
                helperText={t('security.jail_for_sip')} sx={{ width: 250 }} />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit IP Dialog */}
      <FormDialog
        open={dialogOpen}
        title={dialogTitle()}
        dirty={formDirty}
        onClose={() => setDialogOpen(false)}
        onSave={saveEntry}
        saveLabel={editIp ? t('button.save') : (dialogType === 'blacklist' ? t('button.block') : t('button.allow'))}
      >
        <TextField label={t('security.ip_or_cidr')} value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })}
          disabled={!!editIp}
          helperText={editIp ? undefined : t('modal.multiple_ips_hint')} />
        <TextField label={t('security.comment_optional')} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
      </FormDialog>

      <ConfirmDialog open={confirmSave.open} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmSave} onCancel={() => setConfirmSave({ open: false, action: null })} />

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete({ open: false, name: '', action: null })} />

      {/* Add ACL User from Auth Monitoring */}
      <FormDialog
        open={aclDialogOpen}
        title={t('modal.add_acl_user')}
        dirty={!!(aclForm.username || aclForm.extension)}
        onClose={() => { setAclDialogOpen(false); setAclIp(''); setAclForm({ username: '', extension: '', caller_id: '' }); }}
        onSave={async () => {
          try {
            await api.post('/acl-users', { ...aclForm, ip: aclIp });
            setAclDialogOpen(false); setAclIp(''); setAclForm({ username: '', extension: '', caller_id: '' });
            showToast(true);
          } catch { showToast(false); }
        }}
        saveLabel={t('button.add')}
      >
        <TextField label={t('field.ip_address')} value={aclIp} disabled />
        <TextField label={t('field.user')} value={aclForm.username}
          onChange={(e) => setAclForm({ ...aclForm, username: e.target.value })} />
        <TextField label={t('field.extension')} value={aclForm.extension}
          onChange={(e) => setAclForm({ ...aclForm, extension: e.target.value })} />
        <TextField label={t('field.caller_id')} value={aclForm.caller_id}
          onChange={(e) => setAclForm({ ...aclForm, caller_id: e.target.value })} />
      </FormDialog>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
