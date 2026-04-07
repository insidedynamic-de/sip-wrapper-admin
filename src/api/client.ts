/**
 * @file client — Axios API client with JWT auth interceptors
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import axios from 'axios';
import {
  getAccessToken, getRefreshToken, setTokens, clearTokens,
  isTokenExpired, getActiveTenantId, getImpersonateUser,
} from '../store/auth';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: add Bearer token + active tenant ──
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const imp = getImpersonateUser();
  if (imp) {
    config.headers['X-Impersonate-User-Id'] = String(imp.user_id);
  }
  // Only set if not explicitly provided in the request
  if (!config.headers['X-Tenant-Id']) {
    const tenantId = getActiveTenantId();
    if (tenantId) {
      config.headers['X-Tenant-Id'] = String(tenantId);
    }
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401, redirect on failure ──
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Don't retry refresh/login/register requests
    if (
      !err.response ||
      err.response.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/register') ||
      original.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(err);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      window.location.hash = '#/login';
      return Promise.reject(err);
    }

    // Deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = axios
        .post('/api/v1/auth/refresh', { refresh_token: refreshToken })
        .then((res) => {
          const newAccess = res.data.access_token;
          const newRefresh = res.data.refresh_token;
          setTokens(newAccess, newRefresh);
          return newAccess;
        })
        .catch(() => {
          clearTokens();
          window.location.hash = '#/login';
          return '';
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newToken = await refreshPromise;
    if (!newToken) return Promise.reject(err);

    original._retry = true;
    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);

/** Check if access token needs refresh before a critical operation */
export async function ensureFreshToken(): Promise<void> {
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (access && isTokenExpired(access) && refresh) {
    try {
      const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh });
      setTokens(res.data.access_token, res.data.refresh_token);
    } catch {
      clearTokens();
      window.location.hash = '#/login';
    }
  }
}

/** Set instance proxy prefix — all requests will be prefixed */
let _instancePrefix = '';
export function setInstancePrefix(prefix: string) { _instancePrefix = prefix; }
export function getInstancePrefix() { return _instancePrefix; }

// Override baseURL dynamically based on instance prefix
const originalGet = api.get.bind(api);
const originalPost = api.post.bind(api);
const originalPut = api.put.bind(api);
const originalDelete = api.delete.bind(api);
const originalPatch = api.patch.bind(api);

function prefixUrl(url: string): string {
  if (!_instancePrefix || url.startsWith('/auth') || url.startsWith('/admin') ||
      url.startsWith('/instance') || url.startsWith('/tenants') || url.startsWith('/features') ||
      url.startsWith('/my-instances') || url.startsWith('/products') || url.startsWith('/catalog') ||
      url.startsWith('/categories') || url === '/logs') {
    return url;
  }
  return `${_instancePrefix}${url}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
api.get = ((url: string, ...args: any[]) => originalGet(prefixUrl(url), ...args)) as typeof api.get;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
api.post = ((url: string, ...args: any[]) => originalPost(prefixUrl(url), ...args)) as typeof api.post;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
api.put = ((url: string, ...args: any[]) => originalPut(prefixUrl(url), ...args)) as typeof api.put;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
api.delete = ((url: string, ...args: any[]) => originalDelete(prefixUrl(url), ...args)) as typeof api.delete;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
api.patch = ((url: string, ...args: any[]) => originalPatch(prefixUrl(url), ...args)) as typeof api.patch;

export default api;
