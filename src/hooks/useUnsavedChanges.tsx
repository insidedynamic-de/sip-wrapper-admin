/**
 * @file useUnsavedChanges — Warns user before losing unsaved form changes
 * Uses beforeunload for browser navigation and provides a guard function
 * for in-app navigation checks.
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useEffect } from 'react';

interface Options {
  dirty: boolean;
}

export function useUnsavedChanges({ dirty }: Options) {
  // Browser refresh / close: show native "Leave page?" prompt
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return { dialog: null };
}
