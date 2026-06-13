/**
 * #75 — Área column moves to position 2 (right after ID) in the DEFAULT order.
 *
 * The default order is derived as ALL_TICKET_COLUMNS.map(c => c.key). The
 * useVisibleColumns hook (localStorage 'tickets-visible-columns') already
 * RESPECTS a saved order: a user who reordered their columns must NOT be
 * clobbered by the new default — only the default for a user with nothing saved
 * changes. These tests pin both halves.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ALL_TICKET_COLUMNS } from '@/pages/tickets/TicketsListPage';
import { useVisibleColumns } from '@/pages/tickets/TicketsListPage/hooks/useVisibleColumns';

const STORAGE_KEY = 'tickets-visible-columns';

describe('Tickets list — default column order (#75)', () => {
  beforeEach(() => window.localStorage.clear());

  it('places areaName at position 2 (right after id) in the catalog', () => {
    const keys = ALL_TICKET_COLUMNS.map(c => c.key);
    expect(keys[0]).toBe('id');
    expect(keys[1]).toBe('areaName');
  });

  it('a user with NOTHING saved gets the new default order (areaName at index 1)', () => {
    const defaults = ALL_TICKET_COLUMNS.map(c => c.key);
    const { result } = renderHook(() => useVisibleColumns(defaults));
    expect(result.current.visible[0]).toBe('id');
    expect(result.current.visible[1]).toBe('areaName');
  });

  it('a user with a SAVED custom order is NOT clobbered by the new default', () => {
    // Operator had areaName last on purpose. The saved order wins; the new
    // default must not reshuffle their columns.
    const saved = ['id', 'subject', 'status', 'areaName'];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const defaults = ALL_TICKET_COLUMNS.map(c => c.key);
    const { result } = renderHook(() => useVisibleColumns(defaults));
    // Their explicit order is preserved up front…
    expect(result.current.visible.slice(0, 4)).toEqual(saved);
    // …and any keys they never had (newly-added defaults) are appended, not injected.
    expect(result.current.visible[1]).not.toBe('areaName');
  });
});
