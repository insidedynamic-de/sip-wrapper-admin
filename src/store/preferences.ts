import type { ColorTheme } from '../theme/colors';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Preferences {
  darkMode: boolean;
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  language: string;
  refreshInterval: number;
  demoMode: boolean;
  autoLogout: boolean;
  autoLogoutTimeout: number;
}

const STORAGE_KEY = 'sip-wrapper-prefs';

const defaults: Preferences = {
  darkMode: false,
  themeMode: 'light',
  colorTheme: 'default',
  language: 'en',
  refreshInterval: 30,
  demoMode: false,
  autoLogout: false,
  autoLogoutTimeout: 300,
};

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { ...defaults, ...JSON.parse(raw) };
      // Migrate from old darkMode boolean to themeMode
      if (!parsed.themeMode && parsed.darkMode !== undefined) {
        parsed.themeMode = parsed.darkMode ? 'dark' : 'light';
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return { ...defaults };
}

export function isDemoMode(): boolean {
  return loadPreferences().demoMode;
}

export function savePreferences(prefs: Partial<Preferences>) {
  const current = loadPreferences();
  const merged = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}
