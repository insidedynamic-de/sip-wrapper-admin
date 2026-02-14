/**
 * @file client — Axios API client with interceptors for auth and host config
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import axios from 'axios';
import demoAdapter from './demoAdapter';
import { seedDemoData, resetDemoData } from './demoData';
import { isDemoMode } from '../store/preferences';
import { clearApiKey, shouldCleanupDemoData } from '../store/keyStore';

// Restore saved host on startup
const savedHost = localStorage.getItem('api_host');
const baseURL = savedHost ? `${savedHost}/api/v1` : '/api/v1';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Add API key to every request
api.interceptors.request.use((config) => {
  const key = localStorage.getItem('api_key');
  if (key) config.headers['X-API-Key'] = key;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearApiKey();
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

/** Enable or disable demo mode on the API client */
export function setDemoAdapter(enabled: boolean): void {
  if (enabled) {
    // If 60+ minutes since last logout, reset demo data to defaults
    if (shouldCleanupDemoData()) {
      resetDemoData();
      localStorage.removeItem('sip-wrapper-logout-at');
    } else {
      seedDemoData();
    }
    api.defaults.adapter = demoAdapter as never;
  } else {
    api.defaults.adapter = undefined as never;
  }
}

// Initialize on load: if preferences say demo mode, activate immediately
if (isDemoMode()) {
  setDemoAdapter(true);
}

export default api;
