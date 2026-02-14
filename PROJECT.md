# SIP Wrapper Admin Console — Project Overview

**Company:** InsideDynamic GmbH
**Author:** Viktor Nikolayev <viktor.nikolayev@gmail.com>
**Version:** 2.0.0

## What Is This?

Admin panel (SPA) for configuring a SIP bridge backend. Connects AI telephony platforms
(VAPI, Retell, Bland AI) with German SIP providers (Placetel, Easybell, Sipgate, 3CX, Fritzbox).

```
Admin SPA (:3000) → nginx (proxy + security headers) → FastAPI (:8080) → FreeSWITCH
```

The frontend is a **thin UI layer**. All business logic lives in the backend (FastAPI, separate repo).
Frontend handles: presentation, user input, API communication, demo mode simulation.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19 |
| Language | TypeScript | 5.7 |
| Build | Vite | 6 |
| UI Library | MUI (Material UI) | 6 |
| Routing | React Router | 7 (HashRouter) |
| HTTP | Axios | 1.7 |
| i18n | i18next + react-i18next | 24/15 |
| Drag & Drop | @dnd-kit | 6/9/10 |
| Graph | @xyflow/react | 12 |

---

## Navigation Structure

```
Sidebar (permanent drawer)
├── Dashboard           /
├── Configuration       /configuration
│   ├── Users           #users        (SIP + ACL users, Extensions)
│   ├── Gateways        #gateways     (SIP providers/trunks)
│   ├── Security        #security     (Blacklist, Whitelist, Auto-Blacklist, Fail2Ban)
│   ├── Settings        #settings     (Server, ESL, Codecs, Import/Export)
│   └── License         #license      (Multi-license CRUD, activation, connection summary)
├── Routes              /routes       (Extension Routes + Defaults)
├── Monitoring          /monitoring
│   ├── Overview                      (CPU, RAM, Disk, Network, OS, Board)
│   ├── Hardware                      (Detailed hardware info)
│   └── Security                      (Auth monitoring with search + pagination)
├── Logs                /logs
│   ├── System Logs                   (ESL events, live streaming)
│   ├── Call Logs                     (Call history with filters)
│   └── Security Logs                 (Security events)
└── Profile             /profile
    ├── Settings        #settings     (Appearance, Language, Auto-Logout, Password)
    └── Billing         #billing      (Company Info, Invoice Address)
```

---

## File Structure

```
src/
├── api/
│   ├── client.ts               Axios instance, interceptors, demo adapter setup
│   ├── demoAdapter.ts          Custom Axios adapter for demo mode (localStorage)
│   ├── demoData.ts             Seed data, load/save/clear demo store
│   └── types.ts                All TypeScript interfaces
├── components/
│   ├── Layout/
│   │   ├── MainLayout.tsx      App shell (sidebar + outlet)
│   │   └── Sidebar.tsx         Navigation drawer with theme toggle + logout
│   ├── TabView/
│   │   ├── TabView.tsx         Reusable sortable tab component (dnd-kit)
│   │   ├── SortableTab.tsx     Individual draggable tab
│   │   ├── useTabOrder.ts      Tab order persistence hook
│   │   └── index.ts            Barrel export
│   ├── RoutingGraph/
│   │   ├── RoutingGraph.tsx    React Flow graph view for routes
│   │   ├── ExtUserNode.tsx     Extension/User custom node
│   │   ├── GatewayNode.tsx     Gateway custom node
│   │   ├── useRoutingNodes.ts  Node/edge builder hook
│   │   └── index.ts            Barrel export
│   ├── settings/
│   │   ├── ServerCard.tsx      Server/SIP config card
│   │   ├── CodecCard.tsx       Codec preference card
│   │   ├── ImportExportCard.tsx Config import/export card
│   │   └── index.ts            Barrel export
│   ├── ConfirmDialog.tsx       Reusable confirm dialog (save/delete variants)
│   ├── CrudTable.tsx           Generic CRUD table (search, sort, column reorder, toggle, pagination)
│   ├── FormDialog.tsx          Generic form dialog (add/edit/view modes, dirty detection)
│   ├── SearchableSelect.tsx    Autocomplete select with search
│   ├── PageActions.tsx         Save/Cancel floating action bar (dirty state)
│   ├── LogoutCountdown.tsx     Auto-logout countdown timer + warning modal
│   ├── SortableHeaderCell.tsx  Draggable table header cell
│   ├── ApplyChangesButton.tsx  Apply & Reload config button
│   └── UnsavedChangesDialog.tsx Unsaved changes warning dialog
├── hooks/
│   ├── useApi.ts               Generic API call hook with loading/error
│   ├── useAutoRefresh.ts       Interval-based data refresh
│   ├── useColumnOrder.ts       Column order persistence
│   └── useUnsavedChanges.tsx   Unsaved changes detection hook
├── i18n/
│   ├── index.ts                i18next configuration
│   ├── en.json                 English translations
│   └── de.json                 German translations (primary)
├── pages/
│   ├── Dashboard.tsx           Overview with live stat cards, gateways, registrations, calls
│   ├── Configuration.tsx       TabView wrapper: Users, Gateways, Security, Settings, License
│   ├── Routes.tsx              Extension Routes + Defaults (with license limit enforcement)
│   ├── Monitoring.tsx          System monitoring: CPU, RAM, Disk, Network, OS, Security
│   ├── Logs.tsx                System/Call/Security logs with ESL streaming
│   ├── Profile.tsx             TabView wrapper: Settings + Billing
│   ├── Login.tsx               Login page with demo mode toggle
│   ├── NotFound.tsx            404 page
│   ├── Users.tsx               SIP + ACL users + Extensions management
│   ├── Gateways.tsx            SIP gateway/provider CRUD
│   ├── Security.tsx            Blacklist, Whitelist, Auto-Blacklist, Fail2Ban
│   ├── SystemSettings.tsx      Server config, ESL, Codecs, Import/Export
│   ├── Extensions.tsx          Extension management (standalone, also used in Users)
│   ├── LicenseTab.tsx          License CRUD, activation, connection summary
│   ├── BillingTab.tsx          Company info + Invoice address
│   ├── Settings.tsx            (Legacy redirect → SystemSettings)
│   └── License.tsx             (Legacy, now embedded in Configuration)
├── store/
│   ├── preferences.ts          User preferences (theme, language, auto-logout, formats)
│   └── keyStore.ts             API key storage (localStorage)
├── theme/
│   ├── index.ts                buildTheme() — MUI theme builder
│   └── colors.ts               Color theme definitions (default, ocean, forest, sunset)
├── App.tsx                     Root: providers, router, theme, protected routes
└── index.tsx                   Entry point
```

