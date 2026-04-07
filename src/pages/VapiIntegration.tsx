/**
 * @file VapiIntegration — VAPI SIP trunk: API key, test, connect, assistants, phone numbers
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, TextField,
  Chip, Alert, CircularProgress, IconButton, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api/client';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/SearchableSelect';

interface VapiConfig {
  configured: boolean;
  api_key_masked: string;
  credential_id: string;
  sip_ips: string[];
  connected: boolean;
}

interface VapiAssistant {
  id: string;
  name: string;
  model: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name: string;
  provider: string;
  credentialId: string;
  assistantId: string;
}

export default function VapiIntegration() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<VapiConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Assistants & phone numbers
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newAssistant, setNewAssistant] = useState('');
  const [creating, setCreating] = useState(false);

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [deleteId, setDeleteId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/integrations/vapi');
      setConfig(res.data);
      if (res.data?.configured) {
        const [aRes, pRes] = await Promise.all([
          api.get('/integrations/vapi/assistants').catch(() => ({ data: [] })),
          api.get('/integrations/vapi/phone-numbers').catch(() => ({ data: [] })),
        ]);
        setAssistants(aRes.data || []);
        setPhoneNumbers(pRes.data || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveKey = async () => {
    if (!apiKey.trim()) return;
    try {
      await api.put('/integrations/vapi/key', { api_key: apiKey.trim() });
      setApiKey('');
      setToast({ open: true, message: 'API Key gespeichert', severity: 'success' });
      load();
    } catch {
      setToast({ open: true, message: 'Fehler beim Speichern', severity: 'error' });
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await api.post('/integrations/vapi/test');
      setToast({ open: true, message: res.data?.message || 'Verbunden', severity: 'success' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Verbindung fehlgeschlagen';
      setToast({ open: true, message: msg, severity: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const setupTrunk = async () => {
    setConnecting(true);
    try {
      const res = await api.post('/integrations/vapi/setup', { name: 'TalkHub SIP Trunk' });
      setToast({ open: true, message: res.data?.message || 'SIP Trunk erstellt', severity: 'success' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Fehler';
      setToast({ open: true, message: msg, severity: 'error' });
    } finally {
      setConnecting(false);
    }
  };

  const createPhoneNumber = async () => {
    if (!newNumber.trim()) return;
    setCreating(true);
    try {
      await api.post('/integrations/vapi/phone-number', {
        number: newNumber.trim(),
        name: newName.trim(),
        assistant_id: newAssistant,
      });
      setNewNumber('');
      setNewName('');
      setNewAssistant('');
      setToast({ open: true, message: 'Telefonnummer erstellt', severity: 'success' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Fehler';
      setToast({ open: true, message: msg, severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const deletePhoneNumber = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/integrations/vapi/phone-number/${deleteId}`);
      setToast({ open: true, message: 'Telefonnummer entfernt', severity: 'info' });
      setDeleteId('');
      load();
    } catch {
      setToast({ open: true, message: 'Fehler', severity: 'error' });
      setDeleteId('');
    }
  };

  const disconnect = async () => {
    setConfirmDisconnect(false);
    try {
      await api.delete('/integrations/vapi');
      setToast({ open: true, message: 'VAPI getrennt', severity: 'info' });
      setAssistants([]);
      setPhoneNumbers([]);
      load();
    } catch {
      setToast({ open: true, message: 'Fehler', severity: 'error' });
    }
  };

  const assistantOptions = [
    { label: '\u2014', value: '' },
    ...assistants.map((a) => ({ label: a.name || a.id, value: a.id })),
  ];

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>VAPI</Typography>
          {config?.connected ? (
            <Chip icon={<CheckCircleIcon />} label="Verbunden" color="success" size="small" />
          ) : config?.configured ? (
            <Chip icon={<ErrorIcon />} label="Nicht verbunden" color="warning" size="small" />
          ) : (
            <Chip label="Nicht konfiguriert" size="small" />
          )}
        </Box>

        {/* API Key */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
          <TextField
            size="small"
            sx={{ flex: 1 }}
            type={showKey ? 'text' : 'password'}
            placeholder={config?.configured ? '\u2022'.repeat(12) : 'VAPI Private Key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onFocus={() => { if (!apiKey && config?.configured) setApiKey(''); }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button size="small" variant="outlined" onClick={saveKey} disabled={!apiKey.trim()}>
            Speichern
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={testing ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={testConnection}
            disabled={testing || !config?.configured}
          >
            Testen
          </Button>
        </Box>

        {/* SIP Trunk */}
        {config?.configured && (
          <>
            <Divider sx={{ my: 2 }} />

            {config.connected ? (
              <Box sx={{ mb: 2 }}>
                <Alert severity="success" sx={{ mb: 1 }}>
                  Verbunden — Gateway: <strong>{(config as VapiConfig & { gateway_name?: string }).gateway_name || 'vapi'}</strong>
                  {' \u2022 '} Domain: <code>{(config as VapiConfig & { sip_domain?: string }).sip_domain}</code>
                </Alert>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Eingehend: VAPI IPs {config.sip_ips?.join(', ')} &rarr; ACL erlaubt
                  {' \u2022 '} Ausgehend: Gateway &quot;vapi&quot; &rarr; {(config as VapiConfig & { sip_domain?: string }).sip_domain}
                </Typography>
                <Button size="small" variant="outlined" color="error" startIcon={<LinkOffIcon />}
                  onClick={() => setConfirmDisconnect(true)}>
                  Trennen
                </Button>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={connecting ? <CircularProgress size={14} /> : <LinkIcon />}
                  onClick={setupTrunk}
                  disabled={connecting}
                >
                  SIP Trunk verbinden
                </Button>
              </Box>
            )}
          </>
        )}

        {/* Phone Numbers */}
        {config?.connected && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Telefonnummern</Typography>

            {phoneNumbers.length > 0 && (
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nummer</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Assistent</TableCell>
                      <TableCell sx={{ width: 40 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {phoneNumbers.map((n) => {
                      const asst = assistants.find((a) => a.id === n.assistantId);
                      return (
                        <TableRow key={n.id}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{n.number}</TableCell>
                          <TableCell>{n.name || '\u2014'}</TableCell>
                          <TableCell>{asst?.name || n.assistantId || '\u2014'}</TableCell>
                          <TableCell>
                            <IconButton size="small" color="error" onClick={() => setDeleteId(n.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Add phone number */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField size="small" placeholder="Nummer (z.B. +4930123456)" value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)} sx={{ width: 200 }} />
              <TextField size="small" placeholder="Name" value={newName}
                onChange={(e) => setNewName(e.target.value)} sx={{ width: 150 }} />
              <SearchableSelect
                options={assistantOptions}
                value={newAssistant}
                onChange={setNewAssistant}
                label="Assistent"
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
                onClick={createPhoneNumber}
                disabled={creating || !newNumber.trim()}
              >
                Hinzuf&uuml;gen
              </Button>
            </Box>
          </>
        )}
      </CardContent>

      <ConfirmDialog open={confirmDisconnect} variant="delete"
        title="VAPI trennen" message="SIP Trunk und ACL User werden entfernt."
        confirmLabel="Trennen" cancelLabel={t('button.cancel')}
        onConfirm={disconnect} onCancel={() => setConfirmDisconnect(false)} />

      <ConfirmDialog open={!!deleteId} variant="delete"
        title="Telefonnummer entfernen" message="Diese Nummer wird auf VAPI gelöscht."
        confirmLabel={t('button.delete')} cancelLabel={t('button.cancel')}
        onConfirm={deletePhoneNumber} onCancel={() => setDeleteId('')} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity}
        onClose={() => setToast({ ...toast, open: false })} />
    </Card>
  );
}
