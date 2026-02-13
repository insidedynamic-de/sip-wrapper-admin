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

export interface VersionInfo {
  version: string;
  git_commit: string | null;
  api_version: string;
}
