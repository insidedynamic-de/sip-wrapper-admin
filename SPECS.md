# SIP Wrapper — Backend Feature Specifications

**Company:** InsideDynamic GmbH
**Author:** Viktor Nikolayev <viktor.nikolayev@gmail.com>

This document describes backend features expected by the frontend. These are specifications for the **FastAPI backend** and **License Server** implementations.

---

## 1. License Server

### Overview

Standalone license management service that validates, activates, and enforces software licenses for the SIP Wrapper platform. The backend (FastAPI) communicates with this server; the frontend never talks to the License Server directly.

```
Frontend (SPA) → FastAPI Backend → License Server
                                 → FreeSWITCH
```

### License Tiers

| Tier | Connections | Duration | Notes |
|------|-------------|----------|-------|
| Trial | 2 | 14 days | Auto-generated on first install |
| NFR (Not for Resale) | 2 | 6–12 months | For partners/demos |
| Paid | 10+ (packages of 10) | 12 / 24 / 36 months | Production use |

**1 Connection = 1 enabled Extension Route** (inbound or outbound). Disabled routes don't count. Active but offline routes DO count.

### License Data Model

```typescript
interface License {
  license_key: string;       // Unique key, format: "XXXX-XXXX-XXXX-XXXX"
  client_name: string;       // Company/client name
  licensed: boolean;         // true = active and valid
  expires: string;           // ISO date, e.g. "2026-12-31"
  trial: boolean;            // true = trial license
  nfr: boolean;              // true = NFR license
  days_remaining: number;    // Days until expiration (0 if perpetual/expired)
  max_connections: number;   // Max enabled routes this key allows
  version: string;           // Software version bound to, e.g. "2.0.0"
  server_id: string;         // Hardware/server fingerprint this key is bound to
  bound_to: string;          // Server ID the license was activated on
}
```

### API Endpoints (Backend → Frontend)

These are the endpoints the **FastAPI backend** exposes to the frontend:

| Method | URL | Body | Response | Description |
|--------|-----|------|----------|-------------|
| GET | `/api/v1/license` | — | `LicenseSummary` | Get all licenses + summary |
| PUT | `/api/v1/license` | `{ license_key }` | `ok()` / 400 / 409 | Activate a new license |
| DELETE | `/api/v1/license/:key` | — | `ok()` | Remove a license |
| POST | `/api/v1/license/refresh` | — | `LicenseSummary` | Re-validate all licenses with License Server |

#### GET /api/v1/license — Response

```json
{
  "licenses": [ /* License[] */ ],
  "total_connections": 12,
  "licensed": true,
  "trial": false,
  "nfr": false,
  "max_connections": 12,
  "version": "2.0.0",
  "server_id": "srv-a1b2c3d4"
}
```

- `total_connections` — Sum of `max_connections` from all `licensed=true` licenses
- `licensed` — true if at least one license has `licensed=true`
- `trial` / `nfr` — true if any license has the respective flag
- `server_id` — This server's hardware fingerprint

#### PUT /api/v1/license — Activation Flow

```
Frontend sends: { license_key: "XXXX-XXXX-XXXX-XXXX" }

Backend:
1. Check if key already exists locally → 409 (license_duplicate)
2. Send key to License Server for validation
3. License Server checks:
   - Key format valid?
   - Key exists in database?
   - Key not expired?
   - Key not already bound to another server_id?
4. If valid → License Server returns license metadata
5. Backend stores license locally, returns ok()
6. If invalid → return 400 (license_invalid, with reason)
```

#### Error Responses

| Status | Code | When |
|--------|------|------|
| 400 | `license_invalid` | Key doesn't exist, expired, wrong version, or already bound to different server |
| 409 | `license_duplicate` | Key already activated on this server |

### License Server Internals (Expected Behavior)

#### Server-Side Validation

The License Server should:

1. **Validate key format** — Ensure correct format (e.g., `XXXX-XXXX-XXXX-XXXX`)
2. **Check existence** — Look up key in license database
3. **Check expiration** — Reject expired licenses
4. **Check server binding** — A key can only be bound to one `server_id`
   - First activation → bind to requesting server
   - Subsequent activations from same server → allow (re-activation)
   - Activation from different server → reject (already bound)
5. **Return metadata** — client_name, max_connections, expires, trial/nfr flags, etc.
6. **Periodic re-validation** — Backend should periodically (e.g., daily) re-validate all active licenses via `POST /license/refresh`

#### Server ID Generation

The backend generates a unique `server_id` based on hardware fingerprint:
- Combination of: MAC address, CPU ID, disk serial, hostname
- Hashed to produce stable ID like `srv-a1b2c3d4`
- Used for license binding (prevents key sharing between servers)

