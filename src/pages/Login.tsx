import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
} from '@mui/material';
import api from '../api/client';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      const res = await api.get('/health', { headers: { 'X-API-Key': apiKey } });
      if (res.data.status === 'ok') {
        localStorage.setItem('api_key', apiKey);
        navigate('/');
      }
    } catch {
      setError(t('status.access_denied'));
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Card sx={{ width: 400, p: 2 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
            SIP Wrapper
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            sx={{ mb: 2 }}
          />
          <Button fullWidth variant="contained" onClick={handleLogin}>
            {t('auth.login')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
