/**
 * @file GatewayNode — Custom React Flow node for SIP gateways with live status
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Box, Typography, Chip } from '@mui/material';
import RouterIcon from '@mui/icons-material/Router';
import StarIcon from '@mui/icons-material/Star';
import type { GatewayNodeData } from './useRoutingNodes';

const statusColor = (state: string): 'success' | 'error' | 'warning' | 'default' => {
  if (state === 'REGED') return 'success';
  if (state === 'FAIL' || state === 'NOREG') return 'error';
  if (state === 'UNKNOWN') return 'default';
  return 'warning';
};

function GatewayNodeComponent({ data }: NodeProps) {
  const d = data as unknown as GatewayNodeData;
  const isRegistered = d.status === 'REGED';

  return (
    <Box
      sx={{
        minWidth: 170,
        border: 2,
        borderColor: d.isDefault ? 'primary.main' : 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        p: 1.5,
        opacity: d.enabled ? 1 : 0.45,
        position: 'relative',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: 'grab',
        '&:hover': {
          boxShadow: 4,
          borderColor: 'primary.light',
        },
      }}
    >
      {/* Handles — larger for easier drag-to-connect */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{
          background: '#1976d2',
          width: 12,
          height: 12,
          border: '2px solid #fff',
          right: -6,
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{
          background: '#ed6c02',
          width: 12,
          height: 12,
          border: '2px solid #fff',
          left: -6,
        }}
      />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <RouterIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, flex: 1 }}>
          {d.label}
        </Typography>
        {d.isDefault && <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
      </Box>

      {/* Type + Status with pulsing dot */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: d.outboundPatterns.length > 0 ? 0.5 : 0 }}>
        <Chip size="small" label={d.type} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          {/* Pulsing status dot */}
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: isRegistered ? 'success.main' : d.status === 'FAIL' ? 'error.main' : 'grey.500',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.5, transform: 'scale(0.8)' },
              },
              animation: d.enabled ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          />
          <Chip
            size="small"
            label={d.enabled ? d.status : 'OFF'}
            color={d.enabled ? statusColor(d.status) : 'default'}
            sx={{ height: 20, fontSize: 10 }}
          />
        </Box>
      </Box>

      {/* Outbound patterns */}
      {d.outboundPatterns.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.3, flexWrap: 'wrap' }}>
          {d.outboundPatterns.map((p) => (
            <Chip
              key={p}
              size="small"
              label={p}
              sx={{ height: 18, fontSize: 9, fontFamily: 'monospace', bgcolor: 'action.hover' }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default memo(GatewayNodeComponent);
