/**
 * @file useColumnOrder — Hook for persisting draggable column order in localStorage
 * @author Viktor Nikolayev <viktor.nikolayev@gmail.com>
 */
import { useState, useCallback, useEffect } from 'react';

export function useColumnOrder(columnIds: string[], storageKey?: string) {
  const [order, setOrder] = useState<string[]>(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          const valid = parsed.filter((id) => columnIds.includes(id));
          const missing = columnIds.filter((id) => !valid.includes(id));
          return [...valid, ...missing];
        }
      } catch { /* ignore */ }
    }
    return columnIds;
  });

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(order));
    }
  }, [order, storageKey]);

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  return { order, moveColumn };
}
