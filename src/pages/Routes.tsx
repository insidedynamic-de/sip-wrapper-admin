import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Snackbar, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/client';
import type { Route, Gateway } from '../api/types';

export default function RoutesPage() {
  const { t } = useTranslation();
  const [routes, setRoutes] = useState<Route | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [defaults, setDefaults] = useState({ gateway: '', extension: '1000', caller_id: '' });
  const [dialog, setDialog] = useState<{ type: string; open: boolean }>({ type: '', open: false });
  const [form, setForm] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = useCallback(async () => {
    const [r, g] = await Promise.all([api.get('/routes'), api.get('/gateways')]);
    setRoutes(r.data);
    setGateways(g.data || []);
    if (r.data?.defaults) setDefaults(r.data.defaults);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveDefaults = async () => {
    try {
      await api.put('/routes/defaults', defaults);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const addRoute = async () => {
    try {
      if (dialog.type === 'inbound') {
        await api.post('/routes/inbound', { gateway: form.gateway, extension: form.extension });
      } else if (dialog.type === 'outbound') {
        await api.post('/routes/outbound', { pattern: form.pattern, gateway: form.gateway, prepend: form.prepend, strip: parseInt(form.strip) || 0 });
      } else if (dialog.type === 'user') {
        await api.post('/routes/user', { username: form.username, gateway: form.gateway });
      }
      setDialog({ type: '', open: false });
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const deleteInbound = async (gateway: string) => {
    await api.delete(`/routes/inbound/${gateway}`);
    load();
  };

  const deleteUser = async (username: string) => {
    await api.delete(`/routes/user/${username}`);
    load();
  };

  const gwNames = gateways.map((g) => g.name);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('section.routes')}</Typography>

      {/* Defaults */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('section.default_routes')}</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField select fullWidth label={t('config.default_gateway')} value={defaults.gateway}
                onChange={(e) => setDefaults({ ...defaults, gateway: e.target.value })}
                helperText={t('config.outbound_calls_via')}>
                <MenuItem value="">-- None --</MenuItem>
                {gwNames.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label={t('config.default_extension')} value={defaults.extension}
                onChange={(e) => setDefaults({ ...defaults, extension: e.target.value })}
                helperText={t('config.inbound_default')} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label={t('field.caller_id')} value={defaults.caller_id}
                onChange={(e) => setDefaults({ ...defaults, caller_id: e.target.value })}
                helperText={t('config.caller_id_desc')} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={saveDefaults}>{t('button.save_defaults')}</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inbound Routes */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">{t('section.inbound_routing')}</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setForm({}); setDialog({ type: 'inbound', open: true }); }}>
              {t('route.add_inbound')}
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('field.gateway')}</TableCell>
                  <TableCell>{t('field.extension')}</TableCell>
                  <TableCell align="right">{t('field.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(routes?.inbound || []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.gateway}</TableCell>
                    <TableCell>{r.extension}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => deleteInbound(r.gateway)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Outbound Routes */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">{t('section.outbound_routing')}</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setForm({}); setDialog({ type: 'outbound', open: true }); }}>
              {t('route.add_route')}
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('field.pattern')}</TableCell>
                  <TableCell>{t('field.gateway')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(routes?.outbound || []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.pattern}</TableCell>
                    <TableCell>{r.gateway}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* User Routes */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">{t('section.user_routing')}</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setForm({}); setDialog({ type: 'user', open: true }); }}>
              {t('route.add_user_route')}
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('field.user')}</TableCell>
                  <TableCell>{t('field.gateway')}</TableCell>
                  <TableCell align="right">{t('field.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(routes?.user_routes || []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.username}</TableCell>
                    <TableCell>{r.gateway}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => deleteUser(r.username)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Route Dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ ...dialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>{t('route.add_route')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {dialog.type === 'inbound' && (
            <>
              <TextField select label={t('field.gateway')} value={form.gateway || ''} onChange={(e) => setForm({ ...form, gateway: e.target.value })}>
                {gwNames.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
              <TextField label={t('field.extension')} value={form.extension || ''} onChange={(e) => setForm({ ...form, extension: e.target.value })} />
            </>
          )}
          {dialog.type === 'outbound' && (
            <>
              <TextField label={t('field.pattern')} value={form.pattern || ''} onChange={(e) => setForm({ ...form, pattern: e.target.value })} />
              <TextField select label={t('field.gateway')} value={form.gateway || ''} onChange={(e) => setForm({ ...form, gateway: e.target.value })}>
                {gwNames.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
            </>
          )}
          {dialog.type === 'user' && (
            <>
              <TextField label={t('field.user')} value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <TextField select label={t('field.gateway')} value={form.gateway || ''} onChange={(e) => setForm({ ...form, gateway: e.target.value })}>
                {gwNames.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ ...dialog, open: false })}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={addRoute}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
