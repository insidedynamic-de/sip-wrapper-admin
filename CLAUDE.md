# SIP Wrapper Admin Console

## What is this?

Admin UI for SIP Wrapper — a FreeSWITCH management platform for AI telephony (VAPI, Retell, Bland AI) with German SIP providers. This is the frontend SPA that talks to the backend API.

**Company:** InsideDynamic GmbH

## Tech Stack

- **React 19** + **TypeScript 5.7**
- **Vite 6** (build + dev server)
- **Material-UI (MUI) 6.3** + Emotion (styling)
- **React Router 7** (HashRouter)
- **Axios** (HTTP client with interceptors)
- **i18next** (EN + DE translations)
- **@dnd-kit** (drag-and-drop for columns/tabs)
- **Nginx** (production serving via Docker)

## Project Structure

```
sip-wrapper-admin/
├── src/
│   ├── App.tsx                    # Root: routes, theme, auth guard
│   ├── index.tsx                  # Entry point
│   ├── api/
│   │   ├── client.ts              # Axios instance, API key interceptor, 401 redirect
│   │   ├── types.ts               # TypeScript interfaces for API responses
│   │   ├── demoAdapter.ts         # Axios adapter for demo mode (localStorage CRUD)
│   │   └── demoData.ts            # Seed data and helpers for demo mode
│   ├── components/
│   │   ├── ConfirmDialog.tsx      # Reusable confirm modal (save/delete/warning)
│   │   ├── CrudTable.tsx          # Generic CRUD table (search, sort, column reorder, status, toggle)
│   │   ├── ErrorBoundary.tsx      # React error boundary (catches render crashes)
│   │   ├── FormDialog.tsx         # Generic form modal (add/edit/view, dirty tracking)
│   │   ├── LogoutCountdown.tsx    # Auto-logout timer with countdown dialog
│   │   ├── PageActions.tsx        # Save/Cancel buttons with dirty indicator
│   │   ├── SearchableSelect.tsx   # Autocomplete dropdown
│   │   ├── TabView.tsx            # Sortable tab container (drag-to-reorder, URL hash sync)
│   │   ├── Toast.tsx              # Success/error notifications
│   │   ├── UnsavedChangesDialog.tsx # Warn before navigating away
│   │   └── Layout/
│   │       ├── MainLayout.tsx     # App shell: sidebar + ErrorBoundary + content
│   │       └── Sidebar.tsx        # Collapsible navigation sidebar
│   ├── hooks/
│   │   ├── useApi.ts              # Generic data fetching with loading/error
│   │   ├── useAutoRefresh.ts      # Interval-based polling
│   │   └── useColumnOrder.ts      # Persistent column ordering for CrudTable
│   ├── i18n/
│   │   ├── index.ts               # i18next setup
│   │   ├── en.json                # English translations
│   │   └── de.json                # German translations
│   ├── pages/
│   │   ├── Dashboard.tsx          # Overview cards, live calls, stats, gateways
│   │   ├── Configuration.tsx      # Unified config page (Users, Gateways, Security, Settings, License, All Licenses)
│   │   ├── Users.tsx              # SIP + ACL user management (CRUD)
│   │   ├── Gateways.tsx           # SIP gateway management (CRUD)
│   │   ├── Security.tsx           # Blacklist, whitelist, auto-blacklist, Fail2Ban
│   │   ├── SystemSettings.tsx     # Domain, ports, codecs, import/export
│   │   ├── LicenseTab.tsx         # License activation, available licenses, connection summary
│   │   ├── AllLicensesTab.tsx      # All licenses across all servers (read-only + install)
│   │   ├── Routes.tsx             # Default routes + extension routes (inbound/outbound)
│   │   ├── Integrations.tsx       # Third-party integrations (VAPI, Odoo, Zoho, Retell, Bland, HubSpot)
│   │   ├── VIP.tsx                # Premium features (gated by Premium Support license)
│   │   ├── Monitoring.tsx         # System monitoring (CPU, RAM, disk, network, OS)
│   │   ├── Logs.tsx               # System logs, call logs, security logs, audit trail
│   │   ├── Profile.tsx            # Settings (appearance, auto-logout) + Billing tab
│   │   ├── BillingTab.tsx         # Company info + invoice settings
│   │   ├── Login.tsx              # API key login + demo quick-start button
│   │   └── NotFound.tsx           # 404 page
│   ├── store/
│   │   ├── preferences.ts        # localStorage: theme, language, demo mode, auto-logout
│   │   └── keyStore.ts            # AES-GCM encrypted API key storage
│   └── theme/
│       ├── index.ts               # MUI theme builder (light/dark)
│       └── colors.ts              # Color theme definitions (default, ocean, forest, sunset)
├── index.html                     # Vite entry HTML
├── Dockerfile                     # Multi-stage: Node 20 build → Nginx serve
├── nginx.conf                     # Nginx config (port 3000, proxy /api → backend)
├── package.json
├── tsconfig.json
└── vite.config.ts                 # Vite config, proxy /api → localhost:8080
```

