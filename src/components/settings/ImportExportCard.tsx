/**
 * @file ImportExportCard — Config import/export actions
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../api/client';

interface Props {
  onToast: (message: string, ok: boolean) => void;
  onReload: () => void;
}

export default function ImportExportCard({ onToast, onReload }: Props) {
  const { t } = useTranslation();

  const exportConfig = async () => {
    const res = await api.get('/config/export');
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sip_wrapper_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/config/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onToast(res.data?.message || t('status.success'), res.data?.success);
      onReload();
    } catch {
      onToast(t('status.error'), false);
    }
    e.target.value = '';
  };

  return (
    <Card>
      <CardContent sx={{ px: 4, py: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t('config.import_export')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('config.export_desc')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportConfig}>
            {t('config.export_json')}
          </Button>
          <Button variant="outlined" component="label" startIcon={<UploadIcon />}>
            {t('config.import_json')}
            <input type="file" hidden accept=".json" onChange={importConfig} />
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
