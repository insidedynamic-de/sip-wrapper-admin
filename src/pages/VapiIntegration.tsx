/**
 * @file VapiIntegration — Multi-account VAPI management
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, TextField,
  Chip, Alert, CircularProgress, IconButton, InputAdornment, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Collapse,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PhoneIcon from '@mui/icons-material/Phone';
import api from '../api/client';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import FormDialog from '../components/FormDialog';

interface VapiAccount {
  id: number;
  name: string;
  api_key_masked: string;
  credential_id: string;
  sip_domain: string;
  sip_ips: string;
  gateway_name: string;
  connected: boolean;
}

interface Assistant {
  id: string; name: string; model: string; provider: string;
  first_message: string; system_prompt: string;
  voice_provider: string; voice_id: string; language: string;
  max_duration: number | string; end_call_phrases: string[];
  tools_count: number;
}
interface PhoneNumber { id: string; number: string; name: string; assistantId: string; }
interface Call { id: string; type: string; status: string; ended_reason: string; assistant_name: string; customer_number: string; duration: number; cost: number; started_at: string; }

export default function VapiIntegration() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<VapiAccount[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedAssistant, setExpandedAssistant] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<Record<number, { assistants: Assistant[]; phoneNumbers: PhoneNumber[]; calls: Call[] }>>({});

  // Add account dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', api_key: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Test call
  const [testForm, setTestForm] = useState({ account_id: 0, assistant_id: '', phone_number: '', phone_number_id: '' });
  const [testCalling, setTestCalling] = useState(false);
  const [testError, setTestError] = useState('');

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });
  const [deleteId, setDeleteId] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/integrations/vapi/accounts');
      setAccounts(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadAccountData = async (id: number) => {
    try {
      const [aRes, pRes, cRes] = await Promise.all([
        api.get(`/integrations/vapi/accounts/${id}/assistants`).catch(() => ({ data: [] })),
        api.get(`/integrations/vapi/accounts/${id}/phone-numbers`).catch(() => ({ data: [] })),
        api.get(`/integrations/vapi/accounts/${id}/calls`).catch(() => ({ data: [] })),
      ]);
      setAccountData((prev) => ({ ...prev, [id]: { assistants: aRes.data || [], phoneNumbers: pRes.data || [], calls: cRes.data || [] } }));
    } catch { /* ignore */ }
  };

  const toggleExpand = (id: number) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!accountData[id]) loadAccountData(id);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name || !addForm.api_key) return;
    setAddSaving(true);
    try {
      await api.post('/integrations/vapi/accounts', addForm);
      setAddOpen(false);
      setAddForm({ name: '', api_key: '' });
      setToast({ open: true, message: `${addForm.name} verbunden`, severity: 'success' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Fehler', severity: 'error' });
    }
    setAddSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/integrations/vapi/accounts/${deleteId}`);
      setToast({ open: true, message: 'Account entfernt', severity: 'info' });
      setDeleteId(0);
      load();
    } catch {
      setToast({ open: true, message: 'Fehler', severity: 'error' });
      setDeleteId(0);
    }
  };

  const handleTestCall = async () => {
    setTestCalling(true);
    setTestError('');
    try {
      const res = await api.post(`/integrations/vapi/accounts/${testForm.account_id}/test-call`, {
        assistant_id: testForm.assistant_id,
        phone_number: testForm.phone_number,
        phone_number_id: testForm.phone_number_id,
      });
      setToast({ open: true, message: `Anruf gestartet (${res.data?.call_id || 'OK'})`, severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setTestError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : JSON.stringify(e?.response?.data?.detail || 'Fehler'));
    }
    setTestCalling(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">VAPI Accounts</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setAddOpen(true)}>
          Account hinzufügen
        </Button>
      </Box>

      {accounts.length === 0 ? (
        <Alert severity="info">Keine VAPI Accounts. Fügen Sie einen Account hinzu um zu starten.</Alert>
      ) : (
        accounts.map((acc) => {
          const data = accountData[acc.id];
          const isExpanded = expanded === acc.id;
          return (
            <Card key={acc.id} sx={{ mb: 2, borderLeft: 4, borderColor: acc.connected ? 'success.main' : 'error.main' }}>
              <CardContent sx={{ pb: isExpanded ? 0 : undefined }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }} onClick={() => toggleExpand(acc.id)}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{acc.name}</Typography>
                      <Chip icon={acc.connected ? <CheckCircleIcon /> : <ErrorIcon />}
                        label={acc.connected ? 'Verbunden' : 'Nicht verbunden'}
                        color={acc.connected ? 'success' : 'error'} size="small" />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {acc.credential_id ? `Credential: ${acc.credential_id.substring(0, 12)}...` : 'Kein Credential'}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteId(acc.id); }} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>

                {/* Expanded details */}
                <Collapse in={isExpanded}>
                  <Divider sx={{ my: 2 }} />

                  {/* SIP Trunk Details */}
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>SIP Trunk</Typography>
                  <TableContainer sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableBody>
                        <TableRow><TableCell sx={{ fontWeight: 600, width: 160 }}>Credential ID</TableCell><TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{acc.credential_id}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ fontWeight: 600 }}>SIP Domain</TableCell><TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{acc.sip_domain}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ fontWeight: 600 }}>Gateway</TableCell><TableCell>{acc.gateway_name}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ fontWeight: 600 }}>VAPI IPs</TableCell><TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{acc.sip_ips}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ fontWeight: 600 }}>API Key</TableCell><TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{acc.api_key_masked}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {data ? (
                    <>
                      {/* Phone Numbers */}
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Telefonnummern ({data.phoneNumbers.length})</Typography>
                      {data.phoneNumbers.length > 0 ? (
                        <TableContainer sx={{ mb: 2 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Nummer</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Assistent</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {data.phoneNumbers.map((n) => {
                                const asst = data.assistants.find((a) => a.id === n.assistantId);
                                return (
                                  <TableRow key={n.id}>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{n.number}</TableCell>
                                    <TableCell>{n.name || '\u2014'}</TableCell>
                                    <TableCell>{asst?.name || '\u2014'}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Keine Telefonnummern.</Typography>}

                      {/* Test Call */}
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Test-Anruf</Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1, flexWrap: 'wrap' }}>
                        <TextField select size="small" label="Assistent" value={testForm.account_id === acc.id ? testForm.assistant_id : ''}
                          onChange={(e) => setTestForm({ ...testForm, account_id: acc.id, assistant_id: e.target.value })}
                          sx={{ minWidth: 200 }}
                          SelectProps={{ native: true }}>
                          <option value="">— Wählen —</option>
                          {data.assistants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </TextField>
                        <TextField select size="small" label="Absender" value={testForm.account_id === acc.id ? testForm.phone_number_id : ''}
                          onChange={(e) => setTestForm({ ...testForm, account_id: acc.id, phone_number_id: e.target.value })}
                          sx={{ minWidth: 200 }}
                          SelectProps={{ native: true }}>
                          <option value="">— Wählen —</option>
                          {data.phoneNumbers.map((n) => <option key={n.id} value={n.id}>{n.number} ({n.name || 'VAPI'})</option>)}
                        </TextField>
                        <TextField size="small" label="Zielnummer" placeholder="+49..." value={testForm.account_id === acc.id ? testForm.phone_number : ''}
                          onChange={(e) => setTestForm({ ...testForm, account_id: acc.id, phone_number: e.target.value })} sx={{ width: 180 }} />
                        <Button variant="contained" color="success" size="small"
                          disabled={testCalling || !testForm.assistant_id || !testForm.phone_number || testForm.account_id !== acc.id}
                          onClick={handleTestCall} sx={{ height: 40 }}>
                          {testCalling ? '...' : <PhoneIcon />}
                        </Button>
                      </Box>
                      {testError && testForm.account_id === acc.id && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTestError('')}>{testError}</Alert>
                      )}

                      {/* Calls */}
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Anrufe ({data.calls.length})</Typography>
                      {data.calls.length > 0 ? (
                        <TableContainer sx={{ mb: 2, maxHeight: 250 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>Zeit</TableCell>
                                <TableCell>Typ</TableCell>
                                <TableCell>Assistent</TableCell>
                                <TableCell>Nummer</TableCell>
                                <TableCell>Dauer</TableCell>
                                <TableCell>Kosten</TableCell>
                                <TableCell>Status</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {data.calls.slice(0, 20).map((c) => {
                                const isError = c.status === 'failed' || c.ended_reason?.includes('error');
                                return (
                                  <TableRow key={c.id}>
                                    <TableCell sx={{ fontSize: 11, fontFamily: 'monospace' }}>{c.started_at ? new Date(c.started_at).toLocaleString('de') : '\u2014'}</TableCell>
                                    <TableCell><Chip size="small" label={c.type === 'outboundPhoneCall' ? 'OUT' : 'IN'} color={c.type === 'outboundPhoneCall' ? 'warning' : 'info'} sx={{ height: 20, fontSize: 10 }} /></TableCell>
                                    <TableCell sx={{ fontSize: 12 }}>{c.assistant_name || '\u2014'}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.customer_number || '\u2014'}</TableCell>
                                    <TableCell>{c.duration > 0 ? `${c.duration}s` : '\u2014'}</TableCell>
                                    <TableCell>{c.cost > 0 ? `$${c.cost}` : '\u2014'}</TableCell>
                                    <TableCell>
                                      {isError ? (
                                        <Tooltip title={c.ended_reason}><Chip size="small" label="Fehler" color="error" sx={{ height: 20, fontSize: 10 }} /></Tooltip>
                                      ) : <Chip size="small" label="OK" color="success" sx={{ height: 20, fontSize: 10 }} />}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Keine Anrufe.</Typography>}

                      {/* Assistants */}
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Assistenten ({data.assistants.length})</Typography>
                      {data.assistants.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
                          {data.assistants.map((a) => {
                            const isOpen = expandedAssistant === a.id;
                            return (
                            <Card key={a.id} variant="outlined" sx={{ bgcolor: 'action.hover', cursor: 'pointer' }}>
                              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }} onClick={() => setExpandedAssistant(isOpen ? null : a.id)}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle2" fontWeight={600}>{a.name}</Typography>
                                    {a.model && <Chip size="small" label={a.model} variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                                    {a.language && <Chip size="small" label={a.language.toUpperCase()} color="info" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                                  </Box>
                                  {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </Box>
                              </CardContent>
                              <Collapse in={isOpen}>
                                <Divider />
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                                    {a.provider && <Chip size="small" label={`Provider: ${a.provider}`} variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                                    {a.voice_provider && <Chip size="small" label={`Voice: ${a.voice_provider}`} variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                                    {a.voice_id && <Chip size="small" label={`Voice-ID: ${a.voice_id.slice(0, 12)}...`} variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                                    {a.tools_count > 0 && <Chip size="small" label={`${a.tools_count} Tools`} color="secondary" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                                    {a.max_duration && <Chip size="small" label={`Max ${a.max_duration}s`} variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
                                  </Box>
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mb: 1.5 }}>ID: {a.id}</Typography>
                                  {a.first_message && (
                                    <Box sx={{ mb: 1.5 }}>
                                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Begrüßung</Typography>
                                      <Typography variant="body2" sx={{ bgcolor: 'background.paper', p: 1, borderRadius: 1, fontSize: 12, fontStyle: 'italic' }}>
                                        {a.first_message}
                                      </Typography>
                                    </Box>
                                  )}
                                  {a.system_prompt && (
                                    <Box sx={{ mb: 1.5 }}>
                                      <Typography variant="caption" color="text.secondary" fontWeight={600}>System-Prompt</Typography>
                                      <Typography variant="body2" sx={{ bgcolor: 'background.paper', p: 1, borderRadius: 1, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                                        {a.system_prompt}
                                      </Typography>
                                    </Box>
                                  )}
                                  {a.end_call_phrases?.length > 0 && (
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Auflegefloskeln</Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                        {a.end_call_phrases.map((p, i) => <Chip key={i} size="small" label={p} sx={{ height: 22, fontSize: 11 }} />)}
                                      </Box>
                                    </Box>
                                  )}
                                </CardContent>
                              </Collapse>
                            </Card>
                            );
                          })}
                        </Box>
                      ) : <Typography variant="body2" color="text.secondary">Keine Assistenten.</Typography>}
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Add Account Dialog */}
      <FormDialog open={addOpen} title="VAPI Account hinzufügen"
        dirty={!!(addForm.name || addForm.api_key)}
        onClose={() => { setAddOpen(false); setAddForm({ name: '', api_key: '' }); }}
        onSave={handleAdd}
        saveLabel={addSaving ? '...' : 'Verbinden'}
      >
        <TextField label="Firmenname" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
          placeholder="z.B. Musterfirma GmbH" />
        <TextField label="VAPI API Key" type={showKey ? 'text' : 'password'} value={addForm.api_key}
          onChange={(e) => setAddForm({ ...addForm, api_key: e.target.value })}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }} />
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog open={!!deleteId} variant="delete"
        title="Account entfernen" message="Lokale Konfiguration wird entfernt. VAPI Credential bleibt bestehen."
        confirmLabel="Entfernen" cancelLabel={t('button.cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteId(0)} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