## Related Repos

- **Backend API:** `insidedynamic-de/sip-wrapper-backend`
  - FastAPI + FreeSWITCH + Docker
  - This admin connects to it via `/api/v1/*`

## Pages & Features

### Login (`/login`)
- API key + server host authentication
- Session conflict detection (force login if another session active)
- Settings dialog: theme, color, language, demo mode toggle
- **Demo quick-start button** (right side) — enables demo mode and logs in instantly

### Dashboard (`/`)
- Customizable overview cards (hide/show, drag-to-dismiss)
- Live data: gateway status, user registrations, active calls (auto-refresh)
- Call statistics per connection (today, month, 90/180 days)
- License status badge

### Configuration (`/configuration`)
Unified tabbed page with sortable tabs:
- **Users** — SIP users + ACL users CRUD, registration status indicator
- **Gateways** — SIP provider management, live status chips (REGED/FAIL/NOREG)
- **Security** — Blacklist, whitelist (toggle), auto-blacklist, Fail2Ban integration
- **Settings** — Domain/IP, ports, codecs (drag-to-reorder), config import/export
- **License** — Activate/deactivate licenses, connection summary, available licenses grid (install via "+")
- **All Licenses** — All purchased licenses across all servers, status: Available/Assigned/Expired, install unbound licenses

### Routes (`/routes`)
- Default routes (outbound gateway + caller ID, inbound extension)
- Extension routes table (inbound/outbound per user)
- License limit enforcement (auto-deactivate if over limit)
- Duplicate route validation

### Integrations (`/integrations`)
- License-gated integration cards: VAPI, Odoo, Zoho, Retell AI, Bland AI, HubSpot, Premium Support
- Detail modal with feature list
- Active/Inactive status based on license

### VIP (`/vip`)
- Premium features page (visible only with Premium Support license)
- Priority Support, Advanced Analytics, Dedicated Account Manager, Extended API

### Monitoring (`/monitoring`)
- Overview tab: CPU, RAM, disk, network gauges with auto-refresh
- Hardware tab: detailed specs (CPU, board, RAM, storage)
- Security tab: failed auth monitoring, quick actions (block, allow, add ACL user)

### Logs (`/logs`)
- System Logs: ESL events, start/stop/clear, level + category filters
- Call Logs: full call history, direction/result chips, pagination
- Security Logs: auth failures, blocks, bans, with search
- Audit Trail: user actions, category filter, success/failure tracking

### Profile (`/profile`)
- Settings tab: appearance (theme, color, language, date/time format), auto-logout
- Billing tab: company info + invoice settings

## Architecture Patterns

- **Unified pages:** Legacy pages consolidated into tabbed Configuration page
- **CrudTable:** Generic table component used across all CRUD pages (search, column reorder, status, toggle, view/edit/delete)
- **TabView:** Sortable tabs with URL hash sync and persistent order
- **Error Boundary:** Catches React crashes, shows error UI in content area (sidebar stays), "Send Report" via email
- **License events:** Cross-component sync via `window.dispatchEvent(new Event('license-changed'))`
- **Persistent UI state:** Column orders, tab orders, sidebar collapse, dashboard cards, preferences in localStorage

## Demo Mode

Full offline demo with simulated data:
- **demoAdapter.ts** intercepts all Axios requests when demo mode is on
- **demoData.ts** provides seed data stored in localStorage
- Live call simulation: random call creation, state transitions (early → ringing → active), auto-end
- Security event simulation: auth failures → brute force → blocked → Fail2Ban
- Auto-cleanup: demo data removed 60 minutes after logout
- Quick-start: Demo button on login page bypasses host/key validation

## API Reference

All endpoints prefixed with `/api/v1`. Auth via `X-API-Key` header.

