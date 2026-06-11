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
const DEFAULT_STORAGE_KEY = 'scheduling-tasks-visible-columns';

/**
 * @param defaultKeys catalog of columns shown by default.
 * @param storageKey  localStorage namespace. Defaults to the Tareas page key so
 *   existing behaviour is unchanged. Pass a distinct key (e.g. 'nodeTasks') so
 *   sibling pages keep independent column preferences (#40).
 */
export function useVisibleColumns(defaultKeys: string[], storageKey: string = DEFAULT_STORAGE_KEY) {
  const STORAGE_KEY = storageKey;
  const [visible, setVisible] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultKeys;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultKeys;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(x => typeof x === 'string')) {
        return defaultKeys;
      }
      // Additive backfill: any key in defaultKeys that isn't in the stored
      // list is a NEW column added to the catalog since this user last
      // visited. Append it (in catalog order) so additive changes show up
      // automatically — without this, a user who customised columns once
      // would never see new columns until they manually reset.
      // Keys that were stored but are no longer in defaultKeys stay put;
      // TasksTableView already filters unknown keys at render time.
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
      // Ignore quota / privacy-mode errors — the UI still works in memory.
    }
  }, [visible, STORAGE_KEY]);

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
