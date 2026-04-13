/**
 * @file SaasDashboard — Instances overview
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip, Grid2 as Grid,
  CircularProgress, Button,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import HubIcon from '@mui/icons-material/Hub';
import DevicesIcon from '@mui/icons-material/Devices';
import api from '../api/client';
import { getUserFromToken } from '../store/auth';

interface Instance {
  id: number;
  product: string;
  name: string;
  domain: string;
  instance_url: string;
  status: string;
  max_connections: number;
}

function getIcon(name: string) {
  const l = name.toLowerCase();
  if (l.includes('talkhub')) return <PhoneInTalkIcon sx={{ fontSize: 32 }} />;
  if (l.includes('vapi') || l.includes('crm') || l.includes('hub')) return <HubIcon sx={{ fontSize: 32 }} />;
  return <DevicesIcon sx={{ fontSize: 32 }} />;
}

export default function SaasDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getUserFromToken();

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get('/my-instances').then((res) => {
      setInstances(res.data || []);
    }).catch(() => setInstances([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('tenant-switched', handler);
    return () => window.removeEventListener('tenant-switched', handler);
  }, [fetchData]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">{t('dashboard.title')}</Typography>
          {user && <Typography variant="body2" color="text.secondary">{user.email}</Typography>}
        </Box>
        <Button variant="outlined" size="small" startIcon={<ShoppingCartIcon />} onClick={() => navigate('/produkte')}>
          {t('nav.catalog')}
        </Button>
      </Box>

      {instances.length === 0 ? (
        <Card sx={{ textAlign: 'center' }}>
          <CardContent sx={{ py: 8 }}>
            <DevicesIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Keine Instanzen
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Bestellen Sie ein Produkt und starten Sie eine Instanz.
            </Typography>
            <Button variant="contained" startIcon={<ShoppingCartIcon />} onClick={() => navigate('/produkte')}>
              {t('nav.catalog')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {instances.map((inst) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={inst.id}>
              <Card sx={{
                height: '100%', borderLeft: 4,
                borderColor: inst.status === 'online' ? 'success.main' : inst.status === 'provisioning' ? 'warning.main' : 'error.main',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 }, transition: 'all 0.15s',
              }}>
                <CardContent sx={{ px: 3, py: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                    <Box sx={{ color: inst.status === 'online' ? 'primary.main' : 'text.disabled', display: 'flex' }}>
                      {getIcon(inst.product)}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{inst.product.replace('Linkify ', '')}</Typography>
                      <Typography variant="caption" color="text.secondary">{inst.name}</Typography>
                    </Box>
                    <Chip label={inst.status} size="small"
                      color={inst.status === 'online' ? 'success' : inst.status === 'provisioning' ? 'warning' : 'default'}
                      onClick={inst.status === 'online' ? () => navigate(`/products/talkhub/${inst.id}`) : undefined}
                      sx={inst.status === 'online' ? { cursor: 'pointer' } : undefined} />
                  </Box>

                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary', mb: 1 }}>
                    {inst.domain}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                    {inst.max_connections > 0 && (
                      <Chip label={`max. ${inst.max_connections} Nebenstellen`} size="small" />
                    )}
                    {(inst as any).version && (
                      <Chip label={`v${(inst as any).version}`} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                    )}
                    {(inst as any).update_available && (
                      <Chip label={`Update: v${(inst as any).latest_version}`} size="small" color="warning" />
                    )}
                  </Box>

                  <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {inst.status === 'online' ? (
                      <Button size="small" variant="contained" fullWidth
                        onClick={() => navigate(`/products/talkhub/${inst.id}`)}
                        sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Konfigurieren
                      </Button>
                    ) : inst.status === 'provisioning' ? (
                      <Button size="small" variant="outlined" fullWidth disabled
                        startIcon={<CircularProgress size={14} />}
                        sx={{ textTransform: 'none' }}>
                        Wird bereitgestellt...
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', mb: 0.5 }}>
                        Offline
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button size="small" variant="outlined" sx={{ flex: 1, textTransform: 'none', fontSize: 11 }}
                        onClick={async () => {
                          try {
                            await api.post(`/admin/infra/instances/${inst.id}/update`);
                            fetchData();
                          } catch { /* ignore */ }
                        }}>Update</Button>
                      <Button size="small" variant="outlined" color="warning" sx={{ flex: 1, textTransform: 'none', fontSize: 11 }}
                        onClick={async () => {
                          try {
                            await api.post(`/admin/infra/instances/${inst.id}/restart`);
                            fetchData();
                          } catch { /* ignore */ }
                        }}>Restart</Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
