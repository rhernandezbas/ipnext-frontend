/**
 * Thin wrapper over the scheduling useVisibleColumns hook.
 * Uses 'tickets-visible-columns' as the localStorage key.
 *
 * Since the upstream hook has a hardcoded key, we re-implement the same
 * logic here with the tickets-specific storage key. The interface is
 * identical so the page can swap freely.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tickets-visible-columns';

export function useVisibleColumns(defaultKeys: string[]) {
  const [visible, setVisible] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultKeys;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultKeys;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(x => typeof x === 'string')) {
        return defaultKeys;
      }
      const missing = defaultKeys.filter(k => !parsed.includes(k));
      return missing.length > 0 ? [...parsed, ...missing] : parsed;
    } catch {
      return defaultKeys;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
    } catch {
      // Ignore quota / privacy-mode errors.
    }
  }, [visible]);

  const toggle = useCallback((key: string) => {
    setVisible(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  }, []);

  const reorder = useCallback((newOrder: string[]) => {
    setVisible(newOrder);
  }, []);

  const reset = useCallback(() => {
    setVisible(defaultKeys);
  }, [defaultKeys]);

  return { visible, toggle, reorder, reset, setVisible };
}
