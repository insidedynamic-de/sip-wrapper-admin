/**
 * @file ProductCatalog — Browse available products, activate trials
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, Typography, Button, Grid2 as Grid,
  CircularProgress, Alert, Chip, alpha, useTheme,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import HubIcon from '@mui/icons-material/Hub';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DevicesIcon from '@mui/icons-material/Devices';
import api from '../api/client';
import Toast from '../components/Toast';

interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  product_count: number;
}

interface CatalogProduct {
  id: number;
  product: string;
  subproduct: string;
  license_name: string;
  max_connections: number;
  type: string;
  features: string;
  description: string;
  sku: string;
  feature_slugs: string[];
  feature_names: string[];
  category_slugs: string[];
  category_names: string[];
}

function getProductIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('talkhub'))   return <PhoneInTalkIcon sx={{ fontSize: 48 }} />;
  if (lower.includes('vapi'))      return <HubIcon sx={{ fontSize: 48 }} />;
  if (lower.includes('odoo'))      return <StorefrontIcon sx={{ fontSize: 48 }} />;
  if (lower.includes('crm'))       return <HubIcon sx={{ fontSize: 48 }} />;
  if (lower.includes('support'))   return <SupportAgentIcon sx={{ fontSize: 48 }} />;
  if (lower.includes('analytics')) return <AnalyticsIcon sx={{ fontSize: 48 }} />;
  return <DevicesIcon sx={{ fontSize: 48 }} />;
}

/** Distinct color per product for top accent */
function getAccentColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('talkhub')) return '#6366f1';
  if (lower.includes('vapi'))    return '#0ea5e9';
  if (lower.includes('odoo'))    return '#22c55e';
  if (lower.includes('crm'))     return '#f97316';
  if (lower.includes('support')) return '#8b5cf6';
  return '#64748b';
}

