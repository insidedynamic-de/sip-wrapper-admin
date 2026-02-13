/**
 * @file CodecCard — Audio/video codec preferences with checkbox grid
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useTranslation } from 'react-i18next';
import {
  Card, CardContent, Typography, Box, Checkbox, FormControlLabel, Chip, Divider,
} from '@mui/material';

/** Audio codecs available */
const AUDIO_CODECS = [
  { id: 'OPUS', label: 'OPUS', desc: '48 kHz, wideband' },
  { id: 'G722', label: 'G.722', desc: '16 kHz, wideband' },
  { id: 'PCMU', label: 'PCMU (G.711u)', desc: '8 kHz, North America' },
  { id: 'PCMA', label: 'PCMA (G.711a)', desc: '8 kHz, Europe' },
  { id: 'G729', label: 'G.729', desc: '8 kHz, compressed' },
  { id: 'GSM', label: 'GSM', desc: '8 kHz, mobile' },
  { id: 'G726-32', label: 'G.726-32', desc: '8 kHz, 32 kbit/s' },
  { id: 'iLBC', label: 'iLBC', desc: '8 kHz, packet loss tolerant' },
  { id: 'SILK', label: 'SILK', desc: 'Variable rate, Skype' },
];

/** Video codecs available */
const VIDEO_CODECS = [
  { id: 'VP8', label: 'VP8', desc: 'Video codec' },
  { id: 'H264', label: 'H.264', desc: 'Video codec' },
  { id: 'H263', label: 'H.263', desc: 'Video codec (legacy)' },
];

/** All codecs combined (order matters for preference string) */
const ALL_CODECS = [...AUDIO_CODECS, ...VIDEO_CODECS];

/** Grid styles shared by audio and video codec sections */
const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', md: '1fr 1fr 1fr 1fr' },
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
};

const CELL_SX = {
  px: 1.5, py: 1,
  borderRight: 1, borderBottom: 1, borderColor: 'divider',
  display: 'flex', alignItems: 'center',
};

interface Props {
  codecPrefs: string;
  onChange: (value: string) => void;
}

export default function CodecCard({ codecPrefs, onChange }: Props) {
  const { t } = useTranslation();

  const activeCodecs = new Set(
    codecPrefs.split(',').map((c) => c.trim()).filter(Boolean),
  );

  const toggleCodec = (codecId: string) => {
    const next = new Set(activeCodecs);
    if (next.has(codecId)) {
      next.delete(codecId);
    } else {
      next.add(codecId);
    }
    const ordered = ALL_CODECS.filter((c) => next.has(c.id)).map((c) => c.id);
    onChange(ordered.join(','));
  };

  const renderGrid = (codecs: typeof AUDIO_CODECS) => (
    <Box sx={GRID_SX}>
      {codecs.map((codec) => (
        <Box key={codec.id} sx={CELL_SX}>
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Checkbox
                checked={activeCodecs.has(codec.id)}
                onChange={() => toggleCodec(codec.id)}
                size="small"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{codec.label}</Typography>
                <Typography variant="caption" color="text.secondary">{codec.desc}</Typography>
              </Box>
            }
          />
        </Box>
      ))}
    </Box>
  );

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ px: 4, py: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t('system.codec_prefs')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('system.codec_prefs_desc')}
        </Typography>

        {/* Active codecs as ordered chips */}
        {activeCodecs.size > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
            {ALL_CODECS.filter((c) => activeCodecs.has(c.id)).map((c, idx) => (
              <Chip key={c.id} label={`${idx + 1}. ${c.label}`} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Audio codecs */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Audio</Typography>
        {renderGrid(AUDIO_CODECS)}

        <Divider sx={{ my: 2 }} />

        {/* Video codecs */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Video</Typography>
        {renderGrid(VIDEO_CODECS)}
      </CardContent>
    </Card>
  );
}
