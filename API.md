# SIP Wrapper Admin — Demo API Reference

This document describes the **demo adapter** (`src/api/demoAdapter.ts`) — a custom Axios adapter
that intercepts all HTTP calls and routes them to localStorage via `src/api/demoData.ts`.

When the app runs in demo mode, no real backend is needed. All CRUD operations are persisted in
`localStorage` under the key `sip-wrapper-demo-data`.

---

## Architecture

```
React Page → api.get/post/put/delete → Axios → demoAdapter → localStorage (DemoStore)
```

- **`src/api/client.ts`** — Axios instance. When `isDemoMode()` is true, sets `api.defaults.adapter = demoAdapter`.
- **`src/api/demoAdapter.ts`** — Custom adapter. Strips `/api/v1` prefix, matches URL+method, reads/writes DemoStore.
- **`src/api/demoData.ts`** — `SEED_DATA` constant, `loadDemoStore()` / `saveDemoStore()` / `seedDemoData()` / `clearDemoData()`.
- **`src/api/types.ts`** — All TypeScript interfaces for API data models.

### Key Helpers

| Function | Purpose |
|----------|---------|
| `mock(data, config, status=200)` | Return resolved `AxiosResponse` for success (2xx) |
| `mockError(data, config, status)` | Return **rejected** promise with AxiosError-like object (4xx/5xx) |
| `matchPath(pattern, url)` | Match `/routes/inbound/:gateway` patterns, returns extracted params |
| `parseBody(config)` | Parse request body (JSON string or object) |

**Important:** All non-2xx responses MUST use `mockError()` (not `mock()`), otherwise Axios won't
trigger catch blocks in page components. This is because Axios's `validateStatus` check happens inside
built-in adapters only — a custom adapter must reject the promise itself for error status codes.

---

## Data Store (DemoStore)

Defined in `src/api/demoData.ts`. Top-level fields:

| Field | Type | Description |
|-------|------|-------------|
| `extensions` | `Extension[]` | Phone extensions (Nebenstellen) — 1001, 1002, etc. |
| `users` | `User[]` | SIP users (username, extension, caller_id, enabled) |
| `aclUsers` | `AclUser[]` | ACL users (username, ip, extension, caller_id) |
| `gateways` | `Gateway[]` | SIP gateways/providers |
| `gatewayStatuses` | `GatewayStatus[]` | Gateway state: REGED/FAIL/NOREG/DISABLED |
| `registrations` | `Registration[]` | Seed registrations (used as fallback in dynamic reg endpoint) |
| `activeCalls` | `ActiveCall[]` | Currently active calls |
| `callStats` | `CallStatEntry[]` | Per-gateway call statistics |
| `routes` | `{ defaults, inbound[], outbound[], user_routes[] }` | Routing configuration |
| `security` | `{ blacklist[], whitelist{}, auto_blacklist{}, fail2ban{} }` | Security config |
| `eslEvents` | `ESLEvent[]` | FreeSWITCH ESL log events |
| `eslStatus` | `ESLStatus` | ESL connection status |
| `callLogs` | `CallLog[]` | Historical call records |
| `securityLogs` | `SecurityLog[]` | Security event log |
| `auditLog` | `AuditEntry[]` | Admin action audit trail (login, CRUD, config changes) |
| `settings` | `Record<string, unknown>` | FreeSWITCH settings (domain, ports, codecs) |
| `licenses` | `LicenseEntry[]` | Multi-license array |
| `company` | `object` | Company contact info |
| `invoice` | `object` | Invoice/billing address |
| `systemInfo` | `SystemInfo` | Server hardware info (CPU, RAM, disks, network, OS, board) |
| `session` | `{ active, ip, logged_in_at } \| null` | Active login session |

### Data Migration

`seedDemoData()` checks if localStorage has existing data. If missing keys exist in `SEED_DATA`
but not in the stored data, they are patched in. This means **adding a new top-level key to
SEED_DATA will auto-migrate** existing installs, but changing the structure of an existing key
will NOT update already-stored data. Users must clear demo data to get fresh seed.

---

## API Endpoints

All endpoints are under `/api/v1/` (stripped by adapter). Response format: `{ success: true, message: 'OK' }` for mutations unless specified.

### Health
| Method | URL | Response |
|--------|-----|----------|
| GET | `/health` | `{ status: 'ok' }` |

### Dashboard
| Method | URL | Response |
|--------|-----|----------|
| GET | `/gateways/status` | `GatewayStatus[]` |
| GET | `/registrations` | `Registration[]` — **dynamic**: builds from enabled SIP users, ~67% appear online (deterministic per-minute hash) |
| GET | `/active-calls` | `{ calls: ActiveCall[], count: number }` |

