/**
 * @file DemoRibbon — Diagonal "DEMO" corner ribbon (top-right) with info modal
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';

const RIBBON_COLOR = '#8B0000';

export default function DemoRibbon() {
  const { t } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      {/* Diagonal corner ribbon — top right */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          zIndex: 9999,
          overflow: 'hidden',
          width: 200,
          height: 200,
          pointerEvents: 'none',
        }}
      >
        {/* The rotated ribbon strip */}
        <Box
          sx={{
            position: 'absolute',
            top: 40,
            right: -50,
            width: 260,
            transform: 'rotate(45deg)',
            bgcolor: RIBBON_COLOR,
            color: '#fff',
            py: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 10px,
              rgba(255,255,255,0.05) 10px,
              rgba(255,255,255,0.05) 20px
            )`,
            pointerEvents: 'auto',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            DEMO
            <IconButton
              size="small"
              onClick={() => setInfoOpen(true)}
              sx={{
                color: 'rgba(255,255,255,0.7)',
                p: 0.25,
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' },
              }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Info modal */}
      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t('demo.info_title')}
          </Typography>
          <IconButton size="small" onClick={() => setInfoOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('demo.info_text_1')}
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('demo.info_text_2')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('demo.info_text_3')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)}>{t('button.close')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
