/**
 * @file demoAdapter — Custom Axios adapter that routes API calls to localStorage
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { loadDemoStore, saveDemoStore } from './demoData';

function mock(data: unknown, config: InternalAxiosRequestConfig, status = 200): AxiosResponse {
  return { data, status, statusText: 'OK', headers: {}, config };
}

/** Return a rejected promise that mimics an Axios error response (for 4xx/5xx) */
function mockError(data: unknown, config: InternalAxiosRequestConfig, status: number): Promise<never> {
  const response: AxiosResponse = { data, status, statusText: 'Error', headers: {}, config };
  const error = Object.assign(new Error(`Request failed with status code ${status}`), {
    response,
    config,
    isAxiosError: true,
  });
  return Promise.reject(error);
}

function ok() {
  return { success: true, message: 'OK' };
}

function delay(ms = 50): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Match URL pattern with :param placeholders */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split('/');
  const up = path.split('/');
  if (pp.length !== up.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(up[i]);
    else if (pp[i] !== up[i]) return null;
  }
  return params;
}

function parseBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try { return JSON.parse(config.data); } catch { return {}; }
  }
  return config.data;
}

export default async function demoAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await delay();

  const method = (config.method || 'get').toLowerCase();
  // Strip baseURL prefix — Axios may prepend it before calling adapter
  let url = config.url || '';
  url = url.replace(/^https?:\/\/[^/]+/, ''); // strip origin if present
  url = url.replace(/^\/api\/v1/, '');         // strip api prefix
  if (!url.startsWith('/')) url = '/' + url;
  url = url.replace(/\/+$/, '') || '/';        // strip trailing slashes

  const store = loadDemoStore();
  const body = parseBody(config);

  // ── Health ──
  if (url === '/health' && method === 'get') {
    return mock({ status: 'ok' }, config);
  }

  // ── Dashboard ──
  if (url === '/gateways/status' && method === 'get') {
    return mock(store.gatewayStatuses, config);
  }
  if (url === '/registrations' && method === 'get') {
    // Build live registrations from enabled SIP users
    const enabledSip = store.users.filter((u) => u.enabled);
    const regs = enabledSip
      .filter((u) => {
        // Use a deterministic-ish check so the same user stays registered
        // across refreshes within the same session, but some are "offline"
        const hash = u.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return (hash + Math.floor(Date.now() / 60000)) % 3 !== 0; // ~67% online
      })
      .map((u) => {
        const existing = store.registrations.find((r) => r.user === u.username);
        return existing || {
          user: u.username,
          ip: `192.168.1.${100 + store.users.indexOf(u)}`,
          port: '5060',
          user_agent: 'Obi200/3.2.2',
          contact: `sip:${u.username}@192.168.1.${100 + store.users.indexOf(u)}`,
        };
      });
    return mock(regs, config);
  }
  if (url === '/active-calls' && method === 'get') {
    return mock({ calls: store.activeCalls, count: store.activeCalls.length }, config);
  }

  // ── Users ──
  if (url === '/users' && method === 'get') {
    return mock(store.users, config);
  }
  if (url === '/users' && method === 'post') {
    store.users.push(body as never);
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/users/:username', url);
    if (m) {
      if (method === 'put') {
        const idx = store.users.findIndex((u) => u.username === m.username);
        if (idx >= 0) store.users[idx] = { ...store.users[idx], ...body } as never;
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        store.users = store.users.filter((u) => u.username !== m.username);
        saveDemoStore(store);
        return mock(ok(), config);
      }
    }
  }

  // ── ACL Users ──
  if (url === '/acl-users' && method === 'get') {
    return mock(store.aclUsers, config);
  }
  if (url === '/acl-users' && method === 'post') {
    store.aclUsers.push(body as never);
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/acl-users/:username', url);
    if (m) {
      if (method === 'put') {
        const idx = store.aclUsers.findIndex((u) => u.username === m.username);
        if (idx >= 0) store.aclUsers[idx] = { ...store.aclUsers[idx], ...body } as never;
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        store.aclUsers = store.aclUsers.filter((u) => u.username !== m.username);
        saveDemoStore(store);
        return mock(ok(), config);
      }
    }
  }

  // ── Extensions ──
  if (url === '/extensions' && method === 'get') {
    return mock(store.extensions, config);
  }
  if (url === '/extensions' && method === 'post') {
    store.extensions.push(body as never);
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/extensions/:extension', url);
    if (m) {
      if (method === 'put') {
        const idx = store.extensions.findIndex((e) => e.extension === m.extension);
        if (idx >= 0) store.extensions[idx] = { ...store.extensions[idx], ...body } as never;
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        store.extensions = store.extensions.filter((e) => e.extension !== m.extension);
        saveDemoStore(store);
        return mock(ok(), config);
      }
    }
  }

  // ── Gateways ──
  if (url === '/gateways' && method === 'get') {
    return mock(store.gateways, config);
  }
  if (url === '/gateways' && method === 'post') {
    const gw = body as Record<string, unknown>;
    store.gateways.push(gw as never);
    store.gatewayStatuses.push({ name: String(gw.name), state: 'NOREG', status: 'UP' });
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/gateways/:name', url);
    if (m) {
      if (method === 'put') {
        const idx = store.gateways.findIndex((g) => g.name === m.name);
        if (idx >= 0) {
          const newName = String((body as Record<string, unknown>).name || m.name);
          store.gateways[idx] = { ...store.gateways[idx], ...body } as never;
          // Update gateway status name if renamed
          if (newName !== m.name) {
            const st = store.gatewayStatuses.find((s) => s.name === m.name);
            if (st) st.name = newName;
          }
        }
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        store.gateways = store.gateways.filter((g) => g.name !== m.name);
        store.gatewayStatuses = store.gatewayStatuses.filter((g) => g.name !== m.name);
        saveDemoStore(store);
        return mock(ok(), config);
      }
    }
  }

  // ── Routes ──
  if (url === '/routes' && method === 'get') {
    // Deduplicate inbound routes (same gateway + extension)
    const seen = new Set<string>();
    store.routes.inbound = store.routes.inbound.filter((r) => {
      const key = `${r.gateway}:${r.extension}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    saveDemoStore(store);
    return mock(store.routes, config);
  }
  if (url === '/routes/defaults' && method === 'put') {
    store.routes.defaults = { ...store.routes.defaults, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/routes/inbound' && method === 'post') {
    const b = body as Record<string, unknown>;
    // Remove existing duplicate (same gateway + extension) before adding
    if (b.gateway && b.extension) {
      store.routes.inbound = store.routes.inbound.filter((r) =>
        !(r.gateway === b.gateway && r.extension === b.extension),
      );
    }
    store.routes.inbound.push(body as never);
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/routes/outbound' && method === 'post') {
    store.routes.outbound.push(body as never);
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/routes/user' && method === 'post') {
    store.routes.user_routes.push(body as never);
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/routes/inbound/:gateway', url);
    if (m) {
      if (method === 'put') {
        const ext = (body as Record<string, unknown>)?.extension;
        const idx = store.routes.inbound.findIndex((r) =>
          r.gateway === m.gateway && (!ext || r.extension === ext),
        );
        if (idx >= 0) store.routes.inbound[idx] = { ...store.routes.inbound[idx], ...body } as never;
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        const ext = (body as Record<string, unknown>)?.extension;
        if (ext) {
          store.routes.inbound = store.routes.inbound.filter((r) =>
            !(r.gateway === m.gateway && r.extension === ext),
          );
        } else {
          store.routes.inbound = store.routes.inbound.filter((r) => r.gateway !== m.gateway);
        }
        saveDemoStore(store);
        return mock(ok(), config);
      }
    }
  }
  {
    const m = matchPath('/routes/outbound/:index', url);
    if (m) {
      const idx = parseInt(m.index);
      if (method === 'put') {
        if (idx >= 0 && idx < store.routes.outbound.length) {
          store.routes.outbound[idx] = { ...store.routes.outbound[idx], ...body } as never;
        }
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        if (idx >= 0 && idx < store.routes.outbound.length) {
          store.routes.outbound.splice(idx, 1);
        }
        saveDemoStore(store);
        return mock(ok(), config);
      }
    }
  }
  {
    const m = matchPath('/routes/user/:username', url);
    if (m) {
      if (method === 'put') {
        const idx = store.routes.user_routes.findIndex((r) => r.username === m.username);
        if (idx >= 0) store.routes.user_routes[idx] = { ...store.routes.user_routes[idx], ...body } as never;
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        store.routes.user_routes = store.routes.user_routes.filter((r) => r.username !== m.username);
        saveDemoStore(store);
        return mock(ok(), config);
      }
    }
  }

  // ── Security ──
  if (url === '/security' && method === 'get') {
    return mock(store.security, config);
  }
  if (url === '/security/blacklist' && method === 'post') {
    const ips = String(body.ip || '').split('|').map((s) => s.trim()).filter(Boolean);
    for (const ip of ips) {
      store.security.blacklist.push({ ip, comment: String(body.comment || ''), added_at: new Date().toISOString(), blocked_count: 0 });
    }
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/security/blacklist/:ip', url);
    if (m && method === 'delete') {
      store.security.blacklist = store.security.blacklist.filter((e) => e.ip !== m.ip);
      saveDemoStore(store);
      return mock(ok(), config);
    }
  }
  if (url === '/security/whitelist' && method === 'post') {
    const ips = String(body.ip || '').split('|').map((s) => s.trim()).filter(Boolean);
    for (const ip of ips) {
      store.security.whitelist.entries.push({ ip, comment: String(body.comment || '') });
    }
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/security/whitelist/:ip', url);
    if (m && method === 'delete') {
      // Protect localhost entry from deletion
      if (m.ip === '127.0.0.1') {
        return mockError({ success: false, detail: 'Protected entry cannot be deleted' }, config, 403);
      }
      store.security.whitelist.entries = store.security.whitelist.entries.filter((e) => e.ip !== m.ip);
      saveDemoStore(store);
      return mock(ok(), config);
    }
  }
  if (url === '/security/whitelist/toggle' && method === 'put') {
    store.security.whitelist.enabled = Boolean(body.enabled);
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/security/auto-blacklist' && method === 'put') {
    store.security.auto_blacklist = { ...store.security.auto_blacklist, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/security/fail2ban' && method === 'put') {
    store.security.fail2ban = { ...store.security.fail2ban, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/security/fail2ban/ban' && method === 'post') {
    const ip = String(body.ip || '');
    const entry = store.security.blacklist.find((e) => e.ip === ip);
    if (entry) {
      entry.fail2ban_banned = true;
    }
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/security/fs-firewall/ban' && method === 'post') {
    const ip = String(body.ip || '');
    const entry = store.security.blacklist.find((e) => e.ip === ip);
    if (entry) {
      entry.fs_firewall_blocked = true;
    }
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── Whitelist edit ──
  {
    const m = matchPath('/security/whitelist/:ip', url);
    if (m && method === 'put') {
      const idx = store.security.whitelist.entries.findIndex((e) => e.ip === m.ip);
      if (idx >= 0) {
        store.security.whitelist.entries[idx] = { ...store.security.whitelist.entries[idx], ...body } as never;
      }
      saveDemoStore(store);
      return mock(ok(), config);
    }
  }

  // ── ESL / Logs ──
  if (url === '/esl/events' && method === 'get') {
    const since = Number(config.params?.since) || 0;
    const events = since ? store.eslEvents.filter((e) => e.timestamp > since) : store.eslEvents;
    return mock({ events, status: store.eslStatus }, config);
  }
  if (url === '/esl/start' && method === 'post') {
    store.eslStatus.running = true;
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/esl/stop' && method === 'post') {
    store.eslStatus.running = false;
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/esl/clear' && method === 'post') {
    store.eslEvents = [];
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── Call Logs ──
  if (url === '/logs/calls' && method === 'get') {
    return mock(store.callLogs, config);
  }
  if (url === '/logs/call-stats' && method === 'get') {
    return mock(store.callStats || [], config);
  }

  // ── Security Logs ──
  if (url === '/logs/security' && method === 'get') {
    return mock(store.securityLogs, config);
  }

  // ── Settings ──
  if (url === '/settings' && method === 'get') {
    return mock(store.settings, config);
  }
  if (url === '/settings' && method === 'put') {
    store.settings = { ...store.settings, ...body };
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── Config ──
  if (url === '/config/apply' && method === 'post') {
    return mock({ success: true, message: 'Configuration applied (demo)' }, config);
  }
  if (url === '/config/export' && method === 'get') {
    return mock(store, config);
  }
  if (url === '/config/import' && method === 'post') {
    return mock({ success: true, message: 'Configuration imported (demo)' }, config);
  }

  // ── License (multi-license CRUD) ──
  if (url === '/license' && method === 'get') {
    const lics = store.licenses || [];
    const totalConn = lics.reduce((s, l) => s + (l.licensed ? l.max_connections : 0), 0);
    const hasLicensed = lics.some((l) => l.licensed);
    const hasTrial = lics.some((l) => l.trial);
    const hasNfr = lics.some((l) => l.nfr);
    return mock({
      licenses: lics,
      total_connections: totalConn,
      licensed: hasLicensed,
      trial: hasTrial,
      nfr: hasNfr,
      max_connections: totalConn,
      version: lics[0]?.version || '2.0.0',
      server_id: lics[0]?.server_id || '',
    }, config);
  }
  if (url === '/license' && method === 'put') {
    // Activate a license key — only accept known demo keys
    const key = String(body.license_key || '');
    if (!key) return mockError({ success: false, message: 'No key provided' }, config, 400);
    const exists = (store.licenses || []).find((l) => l.license_key === key);
    if (exists) return mockError({ success: false, message: 'license_duplicate' }, config, 409);
    // Only accept known demo keys with predefined connection counts
    const VALID_DEMO_KEYS: Record<string, number> = {
      'DEMO-0000-0000-0001': 4,
      'DEMO-0000-0000-0002': 4,
      'DEMO-0000-0000-0003': 8,
    };
    const connections = VALID_DEMO_KEYS[key];
    if (connections === undefined) return mockError({ success: false, message: 'license_invalid' }, config, 400);
    const expDate = new Date();
    expDate.setFullYear(expDate.getFullYear() + 1);
    const newLic = {
      license_key: key,
      client_name: 'InsideDynamic Demo',
      licensed: true,
      expires: expDate.toISOString().slice(0, 10),
      trial: false,
      nfr: false,
      days_remaining: 0,
      max_connections: connections,
      version: '2.0.0',
      server_id: 'srv-a1b2c3d4',
      bound_to: 'srv-a1b2c3d4',
    };
    store.licenses = [...(store.licenses || []), newLic];
    saveDemoStore(store);
    return mock(ok(), config);
  }
  {
    const m = matchPath('/license/:key', url);
    if (m && method === 'delete') {
      store.licenses = (store.licenses || []).filter((l) => l.license_key !== m.key);
      saveDemoStore(store);
      return mock(ok(), config);
    }
  }
  if (url === '/license/refresh' && method === 'post') {
    const lics = store.licenses || [];
    const totalConn = lics.reduce((s, l) => s + (l.licensed ? l.max_connections : 0), 0);
    return mock({ licenses: lics, total_connections: totalConn }, config);
  }

  // ── Company ──
  if (url === '/company' && method === 'get') {
    return mock(store.company, config);
  }
  if (url === '/company' && method === 'put') {
    store.company = { ...store.company, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── Invoice ──
  if (url === '/invoice' && method === 'get') {
    return mock(store.invoice, config);
  }
  if (url === '/invoice' && method === 'put') {
    store.invoice = { ...store.invoice, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── Auth / Session ──
  if (url === '/auth/login' && method === 'post') {
    if (store.session?.active && !body.force) {
      return mockError({
        active_session: true,
        ip: store.session.ip,
        logged_in_at: store.session.logged_in_at,
      }, config, 409);
    }
    // Create new session (force or no existing session)
    store.session = { active: true, ip: '127.0.0.1', logged_in_at: new Date().toISOString() };
    saveDemoStore(store);
    return mock({ success: true, message: 'Logged in' }, config);
  }
  if (url === '/auth/logout' && method === 'post') {
    store.session = null;
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── Profile ──
  if (url === '/profile/password' && method === 'put') {
    return mock({ success: true, message: 'Password changed (demo)' }, config);
  }
  if (url === '/profile/company' && method === 'put') {
    store.company = { ...store.company, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── System Info (monitoring) ──
  if (url === '/system/info' && method === 'get') {
    // Simulate slight CPU/RAM fluctuation
    const sys = { ...store.systemInfo };
    sys.cpu = { ...sys.cpu, usage: Math.max(5, Math.min(95, sys.cpu.usage + Math.floor(Math.random() * 11 - 5))) };
    sys.memory = { ...sys.memory };
    const memDelta = Math.floor(Math.random() * 536870912 - 268435456);
    sys.memory.used = Math.max(4294967296, Math.min(sys.memory.total - 2147483648, sys.memory.used + memDelta));
    sys.memory.free = sys.memory.total - sys.memory.used;
    sys.memory.usage = Math.round((sys.memory.used / sys.memory.total) * 100);
    if (sys.cpu.temperature) sys.cpu.temperature = Math.max(35, Math.min(85, sys.cpu.temperature + Math.floor(Math.random() * 5 - 2)));
    // Simulate network rate fluctuation
    sys.network = sys.network.map((n) => ({
      ...n,
      rx_rate: Math.max(1000, n.rx_rate + Math.floor(Math.random() * 20001 - 10000)),
      tx_rate: Math.max(500, n.tx_rate + Math.floor(Math.random() * 10001 - 5000)),
    }));
    return mock(sys, config);
  }

  // ── Fallback ──
  return mock(ok(), config);
}
