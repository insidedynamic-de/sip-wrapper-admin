/**
 * @file Security — Blacklist, whitelist, auto-blacklist, and Fail2Ban settings
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, TextField, Switch, FormControlLabel, Chip, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import Toast from '../components/Toast';
import type { BlacklistEntry, WhitelistEntry } from '../api/types';

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

  const load = useCallback(async () => {
    try {
      const [secRes, settingsRes] = await Promise.all([
        api.get('/security'),
        api.get('/settings'),
      ]);
      setBlacklist(secRes.data?.blacklist || []);
      setWhitelist(secRes.data?.whitelist || []);
      setWhitelistEnabled(secRes.data?.whitelist_enabled || false);
      if (secRes.data?.auto_blacklist) setAutoBlacklist(secRes.data.auto_blacklist);
      if (secRes.data?.fail2ban) setFail2ban(secRes.data.fail2ban);
      setExternalIp(String(settingsRes.data?.external_sip_ip || ''));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

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
        <Tab label={t('security.blacklist')} />
        <Tab label={t('security.whitelist')} />
        <Tab label={t('security.auto_blacklist')} />
        <Tab label={t('security.fail2ban')} />
      </Tabs>

      {/* Blacklist */}
      {tab === 0 && (
        <Card>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{t('security.blocked_ips')}</Typography>
              <Button startIcon={<AddIcon />} onClick={() => openDialog('blacklist')}>{t('security.block_ip')}</Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('field.ip_address')}</TableCell>
                    <TableCell>{t('field.comment')}</TableCell>
                    <TableCell>{t('security.blocked')}</TableCell>
                    <TableCell>{t('security.fail2ban')}</TableCell>
                    <TableCell>{t('security.fs_firewall')}</TableCell>
                    <TableCell align="right">{t('field.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {blacklist.map((e) => (
                    <TableRow key={e.ip}>
                      <TableCell>{e.ip}</TableCell>
                      <TableCell>{e.comment}</TableCell>
                      <TableCell>{e.blocked_count || 0}</TableCell>
                      <TableCell>
                        {e.fail2ban_banned && <Chip size="small" label={t('security.banned')} color="error" />}
                      </TableCell>
                      <TableCell>
                        {e.fs_firewall_blocked && <Chip size="small" label={t('security.blocked')} color="warning" />}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {!e.fail2ban_banned && (
                          <Tooltip title={t('security.send_to_fail2ban')}>
                            <IconButton size="small" color="warning" onClick={() => sendToFail2ban(e.ip)}>
                              <LocalFireDepartmentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!e.fs_firewall_blocked && (
                          <Tooltip title={t('security.send_to_fs_firewall')}>
                            <IconButton size="small" color="info" onClick={() => sendToFsFirewall(e.ip)}>
                              <ShieldIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton size="small" color="error" onClick={() => requestRemoveBlacklist(e.ip)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Whitelist */}
      {tab === 1 && (
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
      {tab === 2 && (
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
      {tab === 3 && (
        <Card>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>{t('security.fail2ban_integration')}</Typography>
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

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
