/**
 * @file CallWidgets — Manage embeddable call widgets for customer websites.
 * Each widget connects visitors directly via WebRTC to a TalkHub extension/assistant.
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Switch, FormControlLabel, MenuItem, Select, InputLabel, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CodeIcon from '@mui/icons-material/Code';
import PhoneIcon from '@mui/icons-material/Phone';
import api from '../api/client';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

interface CallWidget {
  id: number;
  name: string;
  target: string;
  target_type: 'extension' | 'number' | 'assistant';
  color: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  button_text: string;
  enabled: boolean;
  widget_key: string;
  created_at: string;
}

const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;
const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#9c27b0', '#0288d1', '#333333'] as const;

const defaultForm = {
  name: '',
  target: '',
  target_type: 'extension' as const,
  color: '#1976d2',
  position: 'bottom-right' as const,
  button_text: 'Anrufen',
  enabled: true,
};

export default function CallWidgets() {
  const { t } = useTranslation();
  const [widgets, setWidgets] = useState<CallWidget[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [codeDialog, setCodeDialog] = useState<CallWidget | null>(null);
  const [codeTab, setCodeTab] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number; name: string }>({ open: false, id: 0, name: '' });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const load = useCallback(async () => {
    try {
      const res = await api.get('/call-widgets');
      setWidgets(res.data || []);
    } catch { /* no endpoint yet */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (ok: boolean) => setToast({ open: true, message: ok ? t('status.saved') : t('status.error'), severity: ok ? 'success' : 'error' });

  const openCreate = () => {
    setForm(defaultForm);
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (w: CallWidget) => {
    setForm({
      name: w.name,
      target: w.target,
      target_type: w.target_type as typeof defaultForm.target_type,
      color: w.color,
      position: w.position as typeof defaultForm.position,
      button_text: w.button_text,
      enabled: w.enabled,
    });
    setEditId(w.id);
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      if (editId) {
        await api.put(`/call-widgets/${editId}`, form);
      } else {
        await api.post('/call-widgets', form);
      }
      showToast(true);
      setDialogOpen(false);
      load();
    } catch { showToast(false); }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/call-widgets/${id}`);
      showToast(true);
      load();
    } catch { showToast(false); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setToast({ open: true, message: t('status.copied'), severity: 'success' });
  };

  const getSnippet = (w: CallWidget) =>
    `<script src="https://widget.linkify.cloud/call.js" data-key="${w.widget_key}" data-target="${w.target}" data-color="${w.color}" data-position="${w.position}" data-text="${w.button_text}"></script>`;

  const getSnippetReact = (w: CallWidget) =>
    `import { LinkifyCallWidget } from '@linkify/call-widget';

<LinkifyCallWidget
  widgetKey="${w.widget_key}"
  target="${w.target}"
  color="${w.color}"
  position="${w.position}"
  buttonText="${w.button_text}"
/>`;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">CallWidgets</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('button.create')}
        </Button>
      </Box>

      {widgets.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <PhoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="h6" color="text.secondary">
              {t('callwidget.empty_title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('callwidget.empty_desc')}
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate}>
              {t('callwidget.create_first')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('field.name')}</TableCell>
                <TableCell>{t('field.target')}</TableCell>
                <TableCell>{t('field.type')}</TableCell>
                <TableCell>{t('field.status')}</TableCell>
                <TableCell>Farbe</TableCell>
                <TableCell>Position</TableCell>
                <TableCell align="right">{t('field.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {widgets.map((w) => (
                <TableRow key={w.id} sx={!w.enabled ? { opacity: 0.5 } : undefined}>
                  <TableCell sx={{ fontWeight: 500 }}>{w.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{w.target}</TableCell>
                  <TableCell>
                    <Chip size="small" label={w.target_type} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small"
                      label={w.enabled ? t('field.active') : t('field.inactive')}
                      color={w.enabled ? 'success' : 'default'} sx={{ height: 22, fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: w.color, border: '1px solid', borderColor: 'divider' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{w.position}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Code">
                      <IconButton size="small" color="primary" onClick={() => { setCodeDialog(w); setCodeTab(0); }}>
                        <CodeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('button.edit')}>
                      <IconButton size="small" color="primary" onClick={() => openEdit(w)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete({ open: true, id: w.id, name: w.name })}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? t('button.edit') : t('button.create')} CallWidget</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label={t('field.name')} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Kontakt-Button Hauptseite" fullWidth />
          <FormControl fullWidth>
            <InputLabel>{t('field.type')}</InputLabel>
            <Select value={form.target_type} label={t('field.type')}
              onChange={(e) => setForm({ ...form, target_type: e.target.value as typeof form.target_type })}>
              <MenuItem value="extension">Nebenstelle</MenuItem>
              <MenuItem value="number">Rufnummer</MenuItem>
              <MenuItem value="assistant">VAPI Assistant</MenuItem>
            </Select>
          </FormControl>
          <TextField label={t('field.target')} value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            placeholder={form.target_type === 'extension' ? '9001' : form.target_type === 'number' ? '+4923513682009' : 'Assistant-ID'}
            fullWidth />
          <TextField label="Button-Text" value={form.button_text}
            onChange={(e) => setForm({ ...form, button_text: e.target.value })} fullWidth />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ flex: 1 }}>
              <InputLabel>Position</InputLabel>
              <Select value={form.position} label="Position"
                onChange={(e) => setForm({ ...form, position: e.target.value as typeof form.position })}>
                {POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">Farbe</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                {COLORS.map((c) => (
                  <Box key={c} onClick={() => setForm({ ...form, color: c })}
                    sx={{
                      width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid' : '1px solid',
                      borderColor: form.color === c ? 'primary.main' : 'divider',
                    }} />
                ))}
              </Box>
            </Box>
          </Box>
          <FormControlLabel
            control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />}
            label={t('field.active')} />

          {/* Live Preview — simulates real website */}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, position: 'relative', minHeight: 200, bgcolor: '#f5f5f5', overflow: 'hidden' }}>
            <Box sx={{ bgcolor: '#e0e0e0', px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff5f57' }} />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#febc2e' }} />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#28c840' }} />
              <Typography variant="caption" sx={{ ml: 1, color: '#888', fontFamily: 'monospace', fontSize: 10 }}>www.ihre-website.de</Typography>
            </Box>
            <Box sx={{ p: 2, position: 'relative', minHeight: 160 }}>
              <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.4 }}>Website-Inhalt...</Typography>
              <Box
                onClick={() => setToast({ open: true, message: 'Widget-Preview: Anruf würde starten', severity: 'success' })}
                sx={{
                  position: 'absolute',
                  [form.position.includes('bottom') ? 'bottom' : 'top']: 16,
                  [form.position.includes('right') ? 'right' : 'left']: 16,
                  bgcolor: form.color, color: '#fff', borderRadius: 28,
                  px: 2.5, py: 1.5, fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)', cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.05)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)' },
                }}>
                <PhoneIcon sx={{ fontSize: 18 }} />
                {form.button_text || 'Anrufen'}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('button.cancel')}</Button>
          <Button variant="contained" onClick={save} disabled={!form.name || !form.target}>{t('button.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Code Snippet Dialog */}
      <Dialog open={!!codeDialog} onClose={() => setCodeDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon />
            Widget-Code: {codeDialog?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs value={codeTab} onChange={(_, v) => setCodeTab(v)} sx={{ mb: 2 }}>
            <Tab label="HTML" />
            <Tab label="React" />
          </Tabs>
          {codeDialog && (
            <Box sx={{ position: 'relative' }}>
              <Box sx={{
                bgcolor: 'grey.900', color: 'grey.100', p: 2, borderRadius: 1,
                fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {codeTab === 0 ? getSnippet(codeDialog) : getSnippetReact(codeDialog)}
              </Box>
              <Tooltip title={t('status.copied')}>
                <IconButton
                  sx={{ position: 'absolute', top: 8, right: 8, color: 'grey.400' }}
                  onClick={() => copyCode(codeTab === 0 ? getSnippet(codeDialog) : getSnippetReact(codeDialog))}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t('callwidget.code_hint')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCodeDialog(null)}>{t('button.close')}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={() => { remove(confirmDelete.id); setConfirmDelete({ open: false, id: 0, name: '' }); }}
        onCancel={() => setConfirmDelete({ open: false, id: 0, name: '' })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity}
        onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
