/**
 * @file RoutingGraph — Interactive visual routing map with drag-to-connect
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Connection, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography, Chip, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import GatewayNode from './GatewayNode';
import ExtUserNode from './ExtUserNode';
import { useRoutingNodes } from './useRoutingNodes';
import type { RouteEdgeData, ExtUserNodeData } from './useRoutingNodes';
import ConfirmDialog from '../ConfirmDialog';
import type { Gateway, GatewayStatus, Extension, User, Route } from '../../api/types';

export type EdgeFilter = 'all' | 'inbound' | 'user';

interface Props {
  gateways: Gateway[];
  extensions: Extension[];
  users: User[];
  routes: Route | null;
  gatewayStatuses: GatewayStatus[];
  onCreateRoute: (type: 'inbound' | 'user', params: Record<string, string>) => Promise<void>;
  onDeleteRoute: (type: 'inbound' | 'user', key: string) => Promise<void>;
  edgeFilter?: EdgeFilter;
  height?: number | string;
}

const nodeTypes = {
  gateway: GatewayNode,
  extUser: ExtUserNode,
};

/**
 * Inner canvas component — must be inside ReactFlowProvider
 * to use useNodesState / useEdgesState hooks.
 */
function RoutingCanvas({
  gateways, extensions, users, routes, gatewayStatuses,
  onCreateRoute, onDeleteRoute, edgeFilter = 'all',
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorMode = useMemo(() => (isDark ? 'dark' : 'light') as 'dark' | 'light', [isDark]);

  const { nodes: computed, edges: computedEdges } = useRoutingNodes({
    gateways, extensions, users, routes, gatewayStatuses,
  });

  // Filter edges by routing type
  const filteredEdges = useMemo(() => {
    if (edgeFilter === 'all') return computedEdges;
    return computedEdges.filter((e) => {
      const data = e.data as RouteEdgeData | undefined;
      if (!data) return false;
      if (edgeFilter === 'inbound') return data.routeType === 'inbound';
      if (edgeFilter === 'user') return data.routeType === 'user' || data.routeType === 'default';
      return true;
    });
  }, [computedEdges, edgeFilter]);

  // Filter nodes — only show those connected by visible edges (for filtered views)
  // For 'all' filter or when there are no edges, show all nodes so user can drag-connect
  const filteredNodes = useMemo(() => {
    if (edgeFilter === 'all') return computed;
    // For filtered views, still show all nodes so user can create new routes
    return computed;
  }, [computed, edgeFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(filteredNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges);

  // Sync computed data → local state when API data or filter changes
  useEffect(() => { setNodes(filteredNodes); }, [filteredNodes, setNodes]);
  useEffect(() => { setEdges(filteredEdges); }, [filteredEdges, setEdges]);

  // ── Delete edge confirmation ──
  const [deleteEdge, setDeleteEdge] = useState<Edge | null>(null);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const data = edge.data as RouteEdgeData | undefined;
    if (!data || data.routeType === 'default') return;
    setDeleteEdge(edge);
  }, []);

  const confirmDeleteEdge = useCallback(async () => {
    if (!deleteEdge?.data) return;
    const data = deleteEdge.data as RouteEdgeData;
    await onDeleteRoute(data.routeType as 'inbound' | 'user', data.routeKey);
    setDeleteEdge(null);
  }, [deleteEdge, onDeleteRoute]);

  // ── Connection creation via drag ──
  const handleConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return;

    if (sourceNode.type === 'gateway' && targetNode.type === 'extUser') {
      const gwName = sourceNode.id.replace('gw-', '');
      const ext = targetNode.id.replace('ext-', '');
      onCreateRoute('inbound', { gateway: gwName, extension: ext });
    } else if (sourceNode.type === 'extUser' && targetNode.type === 'gateway') {
      const extData = sourceNode.data as unknown as ExtUserNodeData;
      if (!extData.hasUser) return;
      const gwName = targetNode.id.replace('gw-', '');
      onCreateRoute('user', { username: extData.userName, gateway: gwName });
    }
  }, [nodes, onCreateRoute]);

  // ── Connection validation ──
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    if (sourceNode.type === 'gateway' && targetNode.type === 'extUser') return true;
    if (sourceNode.type === 'extUser' && targetNode.type === 'gateway') {
      const extData = sourceNode.data as unknown as ExtUserNodeData;
      return extData.hasUser;
    }
    return false;
  }, [nodes]);

  const deleteEdgeLabel = deleteEdge
    ? (deleteEdge.data as RouteEdgeData)?.routeType === 'inbound'
      ? `Inbound: ${(deleteEdge.data as RouteEdgeData).routeKey}`
      : `User route: ${(deleteEdge.data as RouteEdgeData).routeKey}`
    : '';

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        colorMode={colorMode}
        minZoom={0.3}
        maxZoom={2}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        proOptions={{ hideAttribution: false }}
        connectionLineStyle={{ stroke: '#9e9e9e', strokeWidth: 2, strokeDasharray: '6 3' }}
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

      <ConfirmDialog
        open={!!deleteEdge}
        variant="delete"
        title={t('confirm.delete_title')}
        message={t('confirm.delete_message', { name: deleteEdgeLabel })}
        confirmLabel={t('button.delete')}
        cancelLabel={t('button.cancel')}
        onConfirm={confirmDeleteEdge}
        onCancel={() => setDeleteEdge(null)}
      />
    </Box>
  );
}

