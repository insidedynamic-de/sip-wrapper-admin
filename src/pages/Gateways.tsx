import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Snackbar, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api/client';
import type { Gateway } from '../api/types';

const TRANSPORT_OPTIONS = ['udp', 'tcp', 'tls'];
const TYPE_OPTIONS = ['provider', 'pbx', 'ai_platform', 'other'];

export default function Gateways() {
  const { t } = useTranslation();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGw, setEditGw] = useState<Gateway | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'provider', host: '', port: 5060, username: '', password: '',
    register: true, transport: 'udp', auth_username: '',
  });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = useCallback(async () => {
    const res = await api.get('/gateways');
    setGateways(res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditGw(null);
    setForm({ name: '', type: 'provider', host: '', port: 5060, username: '', password: '', register: true, transport: 'udp', auth_username: '' });
    setDialogOpen(true);
  };

  const openEdit = (gw: Gateway) => {
    setEditGw(gw);
    setForm({ ...gw, auth_username: gw.auth_username || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editGw) {
        await api.put(`/gateways/${editGw.name}`, form);
      } else {
        await api.post('/gateways', form);
      }
      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.delete(`/gateways/${name}`);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const f = (key: string, val: string | number | boolean) => setForm({ ...form, [key]: val });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('gateway.sip_gateways')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{t('gateway.add_gateway')}</Button>
      </Box>

      <Card>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('field.name')}</TableCell>
                  <TableCell>{t('field.type')}</TableCell>
                  <TableCell>{t('field.host')}</TableCell>
                  <TableCell>{t('field.transport')}</TableCell>
                  <TableCell>{t('field.register')}</TableCell>
                  <TableCell align="right">{t('field.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gateways.map((gw) => (
                  <TableRow key={gw.name}>
                    <TableCell>{gw.name}</TableCell>
                    <TableCell><Chip size="small" label={gw.type} /></TableCell>
                    <TableCell>{gw.host}:{gw.port}</TableCell>
                    <TableCell>{gw.transport}</TableCell>
                    <TableCell>{gw.register ? 'Yes' : 'No'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(gw)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(gw.name)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editGw ? t('modal.edit_gateway') : t('modal.add_gateway')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label={t('field.name')} value={form.name} onChange={(e) => f('name', e.target.value)} disabled={!!editGw} />
          <TextField select label={t('field.type')} value={form.type} onChange={(e) => f('type', e.target.value)}>
            {TYPE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
          <TextField label={t('field.host')} value={form.host} onChange={(e) => f('host', e.target.value)} />
          <TextField label={t('field.port')} type="number" value={form.port} onChange={(e) => f('port', parseInt(e.target.value) || 5060)} />
          <TextField label={t('auth.username')} value={form.username} onChange={(e) => f('username', e.target.value)} />
          <TextField label={t('auth.password')} type="password" value={form.password} onChange={(e) => f('password', e.target.value)} />
          <TextField label={t('gateway.auth_username')} value={form.auth_username} onChange={(e) => f('auth_username', e.target.value)} helperText={t('gateway.auth_username_hint')} />
          <TextField select label={t('field.transport')} value={form.transport} onChange={(e) => f('transport', e.target.value)}>
            {TRANSPORT_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={handleSave}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
