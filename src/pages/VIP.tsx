/**
 * @file VIP — Premium features page (visible only with Test license)
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Chip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';

export default function VIP() {
  const { t } = useTranslation();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <StarIcon sx={{ fontSize: 32, color: 'warning.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t('vip.title')}
        </Typography>
        <Chip label={t('vip.premium')} color="warning" size="small" />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('vip.subtitle')}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              {t('vip.feature_priority')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('vip.feature_priority_desc')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              {t('vip.feature_analytics')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('vip.feature_analytics_desc')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              {t('vip.feature_support')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('vip.feature_support_desc')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              {t('vip.feature_api')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('vip.feature_api_desc')}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
