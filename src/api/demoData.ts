/**
 * @file demoData — Seed data and localStorage CRUD helpers for demo mode
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import type {
  User, AclUser, Gateway, GatewayStatus, Registration, ActiveCall,
  InboundRoute, OutboundRoute, UserRoute, RouteDefaults,
  BlacklistEntry, WhitelistEntry, ESLEvent, ESLStatus,
  CallLog, SecurityLog, Extension, CallStatEntry, SystemInfo,
  AuditEntry,
} from './types';

const DEMO_STORAGE_KEY = 'sip-wrapper-demo-data';

export interface DemoStore {
  extensions: Extension[];
  users: User[];
  aclUsers: AclUser[];
  gateways: Gateway[];
  gatewayStatuses: GatewayStatus[];
  registrations: Registration[];
  activeCalls: ActiveCall[];
  callStats: CallStatEntry[];
  routes: {
    defaults: RouteDefaults;
    inbound: InboundRoute[];
    outbound: OutboundRoute[];
    user_routes: UserRoute[];
  };
  security: {
    blacklist: BlacklistEntry[];
    whitelist: WhitelistEntry[];
    whitelist_enabled: boolean;
    auto_blacklist: { enabled: boolean; max_attempts: number; time_window: number; block_duration: number };
    fail2ban: { enabled: boolean; threshold: number; jail_name: string };
  };
  eslEvents: ESLEvent[];
  eslStatus: ESLStatus;
  callLogs: CallLog[];
  securityLogs: SecurityLog[];
  settings: Record<string, unknown>;
  licenses: {
    license_key: string;
    product: string;
    subproduct: string;
    license_name: string;
    type: 'partner' | 'client' | 'internal';
    client_name: string;
    licensed: boolean;
    valid_until: string;
    days_remaining: number;
    max_connections: number;
    version: string;
    server_id?: string;
    bound_to?: string;
  }[];
  company: {
    company_name: string;
    company_address: string;
    company_zip: string;
    company_city: string;
    company_country: string;
  };
  invoice: {
    invoice_same_as_company: boolean;
    invoice_name: string;
    invoice_address: string;
    invoice_zip: string;
    invoice_city: string;
    invoice_email: string;
  };
  available_licenses: {
    license_key: string;
    product: string;
    subproduct: string;
    license_name: string;
    max_connections: number;
    valid_until: string;
    bound_to?: string;
    server_name?: string;
    licensed: boolean;
  }[];
  auditLog: AuditEntry[];
  systemInfo: SystemInfo;
  session: {
    active: boolean;
    ip: string;
    logged_in_at: string;
  } | null;
}

const SEED_DATA: DemoStore = {
  // ── Extensions (Nebenstellen) ──
  extensions: [
    { extension: '1001', description: 'Alice Johnson', enabled: true },
    { extension: '1002', description: 'Bob Smith', enabled: true },
    { extension: '1003', description: 'Carol White', enabled: true },
    { extension: '1004', description: 'David Brown', enabled: false },
    { extension: '1005', description: 'Eva Müller', enabled: true },
    { extension: '1006', description: 'Frank Weber', enabled: true },
    { extension: '1007', description: 'Grace Lee', enabled: false },
    { extension: '1008', description: 'Hans Schmidt', enabled: true },
    { extension: '1010', description: 'Lobby Phone', enabled: true },
    { extension: '1020', description: 'Warehouse', enabled: true },
    { extension: '1030', description: 'Conference Room', enabled: true },
    { extension: '1040', description: 'Parking Gate', enabled: false },
  ],
  // ── Users (8 total: 6 enabled, 2 disabled) ──
  users: [
    { username: 'alice', extension: '1001', caller_id: '+4930111001', enabled: true },
    { username: 'bob', extension: '1002', caller_id: '+4930111002', enabled: true },
    { username: 'carol', extension: '1003', caller_id: '+4930111003', enabled: true },
    { username: 'david', extension: '1004', caller_id: '+4930111004', enabled: false },
    { username: 'eva', extension: '1005', caller_id: '+4930111005', enabled: true },
    { username: 'frank', extension: '1006', caller_id: '+4930111006', enabled: true },
    { username: 'grace', extension: '1007', caller_id: '+4930111007', enabled: false },
    { username: 'hans', extension: '1008', caller_id: '+4930111008', enabled: true },
  ],
  // ── ACL Users (4 entries) ──
  aclUsers: [
    { username: 'lobby-phone', ip: '192.168.1.50', extension: '1010', caller_id: 'Lobby' },
    { username: 'warehouse', ip: '192.168.2.100', extension: '1020', caller_id: 'Warehouse' },
    { username: 'conf-room', ip: '192.168.1.60', extension: '1030', caller_id: 'Conference Room' },
    { username: 'parking-gate', ip: '192.168.3.10', extension: '1040', caller_id: 'Parking Gate' },
  ],
  // ── Gateways (5 total: mix of types, 3 enabled, 2 disabled) ──
  gateways: [
    { name: 'sipgate', description: 'Main SIP Provider', type: 'provider', host: 'sipgate.de', port: 5060, username: 'sipuser1', password: '***', register: true, transport: 'udp', enabled: true },
    { name: 'telekom', description: 'Deutsche Telekom', type: 'provider', host: 'tel.t-online.de', port: 5060, username: 'teluser1', password: '***', register: true, transport: 'udp', enabled: true },
    { name: 'office-pbx', description: 'Office PBX System', type: 'pbx', host: '10.0.0.5', port: 5060, username: 'trunk1', password: '***', register: false, transport: 'tcp', enabled: false },
    { name: 'plivo-ai', description: 'Plivo AI Platform', type: 'ai_platform', host: 'sip.plivo.com', port: 5060, username: 'plivo-user', password: '***', register: true, transport: 'tls', enabled: true },
    { name: 'backup-trunk', description: 'Backup Provider', type: 'provider', host: 'sip.backup-provider.de', port: 5060, username: 'backup1', password: '***', register: true, transport: 'udp', enabled: false },
  ],
  // ── Gateway Statuses (all 3 color states: green, red, yellow) ──
  gatewayStatuses: [
    { name: 'sipgate', state: 'REGED', status: 'UP' },
    { name: 'telekom', state: 'FAIL', status: 'DOWN' },
    { name: 'office-pbx', state: 'DISABLED', status: 'DOWN' },
    { name: 'plivo-ai', state: 'REGED', status: 'UP' },
    { name: 'backup-trunk', state: 'NOREG', status: 'DOWN' },
  ],
  // ── Registrations (4 online users) ──
  registrations: [
    { user: 'alice', ip: '192.168.1.101', port: '5060', user_agent: 'Obi200/3.2.2', contact: 'sip:alice@192.168.1.101' },
    { user: 'bob', ip: '192.168.1.102', port: '5060', user_agent: 'Linphone/5.2.0', contact: 'sip:bob@192.168.1.102' },
    { user: 'carol', ip: '192.168.1.103', port: '5060', user_agent: 'Obi200/3.2.2', contact: 'sip:carol@192.168.1.103' },
    { user: 'eva', ip: '10.10.0.50', port: '5060', user_agent: 'Obi200/3.2.2 (VPN)', contact: 'sip:eva@10.10.0.50' },
  ],
  // ── Active Calls (4 calls: different states, each with gateway) ──
  activeCalls: [
    { uuid: 'ac-1', direction: 'inbound', caller_id: '+4930111111', destination: '1001', state: 'active', duration: '02:15', gateway: 'sipgate' },
    { uuid: 'ac-2', direction: 'outbound', caller_id: '+4930111002', destination: '+4930999999', state: 'ringing', duration: '00:05', gateway: 'telekom' },
    { uuid: 'ac-3', direction: 'inbound', caller_id: '+4940555555', destination: '1003', state: 'active', duration: '05:42', gateway: 'sipgate' },
    { uuid: 'ac-4', direction: 'outbound', caller_id: '+4930111005', destination: '+4930777000', state: 'early', duration: '00:12', gateway: 'plivo-ai' },
  ],
  // ── Call Statistics (per-connection aggregated stats) ──
  callStats: [
    { gateway: 'sipgate', direction: 'inbound', today: 3, month: 18, days_90: 52, days_180: 97 },
    { gateway: 'sipgate', direction: 'outbound', today: 2, month: 14, days_90: 41, days_180: 78 },
    { gateway: 'telekom', direction: 'inbound', today: 1, month: 9, days_90: 28, days_180: 53 },
    { gateway: 'telekom', direction: 'outbound', today: 1, month: 7, days_90: 22, days_180: 44 },
    { gateway: 'plivo-ai', direction: 'inbound', today: 0, month: 4, days_90: 12, days_180: 23 },
    { gateway: 'plivo-ai', direction: 'outbound', today: 1, month: 5, days_90: 15, days_180: 28 },
  ],
  // ── Routes (expanded, some disabled for demo) ──
  routes: {
    defaults: { gateway: 'sipgate', extension: '1001', caller_id: '+4930123456' },
    inbound: [
      { gateway: 'sipgate', extension: '1001', description: 'Main office line', enabled: true },
      { gateway: 'telekom', extension: '1002', description: 'Secondary line', enabled: true },
      { gateway: 'plivo-ai', extension: '1005', description: 'AI voice line', enabled: false },
    ],
    outbound: [],
    user_routes: [
      { username: 'alice', gateway: 'sipgate', description: 'Alice outbound via Sipgate', enabled: true },
      { username: 'bob', gateway: 'telekom', description: 'Bob outbound via Telekom', enabled: true },
      { username: 'eva', gateway: 'plivo-ai', description: 'Eva outbound via Plivo', enabled: false },
    ],
  },
  // ── Security (expanded blacklist/whitelist) ──
  security: {
    blacklist: [
      { ip: '45.134.26.0/24', comment: 'Known SIP scanner', added_at: '2025-12-01T10:00:00Z', blocked_count: 42, fail2ban_banned: true },
      { ip: '185.53.91.15', comment: 'Brute force', added_at: '2025-12-15T08:30:00Z', blocked_count: 7, fail2ban_banned: false },
      { ip: '103.45.67.0/24', comment: 'Repeated auth failures', added_at: '2026-01-05T14:20:00Z', blocked_count: 23, fail2ban_banned: true },
      { ip: '91.200.12.88', comment: 'SIP INVITE flood', added_at: '2026-01-20T09:15:00Z', blocked_count: 3, fail2ban_banned: false },
      { ip: '198.51.100.22', comment: 'Port scan detected', added_at: '2026-02-01T11:00:00Z', blocked_count: 1, fail2ban_banned: false },
    ],
    whitelist: [
      { ip: '127.0.0.1', comment: 'Localhost (protected)' },
      { ip: '192.168.1.0/24', comment: 'Office LAN' },
      { ip: '10.0.0.0/8', comment: 'Internal network' },
      { ip: '172.16.0.0/12', comment: 'VPN clients' },
    ],
    whitelist_enabled: false,
    auto_blacklist: { enabled: true, max_attempts: 5, time_window: 300, block_duration: 3600 },
    fail2ban: { enabled: true, threshold: 50, jail_name: 'sip-jail' },
  },
  // ── ESL Events (16 entries: diverse FS categories) ──
  eslEvents: [
    { type: 'SWITCH', text: 'FreeSWITCH Version 1.10.12 started', level: 'info', timestamp: Date.now() - 360000, datetime: new Date(Date.now() - 360000).toISOString() },
    { type: 'SOFIA', text: 'Sofia profile internal started on 0.0.0.0:5060', level: 'info', timestamp: Date.now() - 300000, datetime: new Date(Date.now() - 300000).toISOString() },
    { type: 'ESL', text: 'ESL connection accepted from 127.0.0.1:54321', level: 'debug', timestamp: Date.now() - 280000, datetime: new Date(Date.now() - 280000).toISOString() },
    { type: 'REGISTER', text: 'Registration: alice from 192.168.1.101', level: 'info', timestamp: Date.now() - 240000, datetime: new Date(Date.now() - 240000).toISOString() },
    { type: 'REGISTER', text: 'Registration: bob from 192.168.1.102', level: 'info', timestamp: Date.now() - 200000, datetime: new Date(Date.now() - 200000).toISOString() },
    { type: 'DIALPLAN', text: 'Processing dialplan XML for call +4930111111', level: 'debug', timestamp: Date.now() - 190000, datetime: new Date(Date.now() - 190000).toISOString() },
    { type: 'REGISTER', text: 'Registration: carol from 192.168.1.103', level: 'info', timestamp: Date.now() - 180000, datetime: new Date(Date.now() - 180000).toISOString() },
    { type: 'SOFIA', text: 'Gateway telekom FAIL — host unreachable: tel.t-online.de:5060', level: 'error', timestamp: Date.now() - 150000, datetime: new Date(Date.now() - 150000).toISOString() },
    { type: 'CHANNEL', text: 'Channel created: sofia/internal/alice@192.168.1.101', level: 'info', timestamp: Date.now() - 120000, datetime: new Date(Date.now() - 120000).toISOString() },
    { type: 'CODEC', text: 'Negotiated codec OPUS/48000 for call ac-1', level: 'debug', timestamp: Date.now() - 115000, datetime: new Date(Date.now() - 115000).toISOString() },
    { type: 'SOFIA', text: 'Gateway backup-trunk NOREG — authentication rejected by sip.backup-provider.de', level: 'error', timestamp: Date.now() - 90000, datetime: new Date(Date.now() - 90000).toISOString() },
    { type: 'DIALPLAN', text: 'Route matched: ^(\\d{10,})$ -> gateway sipgate via outbound', level: 'info', timestamp: Date.now() - 70000, datetime: new Date(Date.now() - 70000).toISOString() },
    { type: 'REGISTER', text: 'Registration: eva from 10.10.0.50 (VPN)', level: 'info', timestamp: Date.now() - 60000, datetime: new Date(Date.now() - 60000).toISOString() },
    { type: 'SECURITY', subtype: 'auth_fail', text: 'Auth failure from 45.134.26.55 — user "admin" not found', level: 'warning', timestamp: Date.now() - 30000, datetime: new Date(Date.now() - 30000).toISOString() },
    { type: 'SECURITY', subtype: 'blocked', text: 'IP 185.53.91.15 auto-blocked after 5 failed attempts', level: 'error', timestamp: Date.now() - 15000, datetime: new Date(Date.now() - 15000).toISOString() },
    { type: 'CHANNEL', text: 'Call ended: sofia/internal/alice@192.168.1.101 -> +4930111111 (NORMAL_CLEARING)', level: 'info', timestamp: Date.now() - 5000, datetime: new Date(Date.now() - 5000).toISOString() },
  ],
  eslStatus: {
    connected: true, host: 'localhost:8021', running: true,
    last_error: null, connection_attempts: 1,
    buffer_stats: { total_events: 312, buffer_size: 12, max_size: 1000 },
  },
  // ── Call Logs (15 entries: mix of answered, missed, failed, busy) ──
  callLogs: [
    { uuid: 'c01', direction: 'inbound', caller_id: '+4930111111', destination: '1001', start_time: new Date(Date.now() - 1800000).toISOString(), duration: 245, result: 'answered', gateway: 'sipgate' },
    { uuid: 'c02', direction: 'outbound', caller_id: '+4930111001', destination: '+4930222222', start_time: new Date(Date.now() - 3600000).toISOString(), duration: 62, result: 'answered', gateway: 'sipgate' },
    { uuid: 'c03', direction: 'inbound', caller_id: '+4930333333', destination: '1002', start_time: new Date(Date.now() - 5400000).toISOString(), duration: 0, result: 'missed', gateway: 'telekom' },
    { uuid: 'c04', direction: 'outbound', caller_id: '+4930111002', destination: '+4930444444', start_time: new Date(Date.now() - 7200000).toISOString(), duration: 180, result: 'answered', gateway: 'telekom' },
    { uuid: 'c05', direction: 'inbound', caller_id: '+4930555555', destination: '1001', start_time: new Date(Date.now() - 10800000).toISOString(), duration: 0, result: 'failed', gateway: 'sipgate' },
    { uuid: 'c06', direction: 'outbound', caller_id: '+4930111003', destination: '+4930666666', start_time: new Date(Date.now() - 14400000).toISOString(), duration: 0, result: 'busy', gateway: 'sipgate' },
    { uuid: 'c07', direction: 'inbound', caller_id: '+4940123456', destination: '1003', start_time: new Date(Date.now() - 18000000).toISOString(), duration: 312, result: 'answered', gateway: 'sipgate' },
    { uuid: 'c08', direction: 'outbound', caller_id: '+4930111005', destination: '+4930777000', start_time: new Date(Date.now() - 21600000).toISOString(), duration: 95, result: 'answered', gateway: 'plivo-ai' },
    { uuid: 'c09', direction: 'inbound', caller_id: '+4930888111', destination: '1005', start_time: new Date(Date.now() - 28800000).toISOString(), duration: 0, result: 'missed', gateway: 'plivo-ai' },
    { uuid: 'c10', direction: 'outbound', caller_id: '+4930111001', destination: '+4930999222', start_time: new Date(Date.now() - 43200000).toISOString(), duration: 45, result: 'answered', gateway: 'sipgate' },
    { uuid: 'c11', direction: 'inbound', caller_id: '+4940777888', destination: '1002', start_time: new Date(Date.now() - 50400000).toISOString(), duration: 0, result: 'failed', gateway: 'telekom' },
    { uuid: 'c12', direction: 'outbound', caller_id: '+4930111006', destination: '+4930111222', start_time: new Date(Date.now() - 57600000).toISOString(), duration: 128, result: 'answered', gateway: 'sipgate' },
    { uuid: 'c13', direction: 'inbound', caller_id: '+4930444555', destination: '1001', start_time: new Date(Date.now() - 72000000).toISOString(), duration: 0, result: 'busy', gateway: 'sipgate' },
    { uuid: 'c14', direction: 'inbound', caller_id: '+4930777777', destination: '1001', start_time: new Date(Date.now() - 86400000).toISOString(), duration: 412, result: 'answered', gateway: 'telekom' },
    { uuid: 'c15', direction: 'outbound', caller_id: '+4930111001', destination: '+4930888888', start_time: new Date(Date.now() - 90000000).toISOString(), duration: 67, result: 'answered', gateway: 'sipgate' },
  ],
  // ── Security Logs (12 entries: mix of levels and event types) ──
  securityLogs: [
    { timestamp: new Date(Date.now() - 5000).toISOString(), event: 'auth_failure', ip: '45.134.26.55', details: 'Invalid credentials for user admin', level: 'warning' },
    { timestamp: new Date(Date.now() - 15000).toISOString(), event: 'blocked', ip: '185.53.91.15', details: 'IP blocked: exceeded 5 failed attempts', level: 'error' },
    { timestamp: new Date(Date.now() - 30000).toISOString(), event: 'auth_failure', ip: '91.200.12.88', details: 'SIP INVITE from unknown source', level: 'warning' },
    { timestamp: new Date(Date.now() - 60000).toISOString(), event: 'registration', ip: '192.168.1.101', details: 'User alice registered successfully', level: 'info' },
    { timestamp: new Date(Date.now() - 90000).toISOString(), event: 'registration', ip: '192.168.1.103', details: 'User carol registered successfully', level: 'info' },
    { timestamp: new Date(Date.now() - 120000).toISOString(), event: 'auth_failure', ip: '45.134.26.100', details: 'SIP REGISTER auth failure from unknown user', level: 'warning' },
    { timestamp: new Date(Date.now() - 300000).toISOString(), event: 'registration', ip: '192.168.1.102', details: 'User bob registered successfully', level: 'info' },
    { timestamp: new Date(Date.now() - 600000).toISOString(), event: 'blocked', ip: '45.134.26.0/24', details: 'CIDR range auto-blocked by Fail2Ban', level: 'error' },
    { timestamp: new Date(Date.now() - 1800000).toISOString(), event: 'registration', ip: '10.10.0.50', details: 'User eva registered via VPN', level: 'info' },
    { timestamp: new Date(Date.now() - 3600000).toISOString(), event: 'auth_failure', ip: '103.45.67.89', details: 'Brute force attempt detected (12 failures in 60s)', level: 'error' },
    { timestamp: new Date(Date.now() - 7200000).toISOString(), event: 'blocked', ip: '198.51.100.22', details: 'Port scan detected — IP auto-blocked', level: 'error' },
    { timestamp: new Date(Date.now() - 14400000).toISOString(), event: 'whitelist', ip: '172.16.0.0/12', details: 'Whitelist entry added: VPN clients', level: 'info' },
  ],
  settings: {
    fs_domain: 'demo.sip-wrapper.local',
    external_sip_ip: '203.0.113.10',
    fs_internal_port: 5060,
    fs_external_port: 5080,
    codec_prefs: 'OPUS,G722,PCMU,PCMA',
    default_country_code: '49',
    outbound_caller_id: '+4930123456',
  },
  licenses: [
    { license_key: 'DEMO-0000-0000-0001', product: 'Linkify', subproduct: 'SIP Wrapper', license_name: 'Basic', type: 'client', client_name: 'InsideDynamic Demo', licensed: true, valid_until: '2026-12-31', days_remaining: 0, max_connections: 4, version: '2.0.0', server_id: 'srv-a1b2c3d4', bound_to: 'srv-a1b2c3d4' },
  ],
  available_licenses: [
    { license_key: 'DEMO-0000-0000-0001', product: 'Linkify', subproduct: 'SIP Wrapper', license_name: 'Basic', max_connections: 4, valid_until: '2026-12-31', bound_to: 'srv-a1b2c3d4', server_name: 'sip-wrapper-prod', licensed: true },
    { license_key: 'DEMO-0000-0000-0002', product: 'Linkify', subproduct: 'SIP Wrapper', license_name: 'Basic', max_connections: 4, valid_until: '2026-12-31', licensed: false },
    { license_key: 'DEMO-0000-0000-0003', product: 'Linkify', subproduct: 'SIP Wrapper', license_name: 'Basic', max_connections: 8, valid_until: '2026-12-31', bound_to: 'srv-e5f6g7h8', server_name: 'sip-wrapper-staging', licensed: true },
    { license_key: 'DEMO-PREMSUPPORT-0001', product: 'Linkify', subproduct: 'SIP Wrapper', license_name: 'Premium Support', max_connections: 0, valid_until: '2026-12-31', licensed: false },
    { license_key: 'DEMO-VAPI-0001', product: 'Linkify', subproduct: 'VAPI Integration', license_name: 'VAPI', max_connections: 0, valid_until: '2026-12-31', licensed: false },
    { license_key: 'DEMO-ODOO-0001', product: 'Linkify', subproduct: 'Odoo Integration', license_name: 'Odoo', max_connections: 0, valid_until: '2026-12-31', bound_to: 'srv-e5f6g7h8', server_name: 'sip-wrapper-staging', licensed: true },
    { license_key: 'DEMO-RETELL-0001', product: 'Linkify', subproduct: 'Retell Integration', license_name: 'Retell', max_connections: 0, valid_until: '2026-12-31', licensed: false },
    { license_key: 'DEMO-SIP-EXPIRED-01', product: 'Linkify', subproduct: 'SIP Wrapper', license_name: 'Basic', max_connections: 4, valid_until: '2025-06-30', licensed: false },
  ],
  company: {
    company_name: 'Demo Ltd',
    company_address: 'Musterstrasse 1',
    company_zip: '12345',
    company_city: 'Musterstadt',
    company_country: 'Deutschland',
  },
  invoice: {
    invoice_same_as_company: true,
    invoice_name: 'Demo Ltd',
    invoice_address: 'Musterstrasse 1',
    invoice_zip: '12345',
    invoice_city: 'Musterstadt',
    invoice_email: 'billing@demo-ltd.de',
  },
  // ── Audit Log (user actions) ──
  auditLog: [
    { id: 'a01', timestamp: new Date(Date.now() - 300000).toISOString(), action: 'login', category: 'auth', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Admin login from WORKSTATION-01', success: true },
    { id: 'a02', timestamp: new Date(Date.now() - 600000).toISOString(), action: 'create', category: 'user', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Created SIP user: hans', success: true },
    { id: 'a03', timestamp: new Date(Date.now() - 900000).toISOString(), action: 'update', category: 'gateway', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Updated gateway: sipgate', success: true },
    { id: 'a04', timestamp: new Date(Date.now() - 1200000).toISOString(), action: 'enable', category: 'route', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Enabled route: 1001 → sipgate (inbound)', success: true },
    { id: 'a05', timestamp: new Date(Date.now() - 1800000).toISOString(), action: 'config_apply', category: 'config', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Configuration applied and reloaded', success: true },
    { id: 'a06', timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'login_failed', category: 'auth', user: 'unknown', ip: '10.0.0.55', hostname: 'unknown', user_agent: 'curl/7.88.1', details: 'Invalid API key', success: false },
    { id: 'a07', timestamp: new Date(Date.now() - 3700000).toISOString(), action: 'login_failed', category: 'auth', user: 'unknown', ip: '10.0.0.55', hostname: 'unknown', user_agent: 'curl/7.88.1', details: 'Invalid API key', success: false },
    { id: 'a08', timestamp: new Date(Date.now() - 7200000).toISOString(), action: 'license_activate', category: 'license', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Activated license: DEMO-0000-0000-0001', success: true },
    { id: 'a09', timestamp: new Date(Date.now() - 10800000).toISOString(), action: 'create', category: 'security', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Added to blacklist: 45.134.26.0/24', success: true },
    { id: 'a10', timestamp: new Date(Date.now() - 14400000).toISOString(), action: 'config_export', category: 'config', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Configuration exported to file', success: true },
    { id: 'a11', timestamp: new Date(Date.now() - 21600000).toISOString(), action: 'login', category: 'auth', user: 'admin', ip: '192.168.1.200', hostname: 'LAPTOP-02', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', details: 'Admin login from LAPTOP-02', success: true },
    { id: 'a12', timestamp: new Date(Date.now() - 28800000).toISOString(), action: 'delete', category: 'user', user: 'admin', ip: '192.168.1.200', hostname: 'LAPTOP-02', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', details: 'Deleted SIP user: testuser', success: true },
    { id: 'a13', timestamp: new Date(Date.now() - 36000000).toISOString(), action: 'disable', category: 'route', user: 'admin', ip: '192.168.1.200', hostname: 'LAPTOP-02', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', details: 'Disabled route: 1005 → plivo-ai (inbound)', success: true },
    { id: 'a14', timestamp: new Date(Date.now() - 43200000).toISOString(), action: 'logout', category: 'auth', user: 'admin', ip: '192.168.1.200', hostname: 'LAPTOP-02', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', details: 'Manual logout', success: true },
    { id: 'a15', timestamp: new Date(Date.now() - 50400000).toISOString(), action: 'login_force', category: 'auth', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Force login, previous session from 192.168.1.200', success: true },
    { id: 'a16', timestamp: new Date(Date.now() - 57600000).toISOString(), action: 'update', category: 'user', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Updated SIP user: alice (changed caller_id)', success: true },
    { id: 'a17', timestamp: new Date(Date.now() - 64800000).toISOString(), action: 'create', category: 'route', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Created route: bob → telekom (outbound)', success: true },
    { id: 'a18', timestamp: new Date(Date.now() - 72000000).toISOString(), action: 'config_import', category: 'config', user: 'admin', ip: '192.168.1.100', hostname: 'WORKSTATION-01', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', details: 'Configuration imported from file', success: true },
    { id: 'a19', timestamp: new Date(Date.now() - 86400000).toISOString(), action: 'login', category: 'auth', user: 'admin', ip: '10.10.0.50', hostname: 'VPN-CLIENT', user_agent: 'Mozilla/5.0 (Linux; Android 14) Mobile', details: 'Admin login from VPN-CLIENT', success: true },
    { id: 'a20', timestamp: new Date(Date.now() - 90000000).toISOString(), action: 'logout_auto', category: 'auth', user: 'admin', ip: '10.10.0.50', hostname: 'VPN-CLIENT', user_agent: 'Mozilla/5.0 (Linux; Android 14) Mobile', details: 'Auto-logout after 300s inactivity', success: true },
  ],
  // ── System Info (monitoring) ──
  systemInfo: {
    cpu: {
      model: 'Intel Xeon E-2288G @ 3.70GHz',
      cores: 8,
      threads: 16,
      usage: 23,
      frequency: '3.70 GHz',
      temperature: 52,
    },
    memory: {
      total: 34359738368,
      used: 14495514624,
      free: 19864223744,
      usage: 42,
    },
    disks: [
      { mount: '/', total: 536870912000, used: 214748364800, free: 322122547200, usage: 40, fs_type: 'ext4' },
      { mount: '/data', total: 1099511627776, used: 329853488333, free: 769658139443, usage: 30, fs_type: 'xfs' },
    ],
    network: [
      { interface: 'eth0', rx_bytes: 1258291200, tx_bytes: 524288000, rx_rate: 125000, tx_rate: 82000 },
      { interface: 'eth1', rx_bytes: 209715200, tx_bytes: 104857600, rx_rate: 15000, tx_rate: 8000 },
    ],
    os: {
      name: 'Debian GNU/Linux',
      version: '12 (bookworm)',
      kernel: '6.1.0-18-amd64',
      hostname: 'sip-wrapper-prod',
      uptime: 1296000,
      arch: 'x86_64',
    },
    board: {
      manufacturer: 'Supermicro',
      model: 'X11SCL-F',
      serial: 'SM-2024-A3B4',
    },
  },
  // Pre-seed with an active session to demonstrate the conflict dialog
  session: {
    active: true,
    ip: '192.168.1.42',
    logged_in_at: new Date(Date.now() - 3600000).toISOString(),
  },
};

/** Initialize demo data in localStorage if not already present; patch missing fields in old data */
export function seedDemoData(): void {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(SEED_DATA));
    return;
  }
  // Migrate old data: add any missing top-level keys from SEED_DATA
  try {
    const existing = JSON.parse(raw) as Record<string, unknown>;
    let patched = false;
    for (const key of Object.keys(SEED_DATA) as (keyof DemoStore)[]) {
      if (!(key in existing)) {
        existing[key] = SEED_DATA[key];
        patched = true;
      }
    }
    if (patched) {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch { /* corrupted data — leave as is */ }
}

/** Clear all demo data from localStorage */
export function clearDemoData(): void {
  localStorage.removeItem(DEMO_STORAGE_KEY);
}

/** Reset demo data to factory defaults (wipes current data and re-seeds) */
export function resetDemoData(): void {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(SEED_DATA));
}

/** Load entire demo store */
export function loadDemoStore(): DemoStore {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY);
  return raw ? JSON.parse(raw) : { ...SEED_DATA };
}

/** Save entire demo store */
export function saveDemoStore(store: DemoStore): void {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
}
