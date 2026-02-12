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
- **Nginx** (production serving via Docker)

## Project Structure

```
sip-wrapper-admin/
├── src/
│   ├── App.tsx              # Root: routes, theme, auth guard
│   ├── index.tsx            # Entry point
│   ├── api/
│   │   ├── client.ts        # Axios instance, API key interceptor, 401 redirect
│   │   └── types.ts         # TypeScript interfaces for API responses
│   ├── components/
│   │   ├── ConfirmDialog.tsx # Reusable confirm modal
│   │   └── Layout/
│   │       ├── MainLayout.tsx  # App shell with sidebar + content
│   │       └── Sidebar.tsx     # Navigation sidebar
│   ├── hooks/
│   │   ├── useApi.ts          # Generic data fetching hook
│   │   └── useAutoRefresh.ts  # Auto-refresh with interval
│   ├── i18n/
│   │   ├── index.ts    # i18next setup
│   │   ├── en.json     # English translations
│   │   └── de.json     # German translations
│   ├── pages/
│   │   ├── Dashboard.tsx  # Overview, system status, active calls
│   │   ├── Users.tsx      # SIP user management (CRUD)
│   │   ├── Gateways.tsx   # SIP provider gateways (CRUD)
│   │   ├── Routes.tsx     # Inbound/outbound routing rules
│   │   ├── Security.tsx   # Blacklist, whitelist, fail2ban
│   │   ├── Logs.tsx       # System logs/events viewer
│   │   ├── Settings.tsx   # System settings (codecs, ports)
│   │   ├── Login.tsx      # API key login
│   │   └── Profile.tsx    # Company info, theme, dark mode
│   ├── store/
│   │   └── preferences.ts # localStorage: dark mode, theme, language
│   └── theme/
│       ├── index.ts       # MUI theme builder (light/dark)
│       └── colors.ts      # Color theme definitions
├── public/index.html
├── index.html             # Vite entry HTML
├── Dockerfile             # Multi-stage: Node 20 build → Nginx serve
├── nginx.conf             # Nginx config (port 3000, proxy /api → backend)
├── package.json
├── tsconfig.json
└── vite.config.ts         # Vite config, proxy /api → localhost:8080
```

## Related Repos

- **Backend API:** `insidedynamic-de/sip-wrapper-backend`
  - FastAPI + FreeSWITCH + Docker
  - This admin connects to it via `/api/v1/*`

## How it Works

### Authentication
- Login page asks for API key
- Key stored in `localStorage` as `api_key`
- Axios interceptor adds `X-API-Key` header to every request
- 401 response → redirect to `/login`

### Routing
- Uses `HashRouter` (e.g. `/#/users`, `/#/gateways`)
- `ProtectedRoute` wrapper checks `localStorage` for `api_key`
- Pages: `/`, `/users`, `/gateways`, `/routes`, `/security`, `/logs`, `/settings`, `/profile`

### API Communication
- All calls via `src/api/client.ts` (Axios instance)
- Base URL: `/api/v1` (proxied to backend in dev, Nginx in prod)
- Types defined in `src/api/types.ts`

### Theming
- MUI with dark/light mode toggle
- Multiple color themes (stored in preferences)
- Preferences persist in localStorage

### i18n
- English (`en.json`) and German (`de.json`)
- Language switcher in settings

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

- Bundle is ~678KB (MUI is heavy) — consider code-splitting with dynamic imports
- Path alias `@/` → `src/` configured in vite.config.ts

## Git Conventions

- No `Co-Authored-By` in commits — single author only
