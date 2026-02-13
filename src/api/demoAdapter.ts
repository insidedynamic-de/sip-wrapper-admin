/**
 * @file demoAdapter — Custom Axios adapter that routes API calls to localStorage
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { loadDemoStore, saveDemoStore } from './demoData';

function mock(data: unknown, config: InternalAxiosRequestConfig, status = 200): AxiosResponse {
  return { data, status, statusText: 'OK', headers: {}, config };
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
    return mock(store.registrations, config);
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
        if (idx >= 0) store.gateways[idx] = { ...store.gateways[idx], ...body } as never;
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
    return mock(store.routes, config);
  }
  if (url === '/routes/defaults' && method === 'put') {
    store.routes.defaults = { ...store.routes.defaults, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }
  if (url === '/routes/inbound' && method === 'post') {
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
        const idx = store.routes.inbound.findIndex((r) => r.gateway === m.gateway);
        if (idx >= 0) store.routes.inbound[idx] = { ...store.routes.inbound[idx], ...body } as never;
        saveDemoStore(store);
        return mock(ok(), config);
      }
      if (method === 'delete') {
        store.routes.inbound = store.routes.inbound.filter((r) => r.gateway !== m.gateway);
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

  // ── License ──
  if (url === '/license' && method === 'get') {
    return mock(store.license, config);
  }
  if (url === '/license' && method === 'put') {
    store.license = { ...store.license, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
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

  // ── Profile ──
  if (url === '/profile/password' && method === 'put') {
    return mock({ success: true, message: 'Password changed (demo)' }, config);
  }
  if (url === '/profile/company' && method === 'put') {
    store.company = { ...store.company, ...body } as never;
    saveDemoStore(store);
    return mock(ok(), config);
  }

  // ── Fallback ──
  return mock(ok(), config);
}
