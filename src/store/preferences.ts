import type { ColorTheme } from '../theme/colors';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type TimeFormat = '24h' | '12h';
export type DateFormat = 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export interface Preferences {
  darkMode: boolean;
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  language: string;
  refreshInterval: number;
  demoMode: boolean;
  autoLogout: boolean;
  autoLogoutTimeout: number;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  sidebarCollapsed: boolean;
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
  timeFormat: '24h',
  dateFormat: 'DD.MM.YYYY',
  sidebarCollapsed: false,
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

/** Format a Date or ISO string using the user's preferred date/time format */
export function formatDateTime(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const p = loadPreferences();
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const mon = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let datePart: string;
  if (p.dateFormat === 'MM/DD/YYYY') datePart = `${mon}/${day}/${year}`;
  else if (p.dateFormat === 'YYYY-MM-DD') datePart = `${year}-${mon}-${day}`;
  else datePart = `${day}.${mon}.${year}`;
  let timePart: string;
  if (p.timeFormat === '12h') {
    const h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    timePart = `${h12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
  } else {
    timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return `${datePart} ${timePart}`;
}