#### Offline Grace Period

If the License Server is unreachable:
- Locally cached licenses remain valid for a grace period (e.g., 7 days)
- After grace period → licenses deactivate (`licensed=false`)
- Once connection restored → automatic re-validation

### Frontend Enforcement

The frontend enforces license limits at the UI level (defense-in-depth, not sole enforcement):

| Action | Behavior |
|--------|----------|
| Create route when `enabledCount >= maxConnections` | Route created as **disabled** + warning toast |
| Enable route when `enabledCount >= maxConnections` | **Blocked** with error toast |
| Disable route | Always allowed (frees a connection slot) |
| No licenses at all (`maxConnections = 0`) | No limit enforcement (unlimited) |

**The backend must also enforce these limits** — the frontend check is only UX, not security.

---

## 2. Audit / Login Statistics

### Overview

Track all administrative actions and login events for security auditing. The backend stores audit logs persistently; the frontend displays them with filtering and search.

```
Admin Action → FastAPI Backend → Audit Log (DB)
                               → Response to Frontend
```

### Audit Log Data Model

```typescript
interface AuditEntry {
  id: string;                // Unique entry ID
  timestamp: string;         // ISO 8601, e.g. "2026-02-14T10:30:00Z"
  action: AuditAction;       // Action category (see below)
  category: AuditCategory;   // High-level category for filtering
  user: string;              // Login username or "system"
  ip: string;                // Client IP address
  hostname: string;          // Client hostname (reverse DNS or reported)
  user_agent: string;        // Browser User-Agent string
  details: string;           // Human-readable description
  metadata?: Record<string, unknown>; // Additional structured data
  success: boolean;          // Whether the action succeeded
}
```

### Action Categories

```typescript
type AuditCategory =
  | 'auth'           // Login, logout, session events
  | 'user'           // SIP user / ACL user management
  | 'gateway'        // Gateway CRUD
  | 'route'          // Route CRUD + enable/disable
  | 'security'       // Blacklist, whitelist, fail2ban changes
  | 'config'         // Settings, import/export, apply
  | 'license'        // License activation, deletion, refresh
  | 'system';        // System-level actions

type AuditAction =
  // Auth
  | 'login'              // Successful login
  | 'login_failed'       // Failed login attempt
  | 'login_force'        // Force login (override existing session)
  | 'logout'             // Manual logout
  | 'logout_auto'        // Auto-logout (timeout)
  | 'session_expired'    // Session expired
  // CRUD
  | 'create'             // Created a resource
  | 'update'             // Updated a resource
  | 'delete'             // Deleted a resource
  | 'enable'             // Enabled a resource (route, user, etc.)
  | 'disable'            // Disabled a resource
  // Config
  | 'config_apply'       // Applied configuration
  | 'config_import'      // Imported configuration
  | 'config_export'      // Exported configuration
  // License
  | 'license_activate'   // Activated a license
  | 'license_delete'     // Deleted a license
  | 'license_refresh'    // Refreshed licenses
  // System
  | 'system_restart'     // System restart
  | 'demo_reset';        // Demo data reset
```

### API Endpoints

| Method | URL | Query Parameters | Response | Description |
|--------|-----|-----------------|----------|-------------|
| GET | `/api/v1/audit` | `?category=auth&action=login&from=...&to=...&ip=...&limit=50&offset=0` | `{ entries: AuditEntry[], total: number }` | Paginated audit log with filters |
| GET | `/api/v1/audit/stats` | `?from=...&to=...` | `AuditStats` | Aggregated statistics |

#### GET /api/v1/audit — Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | — | Filter by category (e.g., `auth`, `user`, `gateway`) |
| `action` | string | — | Filter by specific action (e.g., `login`, `create`) |
| `from` | ISO date | — | Start date (inclusive) |
| `to` | ISO date | — | End date (inclusive) |
| `ip` | string | — | Filter by IP address (partial match) |
| `user` | string | — | Filter by username (partial match) |
| `success` | boolean | — | Filter by success/failure |
| `search` | string | — | Full-text search in details field |
| `limit` | number | 50 | Page size |
| `offset` | number | 0 | Pagination offset |
| `sort` | string | `timestamp` | Sort field |
| `order` | `asc`/`desc` | `desc` | Sort direction (newest first by default) |

#### GET /api/v1/audit — Response

