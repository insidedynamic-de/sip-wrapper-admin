/**
 * @file LicenseOverlay — CSS-proof overlay for expired licenses
 * Uses MutationObserver + interval to prevent removal via DevTools
 */
import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const OVERLAY_ID = '__license_overlay__';
const GUARD_INTERVAL = 500;

interface Props {
  active: boolean;
}

export default function LicenseOverlay({ active }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const observerRef = useRef<MutationObserver | null>(null);
  const intervalRef = useRef<number>(0);

  const createOverlay = useCallback(() => {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = OVERLAY_ID;

    // Inline styles — harder to override via DevTools class manipulation
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: '999999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'not-allowed',
      userSelect: 'none',
      pointerEvents: 'auto',
    });

    // Block all events
    const blocker = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    el.addEventListener('click', blocker, true);
    el.addEventListener('mousedown', blocker, true);
    el.addEventListener('mouseup', blocker, true);
    el.addEventListener('keydown', blocker, true);
    el.addEventListener('keyup', blocker, true);
    el.addEventListener('touchstart', blocker, true);
    el.addEventListener('contextmenu', blocker, true);

    // Message box
    const box = document.createElement('div');
    Object.assign(box.style, {
      backgroundColor: '#1a1a2e',
      borderRadius: '16px',
      padding: '48px',
      maxWidth: '480px',
      textAlign: 'center',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.1)',
    });

    const icon = document.createElement('div');
    icon.textContent = '\u26A0';
    Object.assign(icon.style, {
      fontSize: '48px',
      marginBottom: '16px',
    });

    const title = document.createElement('h2');
    title.textContent = t('license.expired_overlay_title');
    Object.assign(title.style, {
      color: '#ff6b6b',
      margin: '0 0 12px 0',
      fontSize: '24px',
      fontFamily: 'inherit',
    });

    const msg = document.createElement('p');
    msg.textContent = t('license.expired_overlay_message');
    Object.assign(msg.style, {
      color: 'rgba(255,255,255,0.7)',
      margin: '0 0 24px 0',
      fontSize: '14px',
      lineHeight: '1.5',
      fontFamily: 'inherit',
    });

    const btn = document.createElement('button');
    btn.textContent = t('license.go_to_license');
    Object.assign(btn.style, {
      backgroundColor: '#1976d2',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 32px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      fontFamily: 'inherit',
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Temporarily remove overlay, navigate to profile (license tab)
      el!.style.display = 'none';
      navigate('/profile');
      // Re-show overlay after a tick so license page loads under it
      // but let the license page be usable
      setTimeout(() => {
        if (el && document.body.contains(el)) {
          el.style.display = 'none';
        }
      }, 100);
    });

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(msg);
    box.appendChild(btn);
    el.appendChild(box);

    document.body.appendChild(el);
    return el;
  }, [t, navigate]);

  const removeOverlay = useCallback(() => {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }, []);

  const ensureOverlay = useCallback(() => {
    if (!document.getElementById(OVERLAY_ID)) {
      createOverlay();
    }
    // Ensure critical styles haven't been tampered with
    const el = document.getElementById(OVERLAY_ID);
    if (el) {
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.zIndex = '999999';
      el.style.pointerEvents = 'auto';
      // Don't force display if on license page
      if (!window.location.hash.includes('/profile')) {
        el.style.display = 'flex';
      }
    }
  }, [createOverlay]);

  useEffect(() => {
    if (!active) {
      removeOverlay();
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = 0;
      }
      return;
    }

    // Create overlay
    createOverlay();

    // MutationObserver: re-inject if removed from DOM
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const removed of mutation.removedNodes) {
          if (removed instanceof HTMLElement && removed.id === OVERLAY_ID) {
            // Re-add immediately
            createOverlay();
          }
        }
      }
    });
    observerRef.current.observe(document.body, { childList: true, subtree: false });

    // Interval: verify overlay exists and styles are correct
    intervalRef.current = window.setInterval(ensureOverlay, GUARD_INTERVAL);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = 0;
      }
      removeOverlay();
    };
  }, [active, createOverlay, removeOverlay, ensureOverlay]);

  return null;
}