### Users (SIP)
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/users` | — | `User[]` |
| POST | `/users` | `User` | `ok()` |
| PUT | `/users/:username` | Partial `User` | `ok()` — merge update |
| DELETE | `/users/:username` | — | `ok()` |

### ACL Users
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/acl-users` | — | `AclUser[]` |
| POST | `/acl-users` | `AclUser` | `ok()` |
| PUT | `/acl-users/:username` | Partial `AclUser` | `ok()` |
| DELETE | `/acl-users/:username` | — | `ok()` |

### Extensions
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/extensions` | — | `Extension[]` |
| POST | `/extensions` | `Extension` | `ok()` |
| PUT | `/extensions/:extension` | Partial `Extension` | `ok()` |
| DELETE | `/extensions/:extension` | — | `ok()` |

### Gateways
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/gateways` | — | `Gateway[]` |
| POST | `/gateways` | `Gateway` | `ok()` — also creates GatewayStatus entry |
| PUT | `/gateways/:name` | Partial `Gateway` | `ok()` — updates status name if renamed |
| DELETE | `/gateways/:name` | — | `ok()` — also removes GatewayStatus |

### Routes
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/routes` | — | `{ defaults, inbound[], outbound[], user_routes[] }` — auto-deduplicates inbound routes (same gateway+extension) |
| PUT | `/routes/defaults` | Partial `RouteDefaults` | `ok()` |
| POST | `/routes/inbound` | `InboundRoute` | `ok()` — replaces existing route with same gateway+extension (prevents duplicates) |
| PUT | `/routes/inbound/:gateway` | Partial `InboundRoute` | `ok()` — when `extension` is in body, matches by gateway+extension (required when multiple routes share a gateway) |
| DELETE | `/routes/inbound/:gateway` | `{ extension? }` | `ok()` — when `extension` is in body, deletes only the matching gateway+extension pair |
| POST | `/routes/outbound` | `OutboundRoute` | `ok()` |
| PUT | `/routes/outbound/:index` | Partial `OutboundRoute` | `ok()` |
| DELETE | `/routes/outbound/:index` | — | `ok()` |
| POST | `/routes/user` | `UserRoute` | `ok()` |
| PUT | `/routes/user/:username` | Partial `UserRoute` | `ok()` |
| DELETE | `/routes/user/:username` | — | `ok()` |

### Security
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/security` | — | Full security config object |
| POST | `/security/blacklist` | `{ ip, comment }` | `ok()` — supports `\|`-separated IPs |
| DELETE | `/security/blacklist/:ip` | — | `ok()` |
| POST | `/security/whitelist` | `{ ip, comment }` | `ok()` — supports `\|`-separated IPs |
| PUT | `/security/whitelist/:ip` | Partial whitelist entry | `ok()` |
| DELETE | `/security/whitelist/:ip` | — | `ok()` or **403** if `127.0.0.1` (protected) |
| PUT | `/security/whitelist/toggle` | `{ enabled: boolean }` | `ok()` |
| PUT | `/security/auto-blacklist` | Config object | `ok()` |
| PUT | `/security/fail2ban` | Config object | `ok()` |
| POST | `/security/fail2ban/ban` | `{ ip }` | `ok()` — sets `fail2ban_banned=true` on blacklist entry |
| POST | `/security/fs-firewall/ban` | `{ ip }` | `ok()` — sets `fs_firewall_blocked=true` on blacklist entry |

### ESL / System Logs
| Method | URL | Params | Response |
|--------|-----|--------|----------|
| GET | `/esl/events` | `?since=timestamp` | `{ events: ESLEvent[], status: ESLStatus }` |
| POST | `/esl/start` | — | `ok()` — sets `running=true` |
| POST | `/esl/stop` | — | `ok()` — sets `running=false` |
| POST | `/esl/clear` | — | `ok()` — empties events array |

### Call Logs
| Method | URL | Response |
|--------|-----|----------|
| GET | `/logs/calls` | `CallLog[]` |
| GET | `/logs/call-stats` | `CallStatEntry[]` |

### Security Logs
| Method | URL | Response |
|--------|-----|----------|
| GET | `/logs/security` | `SecurityLog[]` |

### Settings
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/settings` | — | Settings object (domain, ports, codecs, etc.) |
| PUT | `/settings` | Partial settings | `ok()` |

### Config
| Method | URL | Response |
|--------|-----|----------|
| POST | `/config/apply` | `{ success: true, message: 'Configuration applied (demo)' }` |
| GET | `/config/export` | Entire DemoStore as JSON |
| POST | `/config/import` | `{ success: true }` — **no-op in demo** |

### License (Multi-License CRUD)
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/license` | — | `{ licenses[], total_connections, licensed, trial, nfr, max_connections, version, server_id }` |
| PUT | `/license` | `{ license_key }` | `ok()` on success, **400** (`license_invalid`), **409** (`license_duplicate`) |
| DELETE | `/license/:key` | — | `ok()` |
| POST | `/license/refresh` | — | `{ licenses[], total_connections }` |

