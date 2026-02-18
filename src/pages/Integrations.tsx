/**
 * @file Integrations — Integration cards with license-gated activation and detail view
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, CardActions, Button, Chip,
  Avatar, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, List, ListItem, ListItemIcon, ListItemText, Divider,
  Tooltip,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckIcon from '@mui/icons-material/Check';
import SettingsIcon from '@mui/icons-material/Settings';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import api from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

interface Integration {
  id: string;
  name: string;
  descKey: string;
  detailKey: string;
  featuresKey: string;
  icon: string;
  color: string;
  requiredLicense: string;
  configRoute?: string;
}

interface AvailableLicense {
  license_key: string;
  license_name: string;
  bound_to?: string;
  valid_until: string;
  licensed: boolean;
}

const INTEGRATIONS: Integration[] = [
  { id: 'talkhub', name: 'TalkHub', descKey: 'integrations.talkhub_desc', detailKey: 'integrations.talkhub_detail', featuresKey: 'integrations.talkhub_features', icon: 'T', color: '#1976D2', requiredLicense: 'Basic', configRoute: '/configuration' },
  { id: 'vapi', name: 'VAPI', descKey: 'integrations.vapi_desc', detailKey: 'integrations.vapi_detail', featuresKey: 'integrations.vapi_features', icon: 'V', color: '#6C5CE7', requiredLicense: 'VAPI' },
  { id: 'odoo', name: 'Odoo', descKey: 'integrations.odoo_desc', detailKey: 'integrations.odoo_detail', featuresKey: 'integrations.odoo_features', icon: 'O', color: '#714B67', requiredLicense: 'Odoo' },
  { id: 'zoho', name: 'Zoho', descKey: 'integrations.zoho_desc', detailKey: 'integrations.zoho_detail', featuresKey: 'integrations.zoho_features', icon: 'Z', color: '#E42527', requiredLicense: 'Zoho' },
  { id: 'retell', name: 'Retell AI', descKey: 'integrations.retell_desc', detailKey: 'integrations.retell_detail', featuresKey: 'integrations.retell_features', icon: 'R', color: '#00B4D8', requiredLicense: 'Retell' },
  { id: 'bland', name: 'Bland AI', descKey: 'integrations.bland_desc', detailKey: 'integrations.bland_detail', featuresKey: 'integrations.bland_features', icon: 'B', color: '#2D3436', requiredLicense: 'Bland' },
  { id: 'hubspot', name: 'HubSpot', descKey: 'integrations.hubspot_desc', detailKey: 'integrations.hubspot_detail', featuresKey: 'integrations.hubspot_features', icon: 'H', color: '#FF7A59', requiredLicense: 'HubSpot' },
  { id: 'premium', name: 'Premium Support', descKey: 'integrations.premium_desc', detailKey: 'integrations.premium_detail', featuresKey: 'integrations.premium_features', icon: 'P', color: '#F1C40F', requiredLicense: 'Premium Support', configRoute: '/vip' },
];

export default function Integrations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);
  const [availableLicenses, setAvailableLicenses] = useState<AvailableLicense[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInteg, setSelectedInteg] = useState<Integration | null>(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [confirmInstall, setConfirmInstall] = useState<{ open: boolean; name: string; action: (() => Promise<void>) | null }>({ open: false, name: '', action: null });

  const notifyLicenseChanged = () => window.dispatchEvent(new Event('license-changed'));

  const load = useCallback(async () => {
    try {
      const res = await api.get('/license');
      setActiveFeatures(res.data?.active_features || []);
    } catch { /* ignore */ }
    try {
      const availRes = await api.get('/license/available');
      const all: AvailableLicense[] = availRes.data || [];
      setAvailableLicenses(all.filter((a) => !a.bound_to && !a.licensed && (!a.valid_until || new Date(a.valid_until) >= new Date())));
    } catch {
      setAvailableLicenses([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('license-changed', handler);
    return () => window.removeEventListener('license-changed', handler);
  }, [load]);

  const hasLicense = (integ: Integration) =>
    activeFeatures.includes(integ.requiredLicense);

  /** Find a free (unbound, not expired) available license for this integration */
  const findAvailable = (integ: Integration): AvailableLicense | undefined =>
    availableLicenses.find((a) => a.license_name === integ.requiredLicense);

  const requestInstall = (integ: Integration, al: AvailableLicense) => {
    setConfirmInstall({
      open: true,
      name: `${al.license_name} (${al.license_key})`,
      action: async () => {
        try {
          await api.put('/license', { license_key: al.license_key });
          setToast({ open: true, message: t('status.success'), severity: 'success' });
          load();
          notifyLicenseChanged();
        } catch (err: unknown) {
          const resp = (err as { response?: { data?: { message?: string } } })?.response?.data;
          if (resp?.message === 'license_duplicate') {
            setToast({ open: true, message: t('license.error_duplicate'), severity: 'error' });
          } else {
            setToast({ open: true, message: t('status.error'), severity: 'error' });
          }
        }
      },
    });
  };

  const handleConfirmInstall = async () => {
    const a = confirmInstall.action;
    setConfirmInstall({ open: false, name: '', action: null });
    if (a) await a();
  };

  const openDetail = (integ: Integration) => {
    setSelectedInteg(integ);
    setDetailOpen(true);
  };

  const features = (integ: Integration): string[] => {
    const raw = t(integ.featuresKey);
    return typeof raw === 'string' && raw ? raw.split('|') : [];
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {t('integrations.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('integrations.subtitle')}
      </Typography>

      {activeFeatures.length > 0 ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('integrations.has_license_hint', { count: activeFeatures.length })}
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('integrations.license_hint')}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
        {INTEGRATIONS.map((integ) => {
          const licensed = hasLicense(integ);
          const available = !licensed ? findAvailable(integ) : undefined;
          return (
            <Card
              key={integ.id}
              sx={{
                opacity: licensed ? 1 : 0.65,
                position: 'relative',
                transition: 'opacity 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                '&:hover': { opacity: 1, boxShadow: 4 },
              }}
              onClick={() => openDetail(integ)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: integ.color,
                      width: 48,
                      height: 48,
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    {integ.icon}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {integ.name}
                    </Typography>
                    <Chip
                      size="small"
                      icon={licensed ? <CheckCircleIcon /> : <LockIcon />}
                      label={licensed ? t('integrations.active') : available ? t('integrations.license_available') : t('integrations.no_license')}
                      color={licensed ? 'success' : available ? 'info' : 'default'}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                  {licensed && integ.configRoute && (
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); navigate(integ.configRoute!); }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                    >
                      <SettingsIcon />
                    </IconButton>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t(integ.descKey)}
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<OpenInNewIcon />}
                  onClick={(e) => { e.stopPropagation(); openDetail(integ); }}
                >
                  {t('integrations.details')}
                </Button>
                {licensed && integ.configRoute && (
                  <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); navigate(integ.configRoute!); }}>
                    {t('integrations.configure')}
                  </Button>
                )}
                {available && (
                  <Tooltip title={t('integrations.activate_now_tooltip')}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<AddCircleOutlineIcon />}
                      onClick={(e) => { e.stopPropagation(); requestInstall(integ, available); }}
                    >
                      {t('integrations.activate_now')}
                    </Button>
                  </Tooltip>
                )}
              </CardActions>
            </Card>
          );
        })}
      </Box>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        {selectedInteg && (() => {
          const licensed = hasLicense(selectedInteg);
          const feats = features(selectedInteg);
          const available = !licensed ? findAvailable(selectedInteg) : undefined;
          return (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: selectedInteg.color, width: 40, height: 40, fontSize: 18, fontWeight: 700 }}>
                  {selectedInteg.icon}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{selectedInteg.name}</Typography>
                  <Chip
                    size="small"
                    icon={licensed ? <CheckCircleIcon /> : <LockIcon />}
                    label={licensed ? t('integrations.active') : t('integrations.no_license')}
                    color={licensed ? 'success' : 'default'}
                  />
                </Box>
                <IconButton onClick={() => setDetailOpen(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {t(selectedInteg.detailKey)}
                </Typography>
                {feats.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      {t('integrations.features')}
                    </Typography>
                    <List dense disablePadding>
                      {feats.map((feat, i) => (
                        <ListItem key={i} disableGutters>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckIcon fontSize="small" color="success" />
                          </ListItemIcon>
                          <ListItemText primary={feat} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
                {!licensed && !available && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {t('integrations.requires_license')}
                  </Alert>
                )}
                {available && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    {t('integrations.available_license_hint')}
                  </Alert>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDetailOpen(false)}>{t('button.close')}</Button>
                {licensed && selectedInteg.configRoute && (
                  <Button variant="contained" onClick={() => { setDetailOpen(false); navigate(selectedInteg.configRoute!); }}>
                    {t('integrations.configure')}
                  </Button>
                )}
                {available && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={() => { setDetailOpen(false); requestInstall(selectedInteg, available); }}
                  >
                    {t('integrations.activate_now')}
                  </Button>
                )}
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      <ConfirmDialog open={confirmInstall.open} variant="save"
        title={t('license.install_title')}
        message={t('license.install_message', { name: confirmInstall.name })}
        confirmLabel={t('license.install')} cancelLabel={t('button.cancel')}
        onConfirm={handleConfirmInstall} onCancel={() => setConfirmInstall({ open: false, name: '', action: null })} />

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