export default function RoutingGraph(props: Props) {
  const { t } = useTranslation();
  const { edgeFilter = 'all', height } = props;

  const { nodes: allNodes, edges: allEdges } = useRoutingNodes({
    gateways: props.gateways,
    extensions: props.extensions,
    users: props.users,
    routes: props.routes,
    gatewayStatuses: props.gatewayStatuses,
  });

  // Count only visible edges for the stats
  const visibleEdges = edgeFilter === 'all'
    ? allEdges
    : allEdges.filter((e) => {
        const data = e.data as RouteEdgeData | undefined;
        if (!data) return false;
        if (edgeFilter === 'inbound') return data.routeType === 'inbound';
        if (edgeFilter === 'user') return data.routeType === 'user' || data.routeType === 'default';
        return true;
      });
  const visibleNodeIds = new Set<string>();
  if (edgeFilter !== 'all') {
    for (const e of visibleEdges) { visibleNodeIds.add(e.source); visibleNodeIds.add(e.target); }
  }
  const nodeCount = edgeFilter === 'all' ? allNodes.length : visibleNodeIds.size;

  // Legend items based on filter
  const showInboundLegend = edgeFilter === 'all' || edgeFilter === 'inbound';
  const showUserLegend = edgeFilter === 'all' || edgeFilter === 'user';
  const showDefaultLegend = edgeFilter === 'all' || edgeFilter === 'user';

  const containerHeight = height || 'calc(100vh - 250px)';

  return (
    <Box sx={{ height: containerHeight, minHeight: 300, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Legend + hint */}
      <Box sx={{ display: 'flex', gap: 2, p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        {showInboundLegend && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 24, height: 3, bgcolor: '#1976d2', borderRadius: 1 }} />
            Inbound (IN)
          </Typography>
        )}
        {showUserLegend && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 24, height: 3, bgcolor: '#ed6c02', borderRadius: 1 }} />
            {t('route.override_route')} (OUT)
          </Typography>
        )}
        {showDefaultLegend && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 24, height: 3, bgcolor: '#2e7d32', borderRadius: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#2e7d32' }} />
            {t('route.default_route')} (DEF)
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={`${nodeCount} nodes`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
        <Chip size="small" label={`${visibleEdges.length} routes`} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          {t('route.drag_hint')}
        </Typography>
      </Box>

      {/* React Flow canvas — flex: 1 fills remaining height */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <ReactFlowProvider>
          <RoutingCanvas {...props} />
        </ReactFlowProvider>
      </Box>
    </Box>
  );
}
