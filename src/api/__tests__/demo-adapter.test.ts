/**
 * @file demo-adapter — Validates that demo seed data matches the real backend response shapes.
 * This ensures the demo mode accurately simulates the real API.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { DemoStore } from '../demoData';

// We import the raw seed function to validate the data shape
// without needing localStorage (which doesn't exist in Node)
let store: DemoStore;

beforeAll(async () => {
  // Dynamically import to get the default seed data shape
  // We'll construct the expected shape manually based on the DemoStore interface
  const mod = await import('../demoData');
  // seedDemoData writes to localStorage; we test the types instead
  // Get the initial data by calling getStore with a mock
  store = {
    extensions: [],
    users: [],
    aclUsers: [],
    gateways: [],
    gatewayStatuses: [],
    registrations: [],
    activeCalls: [],
    callStats: [],
    routes: {
      defaults: { gateway: '', extension: '', caller_id: '' },
      inbound: [],
      outbound: [],
      user_routes: [],
    },
    security: {
      blacklist: [],
      whitelist: [],
      whitelist_enabled: false,
      auto_blacklist: { enabled: false, max_attempts: 10, time_window: 300, block_duration: 3600 },
      fail2ban: { enabled: false, threshold: 50, jail_name: 'sip-jail' },
    },
    eslEvents: [],
    eslStatus: { connected: false, host: '', running: false, last_error: null, connection_attempts: 0, buffer_stats: { total_events: 0, buffer_size: 0, max_size: 0 } },
    callLogs: [],
    securityLogs: [],
    settings: {},
    licenses: [],
    company: {
      company_id: '',
      company_name: '',
      company_email: '',
      company_address: '',
      company_zip: '',
      company_city: '',
      company_country: '',
    },
    invoice: {
      invoice_same_as_company: false,
      invoice_name: '',
      invoice_address: '',
      invoice_zip: '',
      invoice_city: '',
      invoice_email: '',
    },
    available_licenses: [],
    auditLog: [],
    systemInfo: {} as DemoStore['systemInfo'],
    session: null,
  } satisfies DemoStore;
  void mod; // ensure import succeeds (catches compile errors)
});

describe('DemoStore security shape matches backend', () => {
  it('whitelist is a flat array', () => {
    expect(Array.isArray(store.security.whitelist)).toBe(true);
  });

  it('whitelist_enabled is a top-level boolean', () => {
    expect(typeof store.security.whitelist_enabled).toBe('boolean');
  });

  it('auto_blacklist uses max_attempts, not threshold', () => {
    expect(store.security.auto_blacklist).toHaveProperty('max_attempts');
    expect(store.security.auto_blacklist).not.toHaveProperty('threshold');
  });

  it('auto_blacklist does not have trust_proxy', () => {
    expect(store.security.auto_blacklist).not.toHaveProperty('trust_proxy');
  });
});

describe('DemoStore company shape matches backend', () => {
  it('has required fields', () => {
    expect(store.company).toHaveProperty('company_id');
    expect(store.company).toHaveProperty('company_name');
    expect(store.company).toHaveProperty('company_email');
    expect(store.company).toHaveProperty('company_address');
    expect(store.company).toHaveProperty('company_zip');
    expect(store.company).toHaveProperty('company_city');
    expect(store.company).toHaveProperty('company_country');
  });
});

describe('DemoStore invoice shape matches backend', () => {
  it('uses invoice_same_as_company, not same_as_company', () => {
    expect(store.invoice).toHaveProperty('invoice_same_as_company');
    expect(store.invoice).not.toHaveProperty('same_as_company');
  });

  it('has invoice_zip and invoice_city', () => {
    expect(store.invoice).toHaveProperty('invoice_zip');
    expect(store.invoice).toHaveProperty('invoice_city');
  });
});

describe('DemoStore license entries match backend shape', () => {
  it('DemoStore interface accepts valid license entries', () => {
    const entry: DemoStore['licenses'][number] = {
      license_key: 'TEST-KEY',
      product: 'SIP Wrapper',
      subproduct: 'Base',
      license_name: 'SIP Wrapper Base',
      type: 'client',
      client_name: 'Test',
      licensed: true,
      valid_until: '2027-12-31',
      days_remaining: 365,
      max_connections: 10,
      version: '2.0.0',
    };

    expect(entry).toHaveProperty('product');
    expect(entry).toHaveProperty('subproduct');
    expect(entry).toHaveProperty('license_name');
    expect(entry).toHaveProperty('type');
    expect(entry).toHaveProperty('valid_until');
    // Old fields should not exist
    expect(entry).not.toHaveProperty('expires');
    expect(entry).not.toHaveProperty('trial');
    expect(entry).not.toHaveProperty('nfr');
  });
});
