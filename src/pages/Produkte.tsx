/**
 * @file Produkte — 2 tabs: Meine Produkte (licenses) + Alle Produkte (catalog)
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Chip, Grid2 as Grid,
  CircularProgress, Button, Alert, LinearProgress, alpha, useTheme,
  TextField, InputAdornment,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import HubIcon from '@mui/icons-material/Hub';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DevicesIcon from '@mui/icons-material/Devices';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api/client';
import Toast from '../components/Toast';

// ── Types ──

interface ProductLicense {
  license_name: string; license_key: string; max_connections: number;
  expires_at: string | null; status: string; effective_status: string;
  days_left: number | null; expiring_soon: boolean;
  status_label: string; status_color: string;
}

interface Product {
  product: string; status: string;
  licenses: ProductLicense[];
}

interface CatalogProduct {
  id: number; product: string; subproduct: string; license_name: string;
  max_connections: number; type: string; description: string; sku: string;
  feature_slugs: string[]; feature_names: string[];
  category_slugs: string[]; category_names: string[];
}

interface Category {
  id: number; slug: string; name: string; product_count: number;
}

// ── Helpers ──

const statusConfig: Record<string, { color: 'success' | 'default' | 'warning' | 'error'; icon: React.ReactElement; label: string }> = {
  active:    { color: 'success',  icon: <CheckCircleIcon />,    label: 'dashboard.status_active' },
  pending:   { color: 'default',  icon: <HourglassEmptyIcon />, label: 'dashboard.status_pending' },
  grace:     { color: 'warning',  icon: <WarningAmberIcon />,   label: 'dashboard.status_grace' },
  suspended: { color: 'error',    icon: <BlockIcon />,          label: 'dashboard.status_suspended' },
};

function getProductIcon(name: string) {
  const l = name.toLowerCase();
  if (l.includes('talkhub')) return <PhoneInTalkIcon sx={{ fontSize: 40 }} />;
  if (l.includes('vapi')) return <HubIcon sx={{ fontSize: 40 }} />;
  if (l.includes('odoo')) return <StorefrontIcon sx={{ fontSize: 40 }} />;
  if (l.includes('crm') || l.includes('kommo') || l.includes('hubspot') || l.includes('pipedrive') || l.includes('salesforce')) return <HubIcon sx={{ fontSize: 40 }} />;
  if (l.includes('support')) return <SupportAgentIcon sx={{ fontSize: 40 }} />;
  if (l.includes('analytics') || l.includes('log')) return <AnalyticsIcon sx={{ fontSize: 40 }} />;
  return <DevicesIcon sx={{ fontSize: 40 }} />;
}

function getAccentColor(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('talkhub')) return '#6366f1';
  if (l.includes('vapi')) return '#0ea5e9';
  if (l.includes('odoo')) return '#22c55e';
  if (l.includes('crm') || l.includes('kommo') || l.includes('hubspot')) return '#f97316';
  if (l.includes('support')) return '#8b5cf6';
  if (l.includes('dms') || l.includes('eco') || l.includes('elo')) return '#14b8a6';
  return '#64748b';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'success.main';
    case 'grace': return 'warning.main';
    case 'suspended': return 'error.main';
    default: return 'text.disabled';
  }
}

export default function Produkte() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);

  // Tab 1: Meine Produkte
  const [products, setProducts] = useState<Product[]>([]);

  // Tab 2: Katalog
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ownedProducts, setOwnedProducts] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activating, setActivating] = useState('');
  const [showExpired, setShowExpired] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/products').catch(() => ({ data: [] })),
      api.get('/catalog').catch(() => ({ data: [] })),
      api.get('/categories').catch(() => ({ data: [] })),
    ]).then(([prodRes, catRes, catsRes]) => {
      setProducts(prodRes.data || []);
      setCatalog(catRes.data || []);
      setCategories((catsRes.data || []).filter((c: Category) => c.product_count > 0));
      const owned = new Set<string>();
      for (const p of (prodRes.data || [])) {
        if (p.product) owned.add(p.product);
      }
      setOwnedProducts(owned);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('tenant-switched', handler);
    return () => window.removeEventListener('tenant-switched', handler);
  }, [fetchAll]);

  const handleActivateProduct = async (product: string) => {
    setActivating(product);
    try {
      const res = await api.post('/products/activate', { product, days: 365 });
      setToast({ open: true, message: `${product} aktiviert — ${res.data.license_key}`, severity: 'success' });
      setOwnedProducts((prev) => new Set([...prev, product]));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
    setActivating('');
  };

  const handleActivateTrial = async (product: string, subproduct: string) => {
    setActivating(product);
    try {
      await api.post('/products/trial', { product, subproduct });
      setToast({ open: true, message: `Trial ${product} aktiviert`, severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: e?.response?.data?.detail || 'Error', severity: 'error' });
    }
    setActivating('');
  };

  // Expired filter
  const expiredCount = products.filter((p) => p.status === 'suspended' || p.status === 'expired').length;
  const visibleProducts = showExpired ? products : products.filter((p) => p.status !== 'suspended' && p.status !== 'expired');

  // Catalog grouping + filtering
  const filtered = activeCategory ? catalog.filter((p) => p.category_slugs?.includes(activeCategory)) : catalog;
  const grouped = filtered.reduce<Record<string, CatalogProduct[]>>((acc, p) => {
    if (!acc[p.product]) acc[p.product] = [];
    acc[p.product].push(p);
    return acc;
  }, {});

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{t('nav.catalog')}</Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 0 }}>
        <Tab label={`Alle Produkte (${Object.keys(grouped).length})`} />
        </Tabs>
        {tab === 0 && expiredCount > 0 && (
          <Button variant="text" size="small" onClick={() => setShowExpired(!showExpired)}
            sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            {showExpired ? 'Abgelaufene ausblenden' : `+ ${expiredCount} abgelaufen`}
          </Button>
        )}
      </Box>
      <Box sx={{ mb: 3 }} />

      {/* ── Tab 0: Meine Produkte ── */}
      {tab === 0 && (
        visibleProducts.length === 0 && expiredCount === 0 ? (
          <Card sx={{ textAlign: 'center' }}>
            <CardContent sx={{ py: 6 }}>
              <ShoppingCartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">{t('dashboard.no_products')}</Typography>
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => setTab(1)} startIcon={<ShoppingCartIcon />}>
                {t('nav.catalog')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {visibleProducts.map((product) => {
              const cfg = statusConfig[product.status] || statusConfig.pending;
              const bestLicense = product.licenses[0];
              const daysLeft = bestLicense?.days_left ?? null;
              const expiringSoon = bestLicense?.expiring_soon ?? false;
              const progressValue = daysLeft !== null && daysLeft >= 0 ? Math.min(100, (daysLeft / 30) * 100) : 0;
              const accent = getAccentColor(product.product);
              const isActive = product.status === 'active';
              const isGrace = product.status === 'grace';

              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={product.product}>
                  <Card sx={{
                    height: '100%', borderTop: 3, borderColor: getStatusColor(product.status),
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 }, transition: 'all 0.15s',
                  }}>
                    <CardContent sx={{ px: 3, py: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                        <Box sx={{ color: isActive ? 'primary.main' : 'text.disabled', p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, isActive ? 0.08 : 0.04), display: 'flex' }}>
                          {getProductIcon(product.product)}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>{product.product}</Typography>
                          {bestLicense && <Typography variant="body2" color="text.secondary" noWrap>{bestLicense.license_name}</Typography>}
                        </Box>
                        <Chip icon={cfg.icon} label={bestLicense?.status_label || t(cfg.label)}
                          color={bestLicense?.status_color === 'warning' ? 'warning' : bestLicense?.status_color === 'error' ? 'error' : bestLicense?.status_color === 'success' ? 'success' : cfg.color}
                          size="small" sx={{ fontWeight: 600, maxWidth: 200 }} />
                      </Box>

                      {bestLicense && bestLicense.max_connections > 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {bestLicense.max_connections} {t('dashboard.connections')}
                        </Typography>
                      )}

                      {bestLicense?.expires_at && (
                        <Box sx={{ mb: 1 }}>
                          <LinearProgress variant="determinate" value={progressValue}
                            color={isGrace ? 'warning' : expiringSoon ? 'error' : 'primary'}
                            sx={{ height: 6, borderRadius: 3, mb: 0.5 }} />
                          <Typography variant="caption" color={bestLicense.status_color === 'success' ? 'text.secondary' : 'warning.main'}>
                            {new Date(bestLicense.expires_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      )}

                      {(product.status === 'grace' || product.status === 'suspended') && (
                        <Button size="small" variant="contained" color="warning" fullWidth
                          onClick={() => setTab(1)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                          Neue Lizenz kaufen
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )
      )}

      {/* ── Tab 1: Alle Produkte (Katalog) ── */}
      {tab === 1 && (
        <>
          {categories.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              <Chip label={t('catalog.all')} onClick={() => setActiveCategory(null)}
                color={activeCategory === null ? 'primary' : 'default'} variant={activeCategory === null ? 'filled' : 'outlined'} />
              {categories.map((cat) => (
                <Chip key={cat.slug} label={`${cat.name} (${cat.product_count})`}
                  onClick={() => setActiveCategory(activeCategory === cat.slug ? null : cat.slug)}
                  color={activeCategory === cat.slug ? 'primary' : 'default'}
                  variant={activeCategory === cat.slug ? 'filled' : 'outlined'} />
              ))}
            </Box>
          )}

          {Object.keys(grouped).length === 0 ? (
            <Alert severity="info">{t('catalog.empty')}</Alert>
          ) : (
            <Grid container spacing={3}>
              {Object.entries(grouped).map(([productName, items]) => {
                const trials = items.filter((p) => p.type === 'trial');
                const clientPlans = items.filter((p) => p.type === 'client');
                const hasTrial = trials.length > 0;
                const isOwned = ownedProducts.has(productName);
                const accent = getAccentColor(productName);
                const allFeatures = [...new Set(items.flatMap((i) => i.feature_names || []))];
                const description = items.find((i) => i.description)?.description || '';
                const maxConn = Math.max(...clientPlans.map((p) => p.max_connections), 0);

                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={productName}>
                    <Card sx={{
                      height: '100%', display: 'flex', flexDirection: 'column',
                      borderTop: 4, borderColor: isOwned ? 'success.main' : accent,
                      '&:hover': { transform: 'translateY(-3px)', boxShadow: 8 }, transition: 'all 0.15s',
                    }}>
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 3, py: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Box sx={{ color: accent, p: 1.5, borderRadius: 2, bgcolor: alpha(accent, 0.08), display: 'flex' }}>
                            {getProductIcon(productName)}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{productName}</Typography>
                              {isOwned && <Chip icon={<CheckCircleIcon />} label={t('dashboard.status_active')} size="small" color="success" sx={{ fontWeight: 600 }} />}
                            </Box>
                            {clientPlans.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                {clientPlans.length} {t('catalog.plans')}{maxConn > 0 ? ` · max ${maxConn} conn` : ''}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>{description}</Typography>}

                        {clientPlans.length > 0 && (
                          <Box sx={{ mb: 2, flex: 1 }}>
                            {clientPlans.map((plan) => (
                              <Box key={plan.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, px: 1.5, mb: 0.5, borderRadius: 1, bgcolor: alpha(theme.palette.text.primary, 0.02), '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) } }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{plan.subproduct}</Typography>
                                  <Typography variant="caption" color="text.secondary">{plan.license_name}</Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{plan.max_connections > 0 ? plan.max_connections : '—'}</Typography>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {allFeatures.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                            {allFeatures.map((f) => (
                              <Chip key={f} label={f} size="small" sx={{ fontSize: 11, height: 22, bgcolor: alpha(accent, 0.08), color: accent, fontWeight: 500 }} />
                            ))}
                          </Box>
                        )}

                        <Box sx={{ mt: 'auto', pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                          {isOwned ? (
                            <Button variant="contained" fullWidth startIcon={activating === productName ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
                              disabled={!!activating} onClick={() => handleActivateProduct(productName)}
                              sx={{ bgcolor: accent, '&:hover': { bgcolor: alpha(accent, 0.85) }, textTransform: 'none', fontWeight: 600 }}>
                              {t('catalog.upgrade')}
                            </Button>
                          ) : !hasTrial && clientPlans.length > 0 && clientPlans[0].max_connections === 0 ? (
                            <Button variant="contained" fullWidth startIcon={activating === productName ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
                              disabled={!!activating} onClick={() => handleActivateProduct(productName)}
                              sx={{ bgcolor: accent, '&:hover': { bgcolor: alpha(accent, 0.85) }, textTransform: 'none', fontWeight: 600 }}>
                              Jetzt aktivieren · 1 Jahr
                            </Button>
                          ) : hasTrial ? (
                            <Button variant="contained" fullWidth startIcon={activating === productName ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
                              disabled={!!activating} onClick={() => handleActivateTrial(productName, trials[0].subproduct)}
                              sx={{ bgcolor: accent, '&:hover': { bgcolor: alpha(accent, 0.85) }, textTransform: 'none', fontWeight: 600 }}>
                              {t('catalog.start_trial')} · 7 {t('dashboard.status_active') === 'Aktiv' ? 'Tage kostenlos' : 'days free'}
                            </Button>
                          ) : (
                            <Button variant="outlined" fullWidth sx={{ textTransform: 'none', fontWeight: 500 }}>
                              {t('catalog.contact_sales')}
                            </Button>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
