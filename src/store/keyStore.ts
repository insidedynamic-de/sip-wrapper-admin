/**
 * @file keyStore — Encrypted API key storage using AES-GCM
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */

const STORAGE_KEY = 'api_key_enc';
const SALT = 'sip-wrapper-admin-v2';

/** Derive an AES-GCM key from a static passphrase + origin */
async function deriveKey(): Promise<CryptoKey> {
  const passphrase = `${SALT}:${window.location.origin}`;
  const raw = new TextEncoder().encode(passphrase);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypt and store the API key */
export async function saveApiKey(apiKey: string): Promise<void> {
  try {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(apiKey);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    // Store as base64: iv + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    localStorage.setItem(STORAGE_KEY, btoa(String.fromCharCode(...combined)));
    // Also keep plain key in memory via legacy key for interceptor compatibility
    localStorage.setItem('api_key', apiKey);
  } catch {
    // Fallback: store plain if crypto fails (e.g. HTTP context)
    localStorage.setItem('api_key', apiKey);
  }
}

/** Load and decrypt the API key */
export async function loadApiKey(): Promise<string | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return localStorage.getItem('api_key');
    const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const key = await deriveKey();
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return localStorage.getItem('api_key');
  }
}

/** Remove the API key from storage and record logout time */
export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('api_key');
  localStorage.setItem('sip-wrapper-logout-at', String(Date.now()));
}

const CLEANUP_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

/** Check if demo data should be cleared (60 min after last logout) */
export function shouldCleanupDemoData(): boolean {
  const loggedOutAt = localStorage.getItem('sip-wrapper-logout-at');
  if (!loggedOutAt) return false;
  return Date.now() - Number(loggedOutAt) >= CLEANUP_TIMEOUT_MS;
}
