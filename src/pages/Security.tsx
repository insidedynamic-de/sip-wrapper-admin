import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, TextField, Switch, FormControlLabel, Snackbar, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import type { BlacklistEntry, WhitelistEntry } from '../api/types';

export default function Security() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [confirmSave, setConfirmSave] = useState<{ open: boolean; action: (() => Promise<void>) | null }>({ open: false, action: null });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [autoBlacklist, setAutoBlacklist] = useState({ enabled: true, threshold: 5, time_window: 300, block_duration: 3600 });
  const [fail2ban, setFail2ban] = useState({ enabled: false, threshold: 50, jail_name: 'freeswitch-sip' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'blacklist' | 'whitelist'>('blacklist');
  const defaultIpForm = { ip: '', comment: '' };
  const [form, setForm] = useState(defaultIpForm);
  const [initialForm, setInitialForm] = useState(defaultIpForm);
  const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = useCallback(async () => {
    try {
      const res = await api.get('/security');
      setBlacklist(res.data?.blacklist || []);
      setWhitelist(res.data?.whitelist?.entries || []);
      setWhitelistEnabled(res.data?.whitelist?.enabled || false);
      if (res.data?.auto_blacklist) setAutoBlacklist(res.data.auto_blacklist);
      if (res.data?.fail2ban) setFail2ban(res.data.fail2ban);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (success: boolean) => {
    setToast({ open: true, message: success ? t('status.success') : t('status.error'), severity: success ? 'success' : 'error' });
  };

  const doAddEntry = async () => {
    try {
      if (dialogType === 'blacklist') await api.post('/security/blacklist', form);
      else await api.post('/security/whitelist', form);
      setDialogOpen(false);
      showToast(true);
      load();
    } catch { showToast(false); }
  };
  const addEntry = () => setConfirmSave({ open: true, action: doAddEntry });

  const requestRemoveBlacklist = (ip: string) => {
    setConfirmDelete({ open: true, name: ip, action: async () => { await api.delete(`/security/blacklist/${encodeURIComponent(ip)}`); load(); } });
  };

  const requestRemoveWhitelist = (ip: string) => {
    setConfirmDelete({ open: true, name: ip, action: async () => { await api.delete(`/security/whitelist/${encodeURIComponent(ip)}`); load(); } });
  };

  const handleConfirmSave = async () => { const a = confirmSave.action; setConfirmSave({ open: false, action: null }); if (a) await a(); };
  const handleConfirmDelete = async () => { const a = confirmDelete.action; setConfirmDelete({ open: false, name: '', action: null }); if (a) await a(); };

  const toggleWhitelist = async () => {
    await api.put('/security/whitelist/toggle', { enabled: !whitelistEnabled });
    setWhitelistEnabled(!whitelistEnabled);
  };

  const doSaveAutoBlacklist = async () => {
    try { await api.put('/security/auto-blacklist', autoBlacklist); showToast(true); } catch { showToast(false); }
  };
  const saveAutoBlacklist = () => setConfirmSave({ open: true, action: doSaveAutoBlacklist });

  const doSaveFail2ban = async () => {
    try { await api.put('/security/fail2ban', fail2ban); showToast(true); } catch { showToast(false); }
  };
  const saveFail2ban = () => setConfirmSave({ open: true, action: doSaveFail2ban });

  const openDialog = (type: 'blacklist' | 'whitelist') => {
    setDialogType(type);
    const fresh = { ...defaultIpForm };
    setForm(fresh);
    setInitialForm(fresh);
    setDialogOpen(true);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('nav.security')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('security.blacklist')} />
        <Tab label={t('security.whitelist')} />
        <Tab label={t('security.auto_blacklist')} />
        <Tab label={t('security.fail2ban')} />
      </Tabs>

      {/* Blacklist */}
      {tab === 0 && (
        <Card>
          <CardContent>
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
                        {e.fail2ban_banned && <Chip size="small" label="Banned" color="error" />}
                      </TableCell>
                      <TableCell align="right">
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
          <CardContent>
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
                  {whitelist.map((e) => (
                    <TableRow key={e.ip}>
                      <TableCell>{e.ip}</TableCell>
                      <TableCell>{e.comment}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => requestRemoveWhitelist(e.ip)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Auto-Blacklist */}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t('security.auto_blacklist_title')}</Typography>
            <FormControlLabel
              control={<Switch checked={autoBlacklist.enabled} onChange={(e) => setAutoBlacklist({ ...autoBlacklist, enabled: e.target.checked })} />}
              label={t('security.enable_auto_blacklist')}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('security.auto_blacklist_desc')}</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <TextField type="number" label={t('security.max_attempts')} value={autoBlacklist.threshold}
                onChange={(e) => setAutoBlacklist({ ...autoBlacklist, threshold: parseInt(e.target.value) || 5 })}
                helperText={t('security.block_after_n')} sx={{ width: 200 }} />
              <TextField type="number" label={t('security.time_window')} value={autoBlacklist.time_window}
                onChange={(e) => setAutoBlacklist({ ...autoBlacklist, time_window: parseInt(e.target.value) || 300 })}
                helperText={t('security.count_in_time')} sx={{ width: 200 }} />
              <TextField type="number" label={t('security.block_duration')} value={autoBlacklist.block_duration}
                onChange={(e) => setAutoBlacklist({ ...autoBlacklist, block_duration: parseInt(e.target.value) || 0 })}
                helperText={t('security.permanent')} sx={{ width: 200 }} />
            </Box>
            <Button variant="contained" onClick={saveAutoBlacklist}>{t('security.save_auto_blacklist')}</Button>
          </CardContent>
        </Card>
      )}

      {/* Fail2Ban */}
      {tab === 3 && (
        <Card>
          <CardContent>
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
            <Button variant="contained" onClick={saveFail2ban}>{t('security.save_fail2ban')}</Button>
          </CardContent>
        </Card>
      )}

      {/* Add IP Dialog */}
      <FormDialog
        open={dialogOpen}
        title={dialogType === 'blacklist' ? t('modal.block_ip_address') : t('modal.allow_ip_address')}
        dirty={formDirty}
        onClose={() => setDialogOpen(false)}
        onSave={addEntry}
        saveLabel={dialogType === 'blacklist' ? t('button.block') : t('button.allow')}
      >
        <TextField label={t('security.ip_or_cidr')} value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })}
          helperText={t('modal.multiple_ips_hint')} />
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

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
