import { useEffect, useRef } from 'react';
import { getInstancePrefix, isInstanceOffline } from '../api/client';

export function useAutoRefresh(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const id = setInterval(() => {
      // Skip polling when instance is offline (avoid 401/502 spam)
      if (getInstancePrefix() && isInstanceOffline()) return;
      savedCallback.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