**Valid demo keys:** `DEMO-0000-0000-0001` (4 conn), `DEMO-0000-0000-0002` (4 conn), `DEMO-0000-0000-0003` (8 conn). All other keys return 400.

### Company / Invoice
| Method | URL | Body | Response |
|--------|-----|------|----------|
| GET | `/company` | — | Company object |
| PUT | `/company` | Partial company | `ok()` |
| GET | `/invoice` | — | Invoice object |
| PUT | `/invoice` | Partial invoice | `ok()` |

### Auth / Session
| Method | URL | Body | Response |
|--------|-----|------|----------|
| POST | `/auth/login` | `{ force?: boolean }` | `ok()` on success, **409** with `{ active_session, ip, logged_in_at }` if session conflict |
| POST | `/auth/logout` | — | `ok()` — clears session |

### Profile
| Method | URL | Body | Response |
|--------|-----|------|----------|
| PUT | `/profile/company` | Partial company | `ok()` |

### Audit Log
| Method | URL | Params | Response |
|--------|-----|--------|----------|
| GET | `/audit` | `?category=auth&search=...&limit=50&offset=0` | `{ entries: AuditEntry[], total }` |

Supported query params: `category` (auth/user/gateway/route/security/config/license/system), `action`, `success` (true/false), `search` (full-text in details/ip/hostname/user/action), `limit`, `offset`. Results sorted newest-first.

### System Info (Monitoring)
| Method | URL | Response |
|--------|-----|----------|
| GET | `/system/info` | `SystemInfo` — CPU/RAM values fluctuate slightly per request |

### Fallback
Any unmatched URL returns `ok()` (status 200).

---

## TypeScript Interfaces

All interfaces in `src/api/types.ts`:

- `ApiResult` — `{ success, message?, error? }`
- `User` — `{ username, extension, enabled?, caller_id? }`
- `AclUser` — `{ username, ip, extension, caller_id? }`
- `Gateway` — `{ name, description?, type, host, port, username, password, register, transport, auth_username?, enabled? }`
- `GatewayStatus` — `{ name, state, status }`
- `Extension` — `{ extension, description, enabled? }`
- `Registration` — `{ user, ip, port, user_agent, contact }`
- `ActiveCall` — `{ uuid, direction, caller_id, destination, state, duration, gateway? }`
- `CallStatEntry` — `{ gateway, direction, today, month, days_90, days_180 }`
- `Route` — `{ inbound[], outbound[], user_routes[], defaults }`
- `InboundRoute` — `{ gateway, extension, description?, enabled? }`
- `OutboundRoute` — `{ pattern, gateway, prepend?, strip?, enabled? }`
- `UserRoute` — `{ username, gateway, description?, enabled? }`
- `RouteDefaults` — `{ gateway, extension, caller_id }`
- `BlacklistEntry` — `{ ip, comment?, added_at?, blocked_count?, last_blocked?, fail2ban_banned?, fs_firewall_blocked? }`
- `WhitelistEntry` — `{ ip, comment? }`
- `ESLEvent` — `{ type, subtype?, text, level, timestamp, datetime }`
- `ESLStatus` — `{ connected, host, running, last_error, connection_attempts, buffer_stats }`
- `CallLog` — `{ uuid, direction, caller_id, destination, start_time, duration, result, gateway }`
- `SecurityLog` — `{ timestamp, event, ip, details, level }`
- `VersionInfo` — `{ version, git_commit, api_version }`
- `SystemInfo` — `{ cpu, memory, disks[], network[], os, board }`

---

## Seed Data Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Extensions | 12 | 1001-1008, 1010, 1020, 1030, 1040 (4 disabled) |
| SIP Users | 8 | alice, bob, carol, david(off), eva, frank, grace(off), hans |
| ACL Users | 4 | lobby-phone, warehouse, conf-room, parking-gate |
| Gateways | 5 | sipgate(on), telekom(on), office-pbx(off), plivo-ai(on), backup-trunk(off) |
| Active Calls | 4 | Mixed inbound/outbound with different states |
| Call Stats | 6 | 3 gateways x 2 directions |
| Inbound Routes | 3 | sipgate->1001, telekom->1002, plivo-ai->1005(off) |
| Outbound Routes | 0 | Empty (removed from UI) |
| User Routes | 3 | alice->sipgate, bob->telekom, eva->plivo-ai(off) |
| Blacklist | 5 | Mix of IPs and CIDRs with fail2ban flags |
| Whitelist | 4 | 127.0.0.1 (protected), office LAN, internal, VPN |
| ESL Events | 16 | Diverse FS event categories |
| Call Logs | 15 | Mix of answered/missed/failed/busy |
| Security Logs | 12 | Mix of auth_failure/blocked/registration/whitelist |
| Licenses | 1 | DEMO-0000-0000-0001 (4 connections, pre-seeded) |