```json
{
  "entries": [
    {
      "id": "audit-001",
      "timestamp": "2026-02-14T10:30:00Z",
      "action": "login",
      "category": "auth",
      "user": "admin",
      "ip": "192.168.1.100",
      "hostname": "WORKSTATION-01",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
      "details": "Admin login from WORKSTATION-01",
      "success": true
    },
    {
      "id": "audit-002",
      "timestamp": "2026-02-14T10:25:00Z",
      "action": "login_failed",
      "category": "auth",
      "user": "unknown",
      "ip": "10.0.0.55",
      "hostname": "unknown",
      "user_agent": "curl/7.88.1",
      "details": "Invalid API key",
      "success": false
    }
  ],
  "total": 247
}
```

#### GET /api/v1/audit/stats — Response

```json
{
  "total_logins": 142,
  "failed_logins": 23,
  "unique_ips": 8,
  "actions_by_category": {
    "auth": 165,
    "user": 34,
    "gateway": 12,
    "route": 45,
    "security": 8,
    "config": 5,
    "license": 3,
    "system": 2
  },
  "recent_logins": [
    {
      "timestamp": "2026-02-14T10:30:00Z",
      "user": "admin",
      "ip": "192.168.1.100",
      "hostname": "WORKSTATION-01",
      "success": true
    }
  ],
  "top_ips": [
    { "ip": "192.168.1.100", "count": 89, "last_seen": "2026-02-14T10:30:00Z" },
    { "ip": "10.0.0.55", "count": 45, "last_seen": "2026-02-14T09:15:00Z" }
  ]
}
```

### What the Backend Should Log

#### Auth Events

| Trigger | Action | Details |
|---------|--------|---------|
| Successful API key login | `login` | `"Admin login from {hostname}"` |
| Invalid API key | `login_failed` | `"Invalid API key"` |
| Session conflict + force | `login_force` | `"Force login, previous session from {ip}"` |
| Manual logout | `logout` | `"Manual logout"` |
| Timeout logout | `logout_auto` | `"Auto-logout after {seconds}s inactivity"` |

#### CRUD Events

| Trigger | Action | Details |
|---------|--------|---------|
| Create SIP user | `create` | `"Created SIP user: {username}"` |
| Update gateway | `update` | `"Updated gateway: {name}"` |
| Delete route | `delete` | `"Deleted route: {extension} → {gateway}"` |
| Enable route | `enable` | `"Enabled route: {extension} → {gateway}"` |
| Disable route | `disable` | `"Disabled route: {extension} → {gateway}"` |
| Blacklist IP | `create` | `"Added to blacklist: {ip}"` |
| Apply config | `config_apply` | `"Configuration applied and reloaded"` |
| Import config | `config_import` | `"Configuration imported from file"` |
| Activate license | `license_activate` | `"Activated license: {key}"` |

### Client Information Collection

The backend should capture these client details on every request:

| Field | Source | Example |
|-------|--------|---------|
| `ip` | Request IP / `X-Forwarded-For` header | `192.168.1.100` |
| `hostname` | Reverse DNS lookup of client IP | `WORKSTATION-01` |
| `user_agent` | `User-Agent` header | `Mozilla/5.0 ...` |
| `user` | From authenticated session / API key mapping | `admin` |

### Retention

- **Default retention:** 90 days (configurable in backend settings)
- **Auto-cleanup:** Backend purges entries older than retention period
- **Export:** Admin can export audit logs as CSV/JSON via frontend

---

## 3. Frontend Integration Plan (Not Yet Implemented)

### Audit Log Page

Could be added as a sub-tab under **Logs** or as a standalone page:

```
Logs
├── System Logs       (existing — ESL events)
├── Call Logs         (existing — call history)
├── Security Logs     (existing — security events)
└── Audit Log         (NEW — admin action history)
```

### Audit Log UI Features

- **Table columns:** Timestamp, Category, Action, User, IP, Hostname, Details, Status
- **Filters:** Category dropdown, date range picker, IP search, user search
- **Category chips:** Color-coded badges (auth=blue, user=green, security=red, etc.)
- **Export button:** Download filtered results as CSV
- **Auto-refresh:** Optional polling for real-time updates

### Dashboard Integration

A stat card showing:
- **Logins today:** count
- **Failed attempts:** count (highlighted if > threshold)
- **Last login:** timestamp + IP

---

## Summary

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| License CRUD | FastAPI endpoints | LicenseTab.tsx | Implemented (demo mode) |
| License Server communication | FastAPI → License Server | — | **Needs backend implementation** |
| License enforcement | Must enforce server-side | Routes.tsx UI enforcement | Frontend done, **backend needed** |
| Audit logging | Store all admin actions | — | **Needs both backend + frontend** |
| Login statistics | Track login/logout events | — | **Needs both backend + frontend** |
| Session management | Basic session (single) | Login.tsx conflict detection | Partial |
