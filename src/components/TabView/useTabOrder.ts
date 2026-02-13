import { useState, useCallback, useEffect } from 'react';

export function useTabOrder(tabIds: string[], storageKey?: string) {
  const [order, setOrder] = useState<string[]>(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          const valid = parsed.filter((id) => tabIds.includes(id));
          const missing = tabIds.filter((id) => !valid.includes(id));
          return [...valid, ...missing];
        }
      } catch { /* ignore */ }
    }
    return tabIds;
  });

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(order));
    }
  }, [order, storageKey]);

  const moveTab = useCallback((fromIndex: number, toIndex: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const moveLeft = useCallback((index: number) => {
    if (index > 0) moveTab(index, index - 1);
  }, [moveTab]);

  const moveRight = useCallback((index: number) => {
    setOrder((prev) => {
      if (index < prev.length - 1) {
        const next = [...prev];
        const [moved] = next.splice(index, 1);
        next.splice(index + 1, 0, moved);
        return next;
      }
      return prev;
    });
  }, []);

  return { order, moveTab, moveLeft, moveRight };
}
