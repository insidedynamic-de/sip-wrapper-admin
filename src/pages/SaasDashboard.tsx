/**
 * @file SaasDashboard — Product cards with license statuses (styled)
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip, Grid2 as Grid,
  CircularProgress, Alert, IconButton, Tooltip, LinearProgress,
  Button, alpha, useTheme,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import HubIcon from '@mui/icons-material/Hub';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import api from '../api/client';
import { getUserFromToken } from '../store/auth';

interface ProductLicense {
  id: number;
  license_key: string;
  product: string;
  subproduct: string;
  license_name: string;
  max_connections: number;
  expires_at: string | null;
  status: string;
  effective_status: string;
  days_left: number | null;
  expiring_soon: boolean;
}

interface Product {
  product: string;
  status: 'pending' | 'active' | 'grace' | 'suspended';
  licenses: ProductLicense[];
}

const statusConfig = {
  active:    { color: 'success'  as const, icon: <CheckCircleIcon />,    label: 'dashboard.status_active' },
  pending:   { color: 'default'  as const, icon: <HourglassEmptyIcon />, label: 'dashboard.status_pending' },
  grace:     { color: 'warning'  as const, icon: <WarningAmberIcon />,   label: 'dashboard.status_grace' },
  suspended: { color: 'error'    as const, icon: <BlockIcon />,          label: 'dashboard.status_suspended' },
};

/** Map product name to an icon */
function getProductIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('talkhub'))   return <PhoneInTalkIcon sx={{ fontSize: 40 }} />;
  if (lower.includes('vapi'))      return <HubIcon sx={{ fontSize: 40 }} />;
  if (lower.includes('odoo'))      return <StorefrontIcon sx={{ fontSize: 40 }} />;
  if (lower.includes('crm'))       return <HubIcon sx={{ fontSize: 40 }} />;
  if (lower.includes('support'))   return <SupportAgentIcon sx={{ fontSize: 40 }} />;
  if (lower.includes('analytics')) return <AnalyticsIcon sx={{ fontSize: 40 }} />;
  return <HubIcon sx={{ fontSize: 40 }} />;
}

/** Status color for MUI theme */
function getStatusColor(status: string): string {
  switch (status) {
    case 'active':    return 'success.main';
    case 'grace':     return 'warning.main';
    case 'suspended': return 'error.main';
    default:          return 'text.disabled';
  }
}

export default function SaasDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getUserFromToken();

  const fetchProducts = useCallback(() => {
    setLoading(true);
    api.get('/products').then((res) => {
      setProducts(res.data || []);
    }).catch(() => {
      setProducts([]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Re-fetch on tenant switch
  useEffect(() => {
    const handler = () => fetchProducts();
    window.addEventListener('tenant-switched', handler);
    return () => window.removeEventListener('tenant-switched', handler);
  }, [fetchProducts]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">{t('dashboard.title')}</Typography>
          {user && (
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ShoppingCartIcon />}
          onClick={() => navigate('/catalog')}
        >
          {t('nav.catalog')}
        </Button>
      </Box>

      {products.length === 0 ? (
        <Card sx={{ textAlign: 'center' }}>
          <CardContent sx={{ py: 8 }}>
            <ShoppingCartIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {t('dashboard.no_products')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('dashboard.no_products_desc')}
            </Typography>
            <Button variant="contained" startIcon={<ShoppingCartIcon />} onClick={() => navigate('/catalog')}>
              {t('nav.catalog')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {products.map((product) => {
            const cfg = statusConfig[product.status] || statusConfig.pending;
            const activeLicense = product.licenses.find((l) => l.effective_status === 'active');
            const bestLicense = activeLicense || product.licenses[0];
            const isActive = product.status === 'active';
            const isGrace = product.status === 'grace';

            // Days left from API
            const daysLeft = bestLicense?.days_left ?? null;
            const expiringSoon = bestLicense?.expiring_soon ?? false;

            // Progress bar
            const progressValue = daysLeft !== null ? Math.min(100, Math.max(0, (daysLeft / 30) * 100)) : 100;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={product.product}>
                <Card
                  sx={{
                    height: '100%',
                    position: 'relative',
                    borderTop: 3,
                    borderColor: getStatusColor(product.status),
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 6,
                    },
                  }}
                >
                  <CardContent sx={{ px: 3, py: 2.5 }}>
                    {/* Header: Icon + Name + Status */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Box sx={{
                        color: isActive ? 'primary.main' : 'text.disabled',
                        display: 'flex',
                        alignItems: 'center',
                        p: 1,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, isActive ? 0.08 : 0.04),
                      }}>
                        {getProductIcon(product.product)}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                          {product.product}
                        </Typography>
                        {bestLicense && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {bestLicense.subproduct}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip icon={cfg.icon} label={t(cfg.label)} color={cfg.color} size="small" sx={{ fontWeight: 600 }} />
                        {expiringSoon && (
                          <Chip label={`${daysLeft}d`} color="warning" size="small" sx={{ fontWeight: 600, fontSize: 11 }} />
                        )}
                      </Box>
                    </Box>

                    {/* License details */}
                    {bestLicense && (
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {bestLicense.license_name}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {bestLicense.max_connections > 0 ? `${bestLicense.max_connections} ${t('dashboard.connections')}` : ''}
                          </Typography>
                        </Box>

                        {/* Expiry progress bar */}
                        {daysLeft !== null && (
                          <Box>
                            <LinearProgress
                              variant="determinate"
                              value={progressValue}
                              color={isGrace ? 'warning' : expiringSoon ? 'error' : 'primary'}
                              sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                            />
                            <Typography variant="caption" color={isGrace || expiringSoon ? 'warning.main' : 'text.secondary'}>
                              {daysLeft > 0
                                ? `${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'} — ${new Date(bestLicense.expires_at!).toLocaleDateString()}`
                                : t('dashboard.status_suspended')
                              }
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Suspended / Grace warning */}
                    {product.status === 'suspended' && (
                      <Alert severity="error" sx={{ mb: 1, py: 0.5 }}>
                        <Typography variant="caption">
                          Lizenz abgelaufen und Karenzzeit überschritten. Produkt gesperrt.
                          Bitte erneuern Sie Ihre Lizenz um fortzufahren.
                        </Typography>
                      </Alert>
                    )}
                    {product.status === 'grace' && (
                      <Alert severity="warning" sx={{ mb: 1, py: 0.5 }}>
                        <Typography variant="caption">
                          Lizenz abgelaufen — Karenzzeit läuft ({daysLeft !== null ? `noch ${daysLeft} Tage` : ''}).
                          Bitte erneuern Sie Ihre Lizenz.
                        </Typography>
                      </Alert>
                    )}

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Tooltip title={t('dashboard.configure')}>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/products/${product.product.toLowerCase().replace(/\s+/g, '-')}`)}
                          sx={{ color: 'text.secondary' }}
                        >
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {isActive && (
                        <Tooltip title={t('dashboard.launch_instance')}>
                          <IconButton size="small" color="success">
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Box sx={{ flex: 1 }} />
                      {product.licenses.length > 1 && (
                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                          {product.licenses.length} {t('nav.licenses')}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
