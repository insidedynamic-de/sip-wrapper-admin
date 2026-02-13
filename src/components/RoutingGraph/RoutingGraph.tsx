/**
 * @file RoutingGraph — Visual routing map using React Flow
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography, Chip, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import GatewayNode from './GatewayNode';
import ExtUserNode from './ExtUserNode';
import { useRoutingNodes } from './useRoutingNodes';
import type { Gateway, GatewayStatus, Extension, User, Route } from '../../api/types';

interface Props {
  gateways: Gateway[];
  extensions: Extension[];
  users: User[];
  routes: Route | null;
  gatewayStatuses: GatewayStatus[];
}

const nodeTypes = {
  gateway: GatewayNode,
  extUser: ExtUserNode,
};

export default function RoutingGraph({ gateways, extensions, users, routes, gatewayStatuses }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { nodes, edges } = useRoutingNodes({ gateways, extensions, users, routes, gatewayStatuses });

  const colorMode = useMemo(() => (isDark ? 'dark' : 'light') as 'dark' | 'light', [isDark]);

  return (
    <Box sx={{ height: 'calc(100vh - 250px)', minHeight: 400, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default', flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 24, height: 3, bgcolor: '#1976d2', borderRadius: 1 }} />
          Inbound (IN)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 24, height: 3, bgcolor: '#ed6c02', borderRadius: 1 }} />
          {t('route.override_route')} (OUT)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 24, height: 3, bgcolor: '#2e7d32', borderRadius: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#2e7d32' }} />
          {t('route.default_route')} (DEF)
        </Typography>
        <Chip size="small" label={`${nodes.length} nodes`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
        <Chip size="small" label={`${edges.length} routes`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
      </Box>

      {/* React Flow canvas */}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          colorMode={colorMode}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              if (node.type === 'gateway') return '#1976d2';
              return '#2e7d32';
            }}
            zoomable
            pannable
          />
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}
