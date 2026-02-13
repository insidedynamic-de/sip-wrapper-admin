/**
 * @file useRoutingNodes — Converts routing API data into React Flow nodes and edges
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useMemo } from 'react';
import { MarkerType, Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type {
  Gateway, GatewayStatus, Extension, User, Route,
} from '../../api/types';

const GW_X = 0;
const EXT_X = 600;
const Y_GAP = 120;

interface Params {
  gateways: Gateway[];
  extensions: Extension[];
  users: User[];
  routes: Route | null;
  gatewayStatuses: GatewayStatus[];
}

export interface GatewayNodeData {
  label: string;
  type: string;
  enabled: boolean;
  status: string;
  outboundPatterns: string[];
  isDefault: boolean;
  [key: string]: unknown;
}

export interface ExtUserNodeData {
  label: string;
  extension: string;
  userName: string;
  callerId: string;
  hasUser: boolean;
  enabled: boolean;
  isDefault: boolean;
  [key: string]: unknown;
}

export interface RouteEdgeData {
  routeType: 'inbound' | 'user' | 'default';
  routeKey: string;
  [key: string]: unknown;
}

export function useRoutingNodes({ gateways, extensions, users, routes, gatewayStatuses }: Params) {
  return useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (!routes) return { nodes, edges };

    const defaults = routes.defaults;
    const statusMap = new Map(gatewayStatuses.map((s) => [s.name, s.state]));

    // Collect outbound patterns per gateway
    const outboundPatternsMap = new Map<string, string[]>();
    for (const ob of routes.outbound) {
      if (ob.enabled === false) continue;
      const list = outboundPatternsMap.get(ob.gateway) || [];
      list.push(ob.pattern);
      outboundPatternsMap.set(ob.gateway, list);
    }

    // ── Gateway nodes (left column) ──
    const enabledGateways = gateways.filter((g) => g.enabled !== false);
    const disabledGateways = gateways.filter((g) => g.enabled === false);
    const sortedGateways = [...enabledGateways, ...disabledGateways];

    sortedGateways.forEach((gw, i) => {
      const data: GatewayNodeData = {
        label: gw.name,
        type: gw.type || 'provider',
        enabled: gw.enabled !== false,
        status: statusMap.get(gw.name) || 'UNKNOWN',
        outboundPatterns: outboundPatternsMap.get(gw.name) || [],
        isDefault: gw.name === defaults.gateway,
      };
      nodes.push({
        id: `gw-${gw.name}`,
        type: 'gateway',
        position: { x: GW_X, y: i * Y_GAP },
        data,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });

    // ── Extension/User nodes (right column) ──
    // Show ALL enabled extensions so user can create new routes via drag & drop
    const userByExt = new Map<string, User>();
    for (const u of users) {
      if (u.enabled !== false) userByExt.set(u.extension, u);
    }

    const enabledExts = extensions.filter((e) => e.enabled !== false);
    const disabledExts = extensions.filter((e) => e.enabled === false);
    const sortedExts = [...enabledExts, ...disabledExts];

    sortedExts.forEach((ext, i) => {
      const user = userByExt.get(ext.extension);
      const data: ExtUserNodeData = {
        label: user ? `${ext.extension} — ${user.username}` : `${ext.extension} — ${ext.description}`,
        extension: ext.extension,
        userName: user?.username || '',
        callerId: user?.caller_id || '',
        hasUser: !!user,
        enabled: ext.enabled !== false,
        isDefault: ext.extension === defaults.extension,
      };
      nodes.push({
        id: `ext-${ext.extension}`,
        type: 'extUser',
        position: { x: EXT_X, y: i * Y_GAP },
        data,
        sourcePosition: Position.Left,
        targetPosition: Position.Right,
      });
    });

    // ── Inbound edges: Gateway → Extension (blue) ──
    for (const ib of routes.inbound) {
      const gwNodeId = `gw-${ib.gateway}`;
      const extNodeId = `ext-${ib.extension}`;
      const disabled = ib.enabled === false;
      const edgeData: RouteEdgeData = { routeType: 'inbound', routeKey: ib.gateway };
      edges.push({
        id: `inbound-${ib.gateway}-${ib.extension}`,
        source: gwNodeId,
        target: extNodeId,
        sourceHandle: 'source-right',
        targetHandle: 'target-right',
        data: edgeData,
        style: {
          stroke: disabled ? '#9e9e9e' : '#1976d2',
          strokeWidth: disabled ? 1 : 2,
          strokeDasharray: disabled ? '6 3' : undefined,
          opacity: disabled ? 0.4 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: disabled ? '#9e9e9e' : '#1976d2' },
        label: 'IN',
        labelStyle: { fontSize: 10, fill: disabled ? '#9e9e9e' : '#1976d2' },
        labelBgStyle: { fill: 'transparent' },
      });
    }

    // ── User Route edges: Extension/User → Gateway (orange) ──
    const usersWithRoute = new Set<string>();
    for (const ur of routes.user_routes) {
      const user = users.find((u) => u.username === ur.username);
      if (!user) continue;
      usersWithRoute.add(ur.username);
      const extNodeId = `ext-${user.extension}`;
      const gwNodeId = `gw-${ur.gateway}`;
      const disabled = ur.enabled === false;
      const edgeData: RouteEdgeData = { routeType: 'user', routeKey: ur.username };
      edges.push({
        id: `user-route-${ur.username}-${ur.gateway}`,
        source: extNodeId,
        target: gwNodeId,
        sourceHandle: 'source-left',
        targetHandle: 'target-left',
        data: edgeData,
        style: {
          stroke: disabled ? '#9e9e9e' : '#ed6c02',
          strokeWidth: disabled ? 1 : 2,
          strokeDasharray: disabled ? '6 3' : undefined,
          opacity: disabled ? 0.4 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: disabled ? '#9e9e9e' : '#ed6c02' },
        label: 'OUT',
        labelStyle: { fontSize: 10, fill: disabled ? '#9e9e9e' : '#ed6c02' },
        labelBgStyle: { fill: 'transparent' },
      });
    }

    // ── Default outbound edges: Users without UserRoute → default gateway (green dashed) ──
    if (defaults.gateway) {
      for (const ext of sortedExts) {
        const user = userByExt.get(ext.extension);
        if (!user) continue;
        if (usersWithRoute.has(user.username)) continue;
        if (ext.enabled === false) continue;

        const extNodeId = `ext-${ext.extension}`;
        const gwNodeId = `gw-${defaults.gateway}`;
        const edgeData: RouteEdgeData = { routeType: 'default', routeKey: '' };
        edges.push({
          id: `default-out-${ext.extension}`,
          source: extNodeId,
          target: gwNodeId,
          sourceHandle: 'source-left',
          targetHandle: 'target-left',
          data: edgeData,
          style: {
            stroke: '#2e7d32',
            strokeWidth: 1.5,
            strokeDasharray: '8 4',
            opacity: 0.6,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2e7d32' },
          label: 'DEF',
          labelStyle: { fontSize: 9, fill: '#2e7d32' },
          labelBgStyle: { fill: 'transparent' },
        });
      }
    }

    return { nodes, edges };
  }, [gateways, extensions, users, routes, gatewayStatuses]);
}
