/**
 * @file Gateways — SIP gateway/provider management with CRUD
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Chip,
  TextField, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';
import CrudTable from '../components/CrudTable';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import type { Gateway, GatewayStatus, PhoneNumberEntry } from '../api/types';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import RouterIcon from '@mui/icons-material/Router';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  IconButton, Divider, ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stepper, Step, StepLabel, Card, CardContent, CardActionArea,
} from '@mui/material';

const TRANSPORT_OPTIONS = ['udp', 'tcp', 'tls'];
const GW_TYPES = [
  { value: 'provider', label: 'SIP Provider', icon: PhoneIcon, desc: 'Placetel, Easybell, Sipgate...' },
  { value: 'pbx', label: 'PBX', icon: RouterIcon, desc: '3CX, Fritzbox, Asterisk...' },
  { value: 'ai', label: 'AI Platform', icon: SmartToyIcon, desc: 'VAPI, Retell, Bland AI...' },
];
const WIZARD_STEPS_SIP = ['Typ', 'Verbindung', 'Rufnummern', 'Zusammenfassung'];
const WIZARD_STEPS_AI = ['Typ', 'Verbindung', 'Rufnummern', 'AI Verbindung', 'Zusammenfassung'];

function gwChipColor(state: string): 'success' | 'error' | 'warning' {
  if (state === 'REGED' || state === 'online') return 'success';
  if (state === 'FAIL' || state === 'NOREG' || state === 'offline') return 'error';
  return 'warning';
}

export default function Gateways() {
  const { t } = useTranslation();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gwStatuses, setGwStatuses] = useState<GatewayStatus[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editGw, setEditGw] = useState<Gateway | null>(null);
  const defaultForm = { name: '', description: '', type: 'provider', host: '', port: 5060, username: '', password: '', register: true, transport: 'udp', auth_username: '', enabled: true, phone_number: '', phone_numbers: [] as PhoneNumberEntry[], ai_provider: '', ai_account_id: null as number | null };
  const [aiAccounts, setAiAccounts] = useState<Array<{ id: number; name: string; connected: boolean }>>([]);
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const [wizardStep, setWizardStep] = useState(0);
  const [aiAssistants, setAiAssistants] = useState<Array<{ id: string; name: string }>>([]);
  const [aiSetup, setAiSetup] = useState({ assistant_id: '', extension: '', newExtNumber: '' });
  const [aiExtensions, setAiExtensions] = useState<Array<{ extension: string; description: string }>>([]);

  const load = useCallback(async () => {
    try {
      const [gwRes, statusRes, aiRes, extRes] = await Promise.all([
        api.get('/gateways'),
        api.get('/gateways/status'),
        api.get('/integrations/vapi/accounts').catch(() => ({ data: [] })),
        api.get('/extensions').catch(() => ({ data: [] })),
      ]);
      setGateways(gwRes.data || []);
      setGwStatuses(statusRes.data || []);
      setAiAccounts(aiRes.data || []);
      setAiExtensions((extRes as any).data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const openAdd = () => {
    setEditGw(null);
    setViewMode(false);
    setWizardStep(0);
    const fresh = { ...defaultForm };
    setForm(fresh);
    setInitialForm(fresh);
    setDialogOpen(true);
  };

  const toForm = (gw: Gateway) => ({
    ...gw, description: gw.description || '', auth_username: gw.auth_username || '',
    enabled: gw.enabled !== false, phone_number: gw.phone_number || '',
    phone_numbers: gw.phone_numbers || [],
    ai_provider: (gw as any).ai_provider || '', ai_account_id: (gw as any).ai_account_id || null,
  });

  const openView = (gw: Gateway) => {
    setEditGw(gw);
    setViewMode(true);
    const gwForm = toForm(gw);
    setForm(gwForm);
    setInitialForm(gwForm);
    setDialogOpen(true);
  };

  const openEdit = (gw: Gateway) => {
    setEditGw(gw);
    setViewMode(false);
    setWizardStep(1);
    const gwForm = toForm(gw);
    setForm(gwForm);
    setInitialForm(gwForm);
    setDialogOpen(true);
  };

  const requestSave = () => setConfirmSave(true);

  const doSave = async () => {
    setConfirmSave(false);
    try {
      if (editGw) {
        await api.put(`/gateways/${editGw.name}`, form);
      } else {
        const payload = { ...form } as any;
        if (form.type === 'ai') {
          payload.ai_extension = aiSetup.extension === '__new__' ? aiSetup.newExtNumber : aiSetup.extension;
          payload.ai_assistant_id = aiSetup.assistant_id;
        }
        await api.post('/gateways', payload);
      }
      setDialogOpen(false);
      setToast({ open: true, message: t('status.success'), severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const toggleEnabled = async (gw: Gateway) => {
    try {
      await api.put(`/gateways/${gw.name}`, { enabled: !(gw.enabled !== false) });
      load();
    } catch {
      setToast({ open: true, message: t('status.error'), severity: 'error' });
    }
  };

  const requestDelete = (name: string) => setConfirmDelete({ open: true, name });

  const doDelete = async () => {
    const name = confirmDelete.name;
    setConfirmDelete({ open: false, name: '' });
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

      <CrudTable<Gateway>
        rows={gateways}
        getKey={(gw) => gw.name}
        columns={[
          { id: 'name', header: t('field.name'), render: (gw) => gw.description ? `${gw.name} (${gw.description})` : gw.name, searchText: (gw) => `${gw.name} ${gw.description || ''}` },
          { id: 'type', header: t('field.type'), render: (gw) => <Chip size="small" label={gw.type} />, searchText: (gw) => gw.type },
          { id: 'host', header: t('field.host'), render: (gw) => `${gw.host}:${gw.port}`, searchText: (gw) => `${gw.host}:${gw.port}` },
          { id: 'transport', header: t('field.transport'), field: 'transport' },
        ]}
        columnOrderKey="gateways-columns"
        searchable
        getStatus={(gw) => {
          const st = gwStatuses.find((s) => s.name === gw.name || s.name === `external::${gw.name}` || s.name.endsWith(`::${gw.name}`));
          const label = st?.state || st?.status || '';
          return st
            ? { label: st.registered ? 'REGED' : label, color: gwChipColor(st.registered ? 'REGED' : label) }
            : { label: '\u2014', color: 'default' };
        }}
        getEnabled={(gw) => gw.enabled !== false}
        onToggle={(gw) => toggleEnabled(gw)}
        onView={openView}
        onEdit={openEdit}
        onDelete={(gw) => requestDelete(gw.name)}
      />

      {/* Gateway Wizard */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {viewMode ? t('modal.view_gateway') : editGw ? t('modal.edit_gateway') : t('modal.add_gateway')}
        </DialogTitle>
        <DialogContent>
          {/* Stepper — only for new gateway */}
          {!editGw && !viewMode && (() => {
            const steps = form.type === 'ai' ? WIZARD_STEPS_AI : WIZARD_STEPS_SIP;
            return (
              <Stepper activeStep={wizardStep} sx={{ mb: 3 }}>
                {steps.map((label, i) => <Step key={label}><StepLabel>{i === wizardStep ? label : ''}</StepLabel></Step>)}
              </Stepper>
            );
          })()}

          {/* Step 0: Typ */}
          {wizardStep === 0 && !editGw && !viewMode && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {GW_TYPES.map((gwt) => {
                const Icon = gwt.icon;
                const sel = form.type === gwt.value;
                return (
                  <Card key={gwt.value} variant="outlined" sx={{ border: 2, borderColor: sel ? 'primary.main' : 'divider' }}>
                    <CardActionArea onClick={() => setForm({ ...form, type: gwt.value })}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Icon sx={{ fontSize: 36, color: sel ? 'primary.main' : 'text.secondary' }} />
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>{gwt.label}</Typography>
                          <Typography variant="body2" color="text.secondary">{gwt.desc}</Typography>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* Step 1: Verbindung (or Edit/View mode) */}
          {(wizardStep === 1 || editGw || viewMode) && wizardStep !== 0 && wizardStep !== 2 && wizardStep !== 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {form.type !== 'ai' ? (
                <>
                  <TextField label={t('field.name')} value={form.description}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const slug = raw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '');
                      setForm({ ...form, description: raw, name: editGw ? form.name : slug });
                    }}
                    disabled={viewMode} />
                  {form.name && (
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {t('gateway.technical_name')}: {form.name}
                    </Typography>
                  )}
                  <TextField label={t('field.host')} value={form.host} onChange={(e) => f('host', e.target.value)} disabled={viewMode} />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField label={t('field.port')} type="number" value={form.port}
                      onChange={(e) => f('port', parseInt(e.target.value) || 5060)} disabled={viewMode} sx={{ flex: 1 }} />
                    <SearchableSelect options={TRANSPORT_OPTIONS} value={form.transport}
                      onChange={(v) => f('transport', v)} label={t('field.transport')} disabled={viewMode} sx={{ flex: 1 }} />
                  </Box>
                  <TextField label={t('auth.username')} value={form.username} onChange={(e) => f('username', e.target.value)} disabled={viewMode} />
                  <TextField label={t('auth.password')} type="password" value={form.password} onChange={(e) => f('password', e.target.value)} disabled={viewMode} />
                  {form.type === 'pbx' && (
                    <TextField label={t('gateway.auth_username')} value={form.auth_username}
                      onChange={(e) => f('auth_username', e.target.value)} helperText={t('gateway.auth_username_hint')} disabled={viewMode} />
                  )}
                  <FormControlLabel
                    control={<Switch checked={form.register} onChange={(e) => f('register', e.target.checked)} disabled={viewMode} />}
                    label="Register" />
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <SearchableSelect
                    options={[
                      { label: 'VAPI', value: 'vapi' },
                      { label: 'Retell', value: 'retell' },
                      { label: 'Bland AI', value: 'bland' },
                    ]}
                    value={form.ai_provider}
                    onChange={(v) => {
                      const providerAccounts = aiAccounts.filter((a) => a.connected && v === 'vapi');
                      if (providerAccounts.length === 1) {
                        const acc = providerAccounts[0];
                        const displayName = `${v.toUpperCase()} ${acc.name}`;
                        const slug = `${v}_${acc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '')}`;
                        setForm({ ...form, ai_provider: v, ai_account_id: acc.id, description: displayName, name: slug });
                      } else {
                        setForm({ ...form, ai_provider: v, ai_account_id: null, description: '', name: '' });
                      }
                    }}
                    label={t('gateway.ai_provider')}
                    disabled={viewMode}
                  />
                  {form.ai_provider && (() => {
                    const filtered = aiAccounts.filter((a) => a.connected && form.ai_provider === 'vapi'); // TODO: filter by provider when retell/bland accounts exist
                    return filtered.length > 0 ? (
                      <SearchableSelect
                        options={filtered.map((a) => ({ label: a.name, value: String(a.id) }))}
                        value={form.ai_account_id ? String(form.ai_account_id) : ''}
                        onChange={(v) => {
                          const accId = v ? parseInt(v) : null;
                          const acc = filtered.find((a) => a.id === accId);
                          const accName = acc?.name || '';
                          const providerLabel = form.ai_provider.toUpperCase();
                          const displayName = `${providerLabel} ${accName}`;
                          const slug = `${form.ai_provider}_${accName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '')}`;
                          setForm({ ...form, ai_account_id: accId, description: displayName, name: editGw ? form.name : slug });
                        }}
                        label={t('gateway.ai_account')}
                        disabled={viewMode}
                      />
                    ) : (
                      <SearchableSelect
                        options={[]}
                        value=""
                        onChange={() => {}}
                        label={t('gateway.ai_account')}
                        disabled
                        helperText={t('gateway.ai_no_accounts')}
                      />
                    );
                  })()}
                  {form.ai_account_id && (
                    <>
                      <TextField label={t('field.name')} value={form.description}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const slug = `${form.ai_provider}_${raw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '')}`;
                          setForm({ ...form, description: raw, name: editGw ? form.name : slug });
                        }}
                        disabled={viewMode} />
                      {form.name && (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {t('gateway.technical_name')}: {form.name}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              )}

              <FormControlLabel
                control={<Switch checked={form.enabled} onChange={(e) => f('enabled', e.target.checked)} color="success" disabled={viewMode} />}
                label={form.enabled ? t('status.enabled') : t('status.disabled')} />

              {/* Rufnummern inline for Edit/View */}
              {(editGw || viewMode) && (
                <>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2">{t('gateway.phone_numbers')} ({form.phone_numbers.length})</Typography>
                    {!viewMode && (
                      <Button size="small" onClick={() => setForm({ ...form, phone_numbers: [...form.phone_numbers, { type: 'single', number: '' }] })}>
                        {t('gateway.add_number')}
                      </Button>
                    )}
                  </Box>
                  {form.phone_numbers.map((entry, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <ToggleButtonGroup size="small" exclusive value={entry.type} disabled={viewMode}
                          onChange={(_, v) => { if (!v) return; const u = [...form.phone_numbers]; u[idx] = v === 'single' ? { type: 'single', number: entry.number || entry.stem || '' } : { type: 'block', stem: entry.stem || entry.number || '', range_start: '0', range_end: '9' }; setForm({ ...form, phone_numbers: u }); }}>
                          <ToggleButton value="single">{t('gateway.single_number')}</ToggleButton>
                          <ToggleButton value="block">{t('gateway.number_block')}</ToggleButton>
                        </ToggleButtonGroup>
                        {entry.type === 'single' ? (
                          <TextField size="small" label={t('gateway.phone_number')} value={entry.number || ''} placeholder="+49..." disabled={viewMode}
                            onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, number: e.target.value }; setForm({ ...form, phone_numbers: u }); }}
                            error={!!entry.number && !/^\+[1-9]\d{6,14}$/.test(entry.number)} />
                        ) : (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField size="small" label={t('gateway.stem_number')} value={entry.stem || ''} placeholder="+49..." sx={{ flex: 2 }} disabled={viewMode}
                              onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, stem: e.target.value }; setForm({ ...form, phone_numbers: u }); }} />
                            <TextField size="small" label={t('gateway.range_start')} value={entry.range_start || ''} placeholder="0" sx={{ flex: 1 }} disabled={viewMode}
                              onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, range_start: e.target.value }; setForm({ ...form, phone_numbers: u }); }} />
                            <TextField size="small" label={t('gateway.range_end')} value={entry.range_end || ''} placeholder="9" sx={{ flex: 1 }} disabled={viewMode}
                              onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, range_end: e.target.value }; setForm({ ...form, phone_numbers: u }); }} />
                          </Box>
                        )}
                      </Box>
                      {!viewMode && (
                        <IconButton size="small" color="error" onClick={() => setForm({ ...form, phone_numbers: form.phone_numbers.filter((_, i) => i !== idx) })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  {form.phone_numbers.length === 0 && <Typography variant="body2" color="text.secondary">{t('gateway.no_numbers')}</Typography>}
                </>
              )}
            </Box>
          )}

          {/* Step 2: Rufnummern (new wizard) */}
          {wizardStep === 2 && !editGw && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2">{t('gateway.phone_numbers')} ({form.phone_numbers.length})</Typography>
                <Button size="small" onClick={() => setForm({ ...form, phone_numbers: [...form.phone_numbers, { type: 'single', number: '' }] })}>
                  {t('gateway.add_number')}
                </Button>
              </Box>
              {form.phone_numbers.map((entry, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <ToggleButtonGroup size="small" exclusive value={entry.type}
                      onChange={(_, v) => { if (!v) return; const u = [...form.phone_numbers]; u[idx] = v === 'single' ? { type: 'single', number: entry.number || entry.stem || '' } : { type: 'block', stem: entry.stem || entry.number || '', range_start: '0', range_end: '9' }; setForm({ ...form, phone_numbers: u }); }}>
                      <ToggleButton value="single">{t('gateway.single_number')}</ToggleButton>
                      <ToggleButton value="block">{t('gateway.number_block')}</ToggleButton>
                    </ToggleButtonGroup>
                    {entry.type === 'single' ? (
                      <TextField size="small" label={t('gateway.phone_number')} value={entry.number || ''} placeholder="+49..."
                        onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, number: e.target.value }; setForm({ ...form, phone_numbers: u }); }}
                        error={!!entry.number && !/^\+[1-9]\d{6,14}$/.test(entry.number)} />
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField size="small" label={t('gateway.stem_number')} value={entry.stem || ''} placeholder="+49..." sx={{ flex: 2 }}
                          onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, stem: e.target.value }; setForm({ ...form, phone_numbers: u }); }} />
                        <TextField size="small" label={t('gateway.range_start')} value={entry.range_start || ''} placeholder="0" sx={{ flex: 1 }}
                          onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, range_start: e.target.value }; setForm({ ...form, phone_numbers: u }); }} />
                        <TextField size="small" label={t('gateway.range_end')} value={entry.range_end || ''} placeholder="9" sx={{ flex: 1 }}
                          onChange={(e) => { const u = [...form.phone_numbers]; u[idx] = { ...entry, range_end: e.target.value }; setForm({ ...form, phone_numbers: u }); }} />
                      </Box>
                    )}
                  </Box>
                  <IconButton size="small" color="error" onClick={() => setForm({ ...form, phone_numbers: form.phone_numbers.filter((_, i) => i !== idx) })}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              {form.phone_numbers.length === 0 && <Typography variant="body2" color="text.secondary">{t('gateway.no_numbers')}</Typography>}
            </Box>
          )}

          {/* Step 3 (AI only): AI Verbindung */}
          {wizardStep === 3 && form.type === 'ai' && !editGw && (() => {
            // Available extensions (not used in inbound routes)
            const usedExts = new Set<string>();
            const allExts = aiExtensions || [];
            const freeExts = allExts.filter((e) => !usedExts.has(e.extension));
            const newExtOption = { label: `+ ${t('gateway.ai_new_extension')}`, value: '__new__' };
            const extOptions = [
              newExtOption,
              ...freeExts.map((e) => ({ label: `${e.extension}${e.description ? ` — ${e.description}` : ''}`, value: e.extension })),
            ];

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2">{t('gateway.ai_setup_title')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('gateway.ai_setup_desc')}</Typography>

                {/* NB / Extension */}
                <SearchableSelect
                  options={extOptions}
                  value={aiSetup.extension === '__new__' ? '__new__' : aiSetup.extension}
                  onChange={(v) => setAiSetup({ ...aiSetup, extension: v })}
                  label={t('field.extension')}
                />
                {aiSetup.extension === '__new__' && (
                  <TextField label={t('gateway.ai_new_ext_number')} value={aiSetup.newExtNumber || ''}
                    onChange={(e) => setAiSetup({ ...aiSetup, newExtNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="1001" helperText={t('gateway.ai_extension_hint')} />
                )}

                {/* Assistant */}
                {aiAssistants.length > 0 ? (
                  <SearchableSelect
                    options={aiAssistants.map((a) => ({ label: a.name || a.id, value: a.id }))}
                    value={aiSetup.assistant_id}
                    onChange={(v) => setAiSetup({ ...aiSetup, assistant_id: v })}
                    label={t('gateway.ai_assistant')}
                  />
                ) : (
                  <Button variant="outlined" onClick={async () => {
                    if (!form.ai_account_id) return;
                    try {
                      const res = await api.get(`/integrations/vapi/accounts/${form.ai_account_id}/assistants`);
                      setAiAssistants(res.data || []);
                    } catch { /* ignore */ }
                  }}>{t('gateway.ai_load_assistants')}</Button>
                )}

                <Typography variant="caption" color="text.secondary">
                  {t('gateway.ai_auto_create_hint')}
                </Typography>
              </Box>
            );
          })()}

          {/* Zusammenfassung (last step) */}
          {wizardStep === (form.type === 'ai' ? 4 : 3) && !editGw && (
            <Table size="small">
              <TableBody>
                <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('field.type')}</TableCell><TableCell>{GW_TYPES.find((g) => g.value === form.type)?.label}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('field.name')}</TableCell><TableCell>{form.description || form.name}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('gateway.technical_name')}</TableCell><TableCell sx={{ fontFamily: 'monospace' }}>{form.name}</TableCell></TableRow>
                {form.type !== 'ai' && (
                  <>
                    <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('field.host')}</TableCell><TableCell>{form.host}:{form.port}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('field.transport')}</TableCell><TableCell>{form.transport.toUpperCase()}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('auth.username')}</TableCell><TableCell>{form.username || '—'}</TableCell></TableRow>
                  </>
                )}
                <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('gateway.phone_numbers')}</TableCell><TableCell>{form.phone_numbers.length}</TableCell></TableRow>
                {form.type === 'ai' && aiSetup.extension && (
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('field.extension')}</TableCell><TableCell>{aiSetup.extension}</TableCell></TableRow>
                )}
                {form.type === 'ai' && aiSetup.assistant_id && (
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('gateway.ai_assistant')}</TableCell><TableCell>{aiAssistants.find((a) => a.id === aiSetup.assistant_id)?.name || aiSetup.assistant_id}</TableCell></TableRow>
                )}
                <TableRow><TableCell sx={{ fontWeight: 600 }}>{t('field.status')}</TableCell><TableCell>{form.enabled ? t('status.enabled') : t('status.disabled')}</TableCell></TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>

        <DialogActions>
          {wizardStep > 0 && !editGw && !viewMode && (
            <Button startIcon={<ArrowBackIcon />} onClick={() => setWizardStep(wizardStep - 1)}>{t('button.back')}</Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setDialogOpen(false)}>{t('button.cancel')}</Button>
          {wizardStep < (form.type === 'ai' ? 4 : 3) && !editGw && !viewMode && (
            <Button variant="contained" endIcon={<ArrowForwardIcon />}
              onClick={() => setWizardStep(wizardStep + 1)}
              disabled={
                (wizardStep === 0 && !form.type) ||
                (wizardStep === 1 && form.type !== 'ai' && (!form.description || !form.host)) ||
                (wizardStep === 1 && form.type === 'ai' && (!form.ai_provider || !form.ai_account_id || !form.description))
              }>{t('button.next')}</Button>
          )}
          {(wizardStep === (form.type === 'ai' ? 4 : 3) || editGw) && !viewMode && (
            <Button variant="contained" onClick={requestSave}>{t('button.save')}</Button>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmSave} variant="save"
        title={t('confirm.save_title')} message={t('confirm.save_message')}
        confirmLabel={t('button.save')} cancelLabel={t('button.cancel')}
        onConfirm={doSave} onCancel={() => setConfirmSave(false)} />

      <ConfirmDialog open={confirmDelete.open} variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: confirmDelete.name })}
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={doDelete} onCancel={() => setConfirmDelete({ open: false, name: '' })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
