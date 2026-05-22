import { useCallback, useEffect, useState } from 'react';

/**
 * Persists which columns of the Tasks table are visible to the current user.
 * Keyed in localStorage so the choice survives reload/login. Falls back to
 * `defaultKeys` when nothing is stored yet or when JSON is corrupted.
 *
 * Behaviour matches the Splynx column-visibility menu: clicking a column
 * toggles its inclusion in the array; the table only renders columns whose
 * `key` is present.
 */
const STORAGE_KEY = 'scheduling-tasks-visible-columns';

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
      return parsed;
    } catch {
      return defaultKeys;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
    } catch {
      // Ignore quota / privacy-mode errors — the UI still works in memory.
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