---

## Pages Using the API

| Page | Key Endpoints Used |
|------|-------------------|
| **Dashboard** | `/gateways/status`, `/gateways`, `/registrations`, `/active-calls`, `/users`, `/acl-users`, `/logs/calls`, `/logs/call-stats`, `/security`, `/license`, `/extensions`, `/routes` |
| **Configuration > Users** | `/extensions`, `/users`, `/acl-users` |
| **Configuration > Gateways** | `/gateways`, `/gateways/status` |
| **Configuration > Security** | `/security`, `/security/blacklist/*`, `/security/whitelist/*`, `/security/auto-blacklist`, `/security/fail2ban/*`, `/security/fs-firewall/ban` |
| **Configuration > Settings** | `/settings`, `/config/apply`, `/config/export`, `/config/import` |
| **Configuration > License** | `/license`, `/license/:key`, `/license/refresh`, `/routes` (for routing count) |
| **Routes** | `/routes`, `/routes/defaults`, `/routes/inbound/*`, `/routes/user/*`, `/gateways`, `/gateways/status`, `/extensions`, `/users`, `/registrations`, `/license` (for limit enforcement) |
| **Monitoring** | `/system/info`, `/logs/security`, `/acl-users` |
| **Logs** | `/esl/events`, `/esl/start`, `/esl/stop`, `/esl/clear`, `/logs/calls`, `/logs/call-stats`, `/logs/security`, `/audit` |
| **Profile > Billing** | `/company`, `/invoice`, `/config/apply` |
| **Login** | `/auth/login`, `/auth/logout` |

---

## Dashboard Live Features (Demo Mode)

In demo mode the Dashboard auto-refreshes every **5 seconds** (vs 30s in production).

Additionally, these features update **every 1 second** without API calls:

| Feature | How |
|---------|-----|
| **Active Calls** | Full call simulation: state transitions (early→ringing→active→ended), random new calls, duration ticking |
| **Total Calls / Failed** | `demoTotalToday` / `demoFailedToday` counters track calls that ended between refreshes |
| **Users Online** | `liveRegCount` includes base registrations + users who have active live calls |
| **Security Events** | Background simulation creates auth_failure→brute_force→blocked→banned escalation per-IP |

When demo calls end, they are saved to `callLogs` in the demo store (max 200 entries).

---

## License Limit Enforcement

The Routes page fetches `/license` to get `total_connections` (max allowed routes).

| Scenario | Behavior |
|----------|----------|
| Creating new route when `enabledCount >= maxConnections` | Route is created as **deactivated** (enabled=false), warning toast shown |
| Toggling disabled→enabled when `enabledCount >= maxConnections` | Blocked with error toast |
| Toggling enabled→disabled | Always allowed (frees a slot) |
| Deactivated routes | Not counted towards the limit |
| Editing existing enabled route | Allowed (doesn't change the count) |

---

## Route Uniqueness Enforcement

The Routes page enforces uniqueness constraints when creating or editing routes:

| Rule | Enforcement |
|------|-------------|
| One extension = one inbound route | Creating a second inbound route for the same extension is blocked with error toast |
| One user = one outbound route | Creating a second outbound route for the same username is blocked with error toast |
| Editing own route | Allowed (the existing route is excluded from the duplicate check) |

The demo adapter also enforces data integrity:

| Layer | Protection |
|-------|-----------|
| `POST /routes/inbound` | Removes existing route with same gateway+extension before inserting (upsert behavior) |
| `PUT /routes/inbound/:gateway` | Uses `extension` field in body to match the correct route when multiple routes share a gateway |
| `DELETE /routes/inbound/:gateway` | Uses `extension` field in body to delete only the specific route |
| `GET /routes` | Auto-deduplicates inbound routes on read (cleans up legacy duplicates) |

---

## Client-Side Only Features (Not API-Based)

These features are handled in localStorage/React state and do NOT call the API:

- **User Preferences** (`src/store/preferences.ts`): theme mode (light/dark/auto), color theme, language (en/de), auto-logout (enabled, timeout), time format (12h/24h), date format, refresh interval
- **API Key** (`src/store/keyStore.ts`): stored in localStorage, sent via `X-API-Key` header
- **Demo Mode Toggle**: stored in preferences, controls whether demoAdapter is active
- **Dashboard Widgets**: customizable card visibility, stored in localStorage (`sip-wrapper-dashboard-cards`)
- **Tab Order**: drag-to-reorder tabs on Configuration/Profile pages, stored per-page in localStorage
- **Column Order**: drag-to-reorder table columns on CrudTable, stored per-table in localStorage
