/**
 * @file GatewayNode — Custom React Flow node for SIP gateways
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps} from '@xyflow/react';
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

  return (
    <Box
      sx={{
        minWidth: 160,
        border: 2,
        borderColor: d.isDefault ? 'primary.main' : 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        p: 1.5,
        opacity: d.enabled ? 1 : 0.45,
        position: 'relative',
      }}
    >
      {/* Handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{ background: '#1976d2', width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{ background: '#ed6c02', width: 8, height: 8 }}
      />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <RouterIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, flex: 1 }}>
          {d.label}
        </Typography>
        {d.isDefault && <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
      </Box>

      {/* Type + Status */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: d.outboundPatterns.length > 0 ? 0.5 : 0 }}>
        <Chip size="small" label={d.type} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
        <Chip
          size="small"
          label={d.enabled ? d.status : 'OFF'}
          color={d.enabled ? statusColor(d.status) : 'default'}
          sx={{ height: 20, fontSize: 10 }}
        />
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
