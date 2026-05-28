import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useVisibleColumns } from '@/pages/scheduling/SchedulingTasksPage/hooks/useVisibleColumns';

const STORAGE_KEY = 'scheduling-tasks-visible-columns';

describe('useVisibleColumns', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns defaultKeys when nothing is stored', () => {
    const { result } = renderHook(() => useVisibleColumns(['a', 'b', 'c']));
    expect(result.current.visible).toEqual(['a', 'b', 'c']);
  });

  it('returns the stored list verbatim when every default key is already present', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['b', 'a']));
    const { result } = renderHook(() => useVisibleColumns(['a', 'b']));
    expect(result.current.visible).toEqual(['b', 'a']);
  });

  it('backfills a NEW catalog key that was added since the user last visited', () => {
    // The user previously persisted ['a', 'b']. Since then, 'c' was added to
    // the catalog. The new column MUST show up automatically instead of
    // staying invisible until the user manually resets their columns.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b']));
    const { result } = renderHook(() => useVisibleColumns(['a', 'b', 'c']));
    expect(result.current.visible).toEqual(['a', 'b', 'c']);
  });

  it('backfills multiple new keys at once preserving the existing order', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['title']));
    const { result } = renderHook(() => useVisibleColumns(['title', 'foo', 'bar']));
    // Stored order kept; new ones appended in catalog order.
    expect(result.current.visible).toEqual(['title', 'foo', 'bar']);
  });

  it('does NOT remove stored keys that are no longer in defaults (additive only)', () => {
    // A column removed from the catalog should not be silently dropped from
    // the stored list — TasksTableView already filters unknown keys at render
    // time. Keeping them preserves the user's intent if the column comes back.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['a', 'b', 'legacy']));
    const { result } = renderHook(() => useVisibleColumns(['a', 'b']));
    expect(result.current.visible).toEqual(['a', 'b', 'legacy']);
  });

  it('falls back to defaultKeys when stored JSON is corrupted', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    const { result } = renderHook(() => useVisibleColumns(['a', 'b']));
    expect(result.current.visible).toEqual(['a', 'b']);
  });

  it('falls back to defaultKeys when stored value is not an array of strings', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    const { result } = renderHook(() => useVisibleColumns(['a', 'b']));
    expect(result.current.visible).toEqual(['a', 'b']);
  });
});