---

## Key Features

### Dashboard
- **8 stat cards**: Gateways Registered, Users Online, Extensions Active, Extension Routes, Active Calls, Total Calls/Failed, Blocked IPs, License Status
- **Customizable**: hide/show cards via dialog, persisted in localStorage
- **Live updates** (demo): calls simulate every 1s, Total Calls/Failed/Users Online update in real-time
- **Tables**: Gateway Status, User Registrations, Active Calls (live durations), Call Statistics (per-connection)
- **Demo simulation**: security events (auth_failure→brute_force→blocked→banned escalation)

### Configuration (Tabbed)
- **Users**: SIP Users + ACL Users + Extensions in sub-tabs. Full CRUD with form validation
- **Gateways**: SIP providers/trunks. Add/Edit/View/Delete. Registration status display
- **Security**: Blacklist, Whitelist (with toggle mode), Auto-Blacklist (Fail2Ban-like), Fail2Ban integration, SIP Firewall. IP batch entry (pipe-separated)
- **Settings**: Server config (domain, IP, ports), Codec preferences (drag-to-reorder), ESL connection test, Config Import/Export
- **License**: Multi-license management, activation with demo keys, connection summary (routings/connections), server ID display

### Routes
- **Extension Routes table**: unified view combining inbound + outbound (user) routes
- **Columns**: User (with registration dot), Gateway, Description, Direction (icon)
- **Defaults card**: default outbound gateway, default inbound extension, caller ID
- **License limit enforcement**: can't activate more routes than licensed connections. Over-limit routes created as deactivated with warning
- **Duplicate prevention**: same extension + gateway + direction blocked

### Monitoring
- **Overview**: CPU usage, RAM usage, Disk usage, Network I/O rates — all with progress bars
- **Hardware**: Detailed CPU info, frequency, temperature, OS details, mainboard info
- **Security**: Auth monitoring table with search (IP + details) and pagination (10/25/50 per page)

### Logs
- **System Logs**: ESL event streaming with start/stop/clear, level/text filters, real-time incremental loading
- **Call Logs**: Historical calls with direction/result/duration, sortable
- **Security Logs**: Security events with level badges

### Profile (Tabbed)
- **Settings**: Theme mode (light/dark/auto), color themes (4 palettes), language (EN/DE), time format (12h/24h), date format, auto-logout (configurable timeout). Buffered changes with Save/Cancel + visual preview
- **Billing**: Company information form + Invoice address form (with "same as company" toggle)

### Login
- Demo mode toggle (runs entirely in localStorage, no backend needed)
- Session conflict detection (409 → force login option)

---

## Reusable Components

