/**
 * @file ExtUserNode — Custom React Flow node for merged Extension + User with interactive styling
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Box, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import StarIcon from '@mui/icons-material/Star';
import type { ExtUserNodeData } from './useRoutingNodes';

function ExtUserNodeComponent({ data }: NodeProps) {
  const d = data as unknown as ExtUserNodeData;

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
          borderColor: d.hasUser ? 'info.light' : 'action.selected',
        },
      }}
    >
      {/* Handles — larger for easier drag-to-connect */}
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        style={{
          background: '#1976d2',
          width: 12,
          height: 12,
          border: '2px solid #fff',
          right: -6,
        }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
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
        {d.hasUser ? (
          <PersonIcon sx={{ fontSize: 18, color: 'info.main' }} />
        ) : (
          <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        )}
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, flex: 1 }}>
          {d.extension}
        </Typography>
        {d.isDefault && <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
      </Box>

      {/* User name or description */}
      <Typography variant="body2" noWrap color="text.secondary" sx={{ fontSize: 12 }}>
        {d.userName || d.label.split(' — ')[1] || ''}
      </Typography>

      {/* Caller ID */}
      {d.callerId && (
        <Typography variant="caption" noWrap color="text.disabled" sx={{ fontSize: 10, fontFamily: 'monospace' }}>
          {d.callerId}
        </Typography>
      )}
    </Box>
  );
}

export default memo(ExtUserNodeComponent);