### Auth & Session
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/login` | Create session (`force` param for conflict) |
| POST | `/auth/logout` | Destroy session |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List SIP users |
| POST | `/users` | Create SIP user |
| PUT | `/users/:username` | Update SIP user |
| DELETE | `/users/:username` | Delete SIP user |
| GET | `/acl-users` | List ACL users |
| POST | `/acl-users` | Create ACL user |
| PUT | `/acl-users/:username` | Update ACL user |
| DELETE | `/acl-users/:username` | Delete ACL user |

### Extensions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/extensions` | List extensions |
| POST | `/extensions` | Create extension |
| PUT | `/extensions/:extension` | Update extension |
| DELETE | `/extensions/:extension` | Delete extension |

### Gateways
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gateways` | List gateways |
| POST | `/gateways` | Create gateway |
| PUT | `/gateways/:name` | Update gateway |
| DELETE | `/gateways/:name` | Delete gateway |
| GET | `/gateways/status` | Live gateway status |

### Routing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/routes` | Get all routes (inbound, outbound, user_routes, defaults) |
| PUT | `/routes/defaults` | Update default routing |
| POST | `/routes/inbound` | Create inbound route |
| PUT | `/routes/inbound/:gateway` | Update inbound route |
| DELETE | `/routes/inbound/:gateway` | Delete inbound route |
| POST | `/routes/outbound` | Create outbound route |
| PUT | `/routes/outbound/:index` | Update outbound route |
| DELETE | `/routes/outbound/:index` | Delete outbound route |
| POST | `/routes/user` | Create user route |
| PUT | `/routes/user/:username` | Update user route |
| DELETE | `/routes/user/:username` | Delete user route |

### Security
| Method | Path | Description |
|--------|------|-------------|
| GET | `/security` | Get all security settings |
| POST | `/security/blacklist` | Block IP(s) (pipe-separated) |
| DELETE | `/security/blacklist/:ip` | Unblock IP |
| POST | `/security/whitelist` | Allow IP(s) |
| PUT | `/security/whitelist/:ip` | Update whitelist entry |
| DELETE | `/security/whitelist/:ip` | Remove from whitelist |
| PUT | `/security/whitelist/toggle` | Enable/disable whitelist mode |
| PUT | `/security/auto-blacklist` | Update auto-blacklist settings |
| PUT | `/security/fail2ban` | Update Fail2Ban settings |
| POST | `/security/fail2ban/ban` | Mark IP as Fail2Ban banned |
| POST | `/security/fs-firewall/ban` | Mark IP as FS firewall blocked |

### Logs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/esl/events` | ESL event stream (`since` param) |
| POST | `/esl/start` | Start ESL collection |
| POST | `/esl/stop` | Stop ESL collection |
| POST | `/esl/clear` | Clear event buffer |
| GET | `/logs/calls` | Call history |
| GET | `/logs/security` | Security logs |
| GET | `/logs/call-stats` | Call statistics per gateway |
| GET | `/audit` | Audit log (filters: category, action, success, search, offset, limit) |

### License
| Method | Path | Description |
|--------|------|-------------|
| GET | `/license` | License status (licenses, total_connections, server_id) |
| GET | `/license/available` | All licenses across servers (bound/unbound/expired) |
| PUT | `/license` | Activate license (`license_key`) |
| POST | `/license/refresh` | Refresh from license server |
| POST | `/license/deactivate` | Deactivate license (`license_key`, `server_id`) |
| DELETE | `/license/:key` | Remove license from server |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings` | Get system settings |
| PUT | `/settings` | Update system settings |
| GET | `/registrations` | Active SIP registrations |
| GET | `/active-calls` | Current active calls |
| GET | `/system/info` | System monitoring (CPU, RAM, disk, network, OS) |
| POST | `/config/apply` | Apply config and reload |
| GET | `/config/export` | Export config as JSON |
| POST | `/config/import` | Import config from JSON |

### Company & Billing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/company` | Get company details |
| PUT | `/company` | Update company info |
| GET | `/invoice` | Get invoice settings |
| PUT | `/invoice` | Update invoice settings |

## Development

```bash
npm install
npm run dev        # Vite dev server on :3000, proxies /api → :8080
npm run build      # Production build to dist/
```

Requires backend running on `localhost:8080` for API proxy.

## Docker Build

```dockerfile
# Stage 1: Node 20 Alpine → npm install + vite build
# Stage 2: Nginx Alpine → serve dist/ on port 3000
```

Nginx proxies `/api/*` to the backend service.

## Build Notes

- Bundle is ~987KB (MUI + dnd-kit) — consider code-splitting with dynamic imports
- Path alias `@/` → `src/` configured in vite.config.ts

## Git Conventions

- No `Co-Authored-By` in commits — single author only
