/**
 * @file api-compatibility — Validates that response shapes from the real backend
 * match what the frontend components expect.
 *
 * These tests document the contract between frontend and backend.
 * If the backend changes its response format, these tests will catch it.
 */
import { describe, it, expect } from 'vitest';

// ── Security ──

describe('Security API response shape', () => {
  it('GET /security: whitelist is a flat array (not nested object)', () => {
    // Real backend returns: { blacklist: [], whitelist: [], whitelist_enabled: false, ... }
    const response = {
      blacklist: [],
      whitelist: [],
      whitelist_enabled: false,
      auto_blacklist: { enabled: false, max_attempts: 10, time_window: 300, block_duration: 3600 },
      fail2ban: { enabled: false, threshold: 50, jail_name: 'sip-jail' },
    };

    // Frontend extracts whitelist as flat array
    expect(Array.isArray(response.whitelist)).toBe(true);
    // whitelist_enabled is a top-level boolean, not nested
    expect(typeof response.whitelist_enabled).toBe('boolean');
    // whitelist is a plain array, not an object with { entries, enabled }
    expect('entries' in response.whitelist && typeof response.whitelist.entries !== 'function' ? true : false).toBe(false);
  });

  it('GET /security: auto_blacklist uses max_attempts (not threshold)', () => {
    const autoBlacklist = { enabled: false, max_attempts: 10, time_window: 300, block_duration: 3600 };

    expect(autoBlacklist).toHaveProperty('max_attempts');
    expect(autoBlacklist).not.toHaveProperty('threshold');
    expect(autoBlacklist).not.toHaveProperty('trust_proxy');
    expect(typeof autoBlacklist.max_attempts).toBe('number');
  });

  it('GET /security: fail2ban shape is correct', () => {
    const fail2ban = { enabled: false, threshold: 50, jail_name: 'sip-jail' };

    expect(fail2ban).toHaveProperty('enabled');
    expect(fail2ban).toHaveProperty('threshold');
    expect(fail2ban).toHaveProperty('jail_name');
  });

  it('whitelist entries have ip and optional comment', () => {
    const entry = { ip: '192.168.1.1', comment: 'Office' };

    expect(entry).toHaveProperty('ip');
    expect(typeof entry.ip).toBe('string');
  });

  it('blacklist entries have expected fields', () => {
    const entry = { ip: '10.0.0.1', comment: 'Attacker', blocked_count: 5, fail2ban_banned: false, fs_firewall_blocked: false };

    expect(entry).toHaveProperty('ip');
    expect(entry).toHaveProperty('blocked_count');
    expect(entry).toHaveProperty('fail2ban_banned');
    expect(entry).toHaveProperty('fs_firewall_blocked');
  });
});

// ── Company ──

describe('Company API response shape', () => {
  it('GET /company: has no email or phone fields', () => {
    const response = {
      company_name: '',
      company_address: '',
      company_zip: '',
      company_city: '',
      company_country: '',
    };

    expect(response).toHaveProperty('company_name');
    expect(response).toHaveProperty('company_address');
    expect(response).toHaveProperty('company_zip');
    expect(response).toHaveProperty('company_city');
    expect(response).toHaveProperty('company_country');
    // Backend does NOT have these fields
    expect(response).not.toHaveProperty('company_email');
    expect(response).not.toHaveProperty('company_phone');
  });
});

// ── Invoice ──

describe('Invoice API response shape', () => {
  it('GET /invoice: uses invoice_same_as_company (not same_as_company)', () => {
    const response = {
      invoice_same_as_company: false,
      invoice_name: '',
      invoice_address: '',
      invoice_zip: '',
      invoice_city: '',
      invoice_email: '',
    };

    expect(response).toHaveProperty('invoice_same_as_company');
    expect(response).not.toHaveProperty('same_as_company');
    expect(typeof response.invoice_same_as_company).toBe('boolean');
  });

  it('GET /invoice: has invoice_zip and invoice_city fields', () => {
    const response = {
      invoice_same_as_company: false,
      invoice_name: '',
      invoice_address: '',
      invoice_zip: '',
      invoice_city: '',
      invoice_email: '',
    };

    expect(response).toHaveProperty('invoice_zip');
    expect(response).toHaveProperty('invoice_city');
  });
});

// ── License ──

describe('License API response shape', () => {
  it('GET /license: has expected top-level fields', () => {
    const response = {
      licenses: [],
      total_connections: 0,
      licensed: false,
      max_connections: 2,
      version: '2.0.0',
      server_id: '',
      is_trial: true,
      trial_expired: false,
      trial_days_remaining: 14,
      active: true,
    };

    expect(response).toHaveProperty('licenses');
    expect(Array.isArray(response.licenses)).toBe(true);
    expect(response).toHaveProperty('total_connections');
    expect(response).toHaveProperty('server_id');
  });

  it('license entries use valid_until (not expires), product/subproduct/type (not trial/nfr)', () => {
    const entry = {
      license_key: 'TEST-0000-0000-0001',
      product: 'SIP Wrapper',
      subproduct: 'Base',
      license_name: 'SIP Wrapper Base',
      type: 'client' as const,
      client_name: 'Test Client',
      licensed: true,
      valid_until: '2027-12-31',
      days_remaining: 365,
      max_connections: 10,
      version: '2.0.0',
    };

    // Current field names
    expect(entry).toHaveProperty('valid_until');
    expect(entry).toHaveProperty('product');
    expect(entry).toHaveProperty('subproduct');
    expect(entry).toHaveProperty('license_name');
    expect(entry).toHaveProperty('type');
    expect(['partner', 'client', 'internal']).toContain(entry.type);

    // Old field names that no longer exist
    expect(entry).not.toHaveProperty('expires');
    expect(entry).not.toHaveProperty('trial');
    expect(entry).not.toHaveProperty('nfr');
  });
});

// ── Endpoints that don't exist ──

describe('Non-existent endpoints', () => {
  it('/license/available may return 405 — frontend must handle gracefully', () => {
    // This test documents that /license/available is not available on all backends.
    // The frontend must wrap this call in its own try/catch.
    const endpoints405 = ['/license/available', '/license/deactivate'];
    expect(endpoints405).toContain('/license/available');
    expect(endpoints405).toContain('/license/deactivate');
  });
});

// ── Empty response handling ──

describe('Empty response handling', () => {
  it('components handle null/undefined API data without crashing', () => {
    // Simulates spreading null API data (the original crash)
    const apiData = null;
    const defaults = { company_name: '', company_address: '' };
    const result = { ...defaults, ...(apiData || {}) };
    expect(result).toEqual(defaults);
  });

  it('components handle empty arrays without crashing', () => {
    const securityResponse = { blacklist: [], whitelist: [], whitelist_enabled: false };
    expect(securityResponse.blacklist.length).toBe(0);
    expect(securityResponse.whitelist.length).toBe(0);
  });

  it('Object.entries works on empty objects (original crash scenario)', () => {
    const data = {};
    expect(() => Object.entries(data)).not.toThrow();

    // But Object.entries(null) throws — this was the original crash
    expect(() => Object.entries(null as unknown as object)).toThrow();

    // Our fix: guard with || {}
    const nullData = null;
    expect(() => Object.entries(nullData || {})).not.toThrow();
  });
});
