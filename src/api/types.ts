/* Shared API response types */

export interface ApiResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface User {
  username: string;
  extension: string;
  enabled?: boolean;
  caller_id?: string;
}

export interface AclUser {
  username: string;
  ip: string;
  extension: string;
  caller_id?: string;
}

export interface Gateway {
  name: string;
  description?: string;
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  register: boolean;
  transport: string;
  auth_username?: string;
  enabled?: boolean;
}

export interface GatewayStatus {
  name: string;
  state: string;
  status: string;
}

export interface Extension {
  extension: string;
  description: string;
  enabled?: boolean;
}

export interface Registration {
  user: string;
  ip: string;
  port: string;
  user_agent: string;
  contact: string;
}

export interface ActiveCall {
  uuid: string;
  direction: string;
  caller_id: string;
  destination: string;
  state: string;
  duration: string;
  gateway?: string;
}

export interface CallStatEntry {
  gateway: string;
  direction: 'inbound' | 'outbound';
  today: number;
  month: number;
  days_90: number;
  days_180: number;
}

export interface Route {
  inbound: InboundRoute[];
  outbound: OutboundRoute[];
  user_routes: UserRoute[];
  defaults: RouteDefaults;
}

export interface InboundRoute {
  gateway: string;
  extension: string;
  description?: string;
  enabled?: boolean;
}

export interface OutboundRoute {
  pattern: string;
  gateway: string;
  prepend?: string;
  strip?: number;
  enabled?: boolean;
}

export interface UserRoute {
  username: string;
  gateway: string;
  description?: string;
  enabled?: boolean;
}

export interface RouteDefaults {
  gateway: string;
  extension: string;
  caller_id: string;
}

export interface BlacklistEntry {
  ip: string;
  comment?: string;
  added_at?: string;
  blocked_count?: number;
  last_blocked?: string;
  fail2ban_banned?: boolean;
  fs_firewall_blocked?: boolean;
}

export interface WhitelistEntry {
  ip: string;
  comment?: string;
}

export interface ESLEvent {
  type: string;
  subtype?: string;
  text: string;
  level: string;
  timestamp: number;
  datetime: string;
}

export interface ESLStatus {
  connected: boolean;
  host: string;
  running: boolean;
  last_error: string | null;
  connection_attempts: number;
  buffer_stats: { total_events: number; buffer_size: number; max_size: number };
}

export interface CallLog {
  uuid: string;
  direction: 'inbound' | 'outbound';
  caller_id: string;
  destination: string;
  start_time: string;
  duration: number;
  result: 'answered' | 'missed' | 'failed' | 'busy';
  gateway: string;
}

export interface SecurityLog {
  timestamp: string;
  event: string;
  ip: string;
  details: string;
  level: 'info' | 'warning' | 'error';
}

export type AuditCategory = 'auth' | 'user' | 'gateway' | 'route' | 'security' | 'config' | 'license' | 'system';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  category: AuditCategory;
  user: string;
  ip: string;
  hostname: string;
  user_agent: string;
  details: string;
  success: boolean;
}

export interface VersionInfo {
  version: string;
  git_commit: string | null;
  api_version: string;
}

export interface SystemInfo {
  cpu: {
    model: string;
    cores: number;
    threads: number;
    usage: number;
    frequency: string;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disks: {
    mount: string;
    total: number;
    used: number;
    free: number;
    usage: number;
    fs_type: string;
  }[];
  network: {
    interface: string;
    rx_bytes: number;
    tx_bytes: number;
    rx_rate: number;
    tx_rate: number;
  }[];
  os: {
    name: string;
    version: string;
    kernel: string;
    hostname: string;
    uptime: number;
    arch: string;
  };
  board: {
    manufacturer: string;
    model: string;
    serial?: string;
  };
}