export default function ProductCatalog() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ownedProducts, setOwnedProducts] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });

  const fetchCatalog = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/catalog').catch(() => ({ data: [] })),
      api.get('/categories').catch(() => ({ data: [] })),
      api.get('/products').catch(() => ({ data: [] })),
    ]).then(([catRes, catsRes, myRes]) => {
      setProducts(catRes.data || []);
      setCategories((catsRes.data || []).filter((c: Category) => c.product_count > 0));
      const owned = new Set<string>();
      for (const p of (myRes.data || [])) {
        if (p.product) owned.add(p.product);
      }
      setOwnedProducts(owned);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  useEffect(() => {
    const handler = () => fetchCatalog();
    window.addEventListener('tenant-switched', handler);
    return () => window.removeEventListener('tenant-switched', handler);
  }, [fetchCatalog]);

  // Filter by active category
  const filtered = activeCategory
    ? products.filter((p) => p.category_slugs?.includes(activeCategory))
    : products;

  // Group by product name
  const grouped = filtered.reduce<Record<string, CatalogProduct[]>>((acc, p) => {
    if (!acc[p.product]) acc[p.product] = [];
    acc[p.product].push(p);
    return acc;
  }, {});

  const handleActivateTrial = async (product: string, subproduct: string) => {
    setActivating(product);
    try {
      const res = await api.post('/products/trial', { product, subproduct });
      setToast({
        open: true,
        message: `Trial ${res.data.product} — ${res.data.license_key} (${t('dashboard.expires')}: ${new Date(res.data.expires_at).toLocaleDateString()})`,
        severity: 'success',
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setToast({
        open: true,
        message: axiosErr?.response?.data?.detail || t('status.error'),
        severity: 'error',
      });
    }
    setActivating('');
  };

  const handleActivateProduct = async (product: string) => {
    setActivating(product);
    try {
      const res = await api.post('/products/activate', { product, days: 365 });
      if (res.data.already_active) {
        setToast({ open: true, message: `${product} already active (${res.data.license_key})`, severity: 'info' });
      } else {
        setToast({ open: true, message: `${product} activated — ${res.data.license_key} (1 Jahr)`, severity: 'success' });
        setOwnedProducts((prev) => new Set([...prev, product]));
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setToast({ open: true, message: axiosErr?.response?.data?.detail || t('status.error'), severity: 'error' });
    }
    setActivating('');
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>{t('catalog.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('catalog.desc')}
      </Typography>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          <Chip
            label={t('catalog.all') || 'Alle'}
            onClick={() => setActiveCategory(null)}
            color={activeCategory === null ? 'primary' : 'default'}
            variant={activeCategory === null ? 'filled' : 'outlined'}
          />
          {categories.map((cat) => (
            <Chip
              key={cat.slug}
              label={`${cat.name} (${cat.product_count})`}
              onClick={() => setActiveCategory(activeCategory === cat.slug ? null : cat.slug)}
              color={activeCategory === cat.slug ? 'primary' : 'default'}
              variant={activeCategory === cat.slug ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      )}

      {products.length === 0 ? (
        <Alert severity="info">{t('catalog.empty')}</Alert>
      ) : (
        <Grid container spacing={3}>
          {Object.entries(grouped).map(([productName, items]) => {
            const trials = items.filter((p) => p.type === 'trial');
            const clientPlans = items.filter((p) => p.type === 'client');
            const hasTrial = trials.length > 0;
            const accent = getAccentColor(productName);
            const isOwned = ownedProducts.has(productName);
            const allFeatures = [...new Set(items.flatMap((i) => i.feature_names || []))];
            const description = items.find((i) => i.description)?.description || '';
            const maxConn = Math.max(...clientPlans.map((p) => p.max_connections), 0);

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={productName}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderTop: 4,
                    borderColor: isOwned ? 'success.main' : accent,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: 8,
                    },
                  }}
                >
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 3, py: 2.5 }}>
                    {/* Icon + Name */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{
                        color: accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha(accent, 0.08),
                      }}>
                        {getProductIcon(productName)}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                            {productName}
                          </Typography>
                          {isOwned && (
                            <Chip icon={<CheckCircleIcon />} label={t('dashboard.status_active')} size="small" color="success" sx={{ fontWeight: 600 }} />
                          )}
                        </Box>
                        {clientPlans.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {clientPlans.length} {t('catalog.plans')}
                            {maxConn > 0 ? ` · ${t('dashboard.connections')}: ${maxConn}` : ''}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Description */}
                    {description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                        {description}
                      </Typography>
                    )}

                    {/* Plans list */}
                    {clientPlans.length > 0 && (
                      <Box sx={{ mb: 2, flex: 1 }}>
                        {clientPlans.map((plan) => (
                          <Box
                            key={plan.id}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              py: 0.75,
                              px: 1.5,
                              mb: 0.5,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.text.primary, 0.02),
                              '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                            }}
                          >
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {plan.subproduct}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {plan.license_name}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {plan.max_connections > 0 ? plan.max_connections : '—'}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}

                    {/* Features */}
                    {allFeatures.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                        {allFeatures.map((f) => (
                          <Chip
                            key={f}
                            label={f}
                            size="small"
                            sx={{
                              fontSize: 11,
                              height: 22,
                              bgcolor: alpha(accent, 0.08),
                              color: accent,
                              fontWeight: 500,
                            }}
                          />
                        ))}
                      </Box>
                    )}

                    {/* Trial button */}
                    <Box sx={{ mt: 'auto', pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                      {isOwned ? (
                        <Button variant="outlined" fullWidth sx={{ textTransform: 'none', fontWeight: 500 }}>
                          {t('catalog.upgrade') || 'Upgrade / Ändern'}
                        </Button>
                      ) : !hasTrial && clientPlans.length > 0 && clientPlans[0].max_connections === 0 ? (
                        /* Instant-activate products (Logs, Support, etc.) */
                        <Button variant="contained" fullWidth
                          startIcon={activating === productName ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
                          disabled={!!activating}
                          onClick={() => handleActivateProduct(productName)}
                          sx={{ bgcolor: accent, '&:hover': { bgcolor: alpha(accent, 0.85) }, textTransform: 'none', fontWeight: 600 }}>
                          Jetzt aktivieren · 1 Jahr
                        </Button>
                      ) : hasTrial ? (
                        <Button
                          variant="contained"
                          fullWidth
                          startIcon={activating === productName ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
                          disabled={!!activating}
                          onClick={() => handleActivateTrial(productName, trials[0].subproduct)}
                          sx={{
                            bgcolor: accent,
                            '&:hover': { bgcolor: alpha(accent, 0.85) },
                            textTransform: 'none',
                            fontWeight: 600,
                          }}
                        >
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

      <Toast open={toast.open} message={toast.message} severity={toast.severity} onClose={() => setToast({ ...toast, open: false })} />
    </Box>
  );
}