| Component | Description |
|-----------|-------------|
| `CrudTable<T>` | Generic table with search, column reorder (dnd-kit), toggle switch, status chips, pagination, dim-disabled rows |
| `FormDialog` | Generic dialog for Add/Edit/View. Dirty detection, unsaved changes warning, read-only mode |
| `ConfirmDialog` | Save/Delete confirmation with customizable text and variant styling |
| `TabView` | Sortable tabs (dnd-kit) with URL hash sync, order persisted in localStorage |
| `SearchableSelect` | MUI Autocomplete wrapper with search, empty option support |
| `PageActions` | Floating Save/Cancel bar, only visible when form is dirty |
| `LogoutCountdown` | Auto-logout timer in sidebar with 2-minute warning modal |

---

## Data Storage Architecture

The frontend is a **thin client** — all business data lives on the backend.

### What the Backend Stores (via API)
All configuration and operational data: users, gateways, routes, security rules, settings, licenses, company info, call logs, ESL events, etc. The frontend fetches and sends this data via `/api/v1/*` endpoints.

### What the Client Stores (localStorage)

| Key | Purpose | Scope |
|-----|---------|-------|
| `api_key` / `api_key_enc` | API authentication (encrypted AES-GCM + plain fallback) | Auth |
| `api_host` | Backend server URL | Auth |
| `sip-wrapper-prefs` | UI preferences: theme, language, auto-logout, time/date format, sidebar state | Local UI |
| `language` | Current UI language (read by i18next on startup) | Local UI |
| `sip-wrapper-dashboard-cards` | Hidden/visible dashboard cards | Local UI |
| Column/tab order keys | Drag-to-reorder table columns and tabs | Local UI |
| `sip-wrapper-demo-data` | Full simulated backend store (demo mode only) | Demo only |
| `sip-wrapper-logout-at` | Logout timestamp for demo data cleanup | Demo only |

**Rule:** The client never caches backend data in localStorage outside of demo mode. In production, every page load fetches fresh data from the API.

---

## Demo Mode

When enabled on the Login page, the app runs entirely client-side:
- All API calls intercepted by `demoAdapter.ts` → read/write `localStorage`
- Seed data provides realistic starting state (12 extensions, 8 users, 5 gateways, etc.)
- Dashboard simulates live calls (state transitions, random new calls, ended calls saved to logs)
- Dashboard simulates security events (per-IP escalation: auth failure → brute force → blocked → banned)
- Error responses (400, 403, 409) use `mockError()` for correct Axios error handling

### Demo Data Lifecycle
| Event | Behavior |
|-------|----------|
| First login with demo mode | Seed data written to `sip-wrapper-demo-data` |
| Subsequent logins (< 60 min since logout) | Existing demo data preserved (user changes kept) |
| Login after 60+ min since logout | Demo data reset to factory defaults automatically |
| "Reset to Default" button (Configuration → Import/Export) | Demo data reset to factory defaults immediately (with confirmation) |
| Demo mode disabled | Demo adapter detached, API calls go to real backend |

---

## License Model

Implemented in backend, enforced in frontend:

| Tier | Connections | Duration |
|------|-------------|----------|
| Trial | 2 | 14 days |
| NFR | 2 | 6-12 months |
| Paid | 10+ (packages of 10) | 12/24/36 months |

**1 Connection** = 1 enabled Extension Route (inbound or outbound).
Deactivated routes don't count. Active but offline routes DO count.

Frontend enforcement:
- Routes page checks `enabledCount >= maxConnections` before creating/enabling routes
- Over-limit new routes → created as deactivated + warning message
- Over-limit toggle enable → blocked with error message

---

## Internationalization

- **DE** (German) = primary language
- **EN** (English) = secondary
- All user-facing text via i18n keys — never hardcoded strings
- Key format: `section.element_action` (e.g., `license.activate_license`)
- Missing translations fall back to displaying the key in UPPERCASE
- Language preference persisted in localStorage

---

## Theming

- 3 modes: Light, Dark, Auto (follows system preference)
- 4 color palettes: Default (blue), Ocean (teal), Forest (green), Sunset (orange)
- All colors from MUI theme palette — no hardcoded hex values
- Theme = MUI base + color palette + dark/light mode
- Preferences persisted in localStorage, visual preview before save

---

## Development

```bash
npm install
npm run dev          # Dev server on :3000
npm run build        # Production build (no source maps)
npm run preview      # Preview production build
```

Backend proxy configured in `vite.config.ts`: `/api` → `localhost:8080`.

---

## Documentation

- `CLAUDE.md` — Coding rules, architecture, conventions (read by AI agents)
- `API.md` — Complete demo adapter API reference with all endpoints
- `PROJECT.md` — This file. Full project overview
- `DEPENDENCIES.md` — Dependency documentation
