import type { ColorTheme } from '../theme/colors';

export interface Preferences {
  darkMode: boolean;
  colorTheme: ColorTheme;
  language: string;
  refreshInterval: number;
}

const STORAGE_KEY = 'sip-wrapper-prefs';

const defaults: Preferences = {
  darkMode: false,
  colorTheme: 'default',
  language: 'en',
  refreshInterval: 30,
};

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaults };
}

export function savePreferences(prefs: Partial<Preferences>) {
  const current = loadPreferences();
  const merged = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}
