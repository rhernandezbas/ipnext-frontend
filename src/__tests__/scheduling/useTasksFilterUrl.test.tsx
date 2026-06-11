import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTasksFilterUrl } from '@/pages/scheduling/SchedulingTasksPage/hooks/useTasksFilterUrl';

function wrapperFor(initialUrl: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
}

describe('useTasksFilterUrl', () => {
  // #27 — the priority filter is a CATALOG name (TaskPriority catalog: Baja /
  // Normal / Alta / Urgente, operator-editable). The hook used to whitelist it
  // against the legacy hardcoded enum (low/normal/high/urgent), so every real
  // catalog value got dropped to undefined and the filter never fired.
  it('reads a catalog priority name from the URL (#27)', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks?priority=Alta'),
    });
    expect(result.current.filter.priority).toBe('Alta');
  });

  it('round-trips a catalog priority through setFilter (#27)', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks'),
    });

    act(() => result.current.setFilter({ priority: 'Urgente' }));

    expect(result.current.filter.priority).toBe('Urgente');
  });

  it('preserves the priority when another filter changes (#27)', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks?priority=Baja'),
    });

    act(() => result.current.setFilter({ q: 'fibra' }));

    expect(result.current.filter.priority).toBe('Baja');
    expect(result.current.filter.q).toBe('fibra');
  });

  it('clears the priority when the patch sets it to undefined (chip ×)', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks?priority=Normal'),
    });

    act(() => result.current.setFilter({ priority: undefined }));

    expect(result.current.filter.priority).toBeUndefined();
  });

  it('reads projectId from the URL', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks?projectId=p1'),
    });
    expect(result.current.filter.projectId).toBe('p1');
  });

  it('clears projectId when the patch explicitly sets it to undefined (X on chip)', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks?projectId=p1'),
    });
    expect(result.current.filter.projectId).toBe('p1');

    act(() => result.current.setFilter({ projectId: undefined, stageIds: [] }));

    expect(result.current.filter.projectId).toBeUndefined();
    expect(result.current.filter.stageIds).toEqual([]);
  });

  it('clears every field when "Limpiar todo" passes all keys as undefined', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks?projectId=p1&partnerId=pa1&assigneeId=a1&q=foo'),
    });
    expect(result.current.filter.projectId).toBe('p1');
    expect(result.current.filter.partnerId).toBe('pa1');

    act(() =>
      result.current.setFilter({
        projectId: undefined,
        stageIds: [],
        q: undefined,
        partnerId: undefined,
        assigneeId: undefined,
        priority: undefined,
      }),
    );

    expect(result.current.filter.projectId).toBeUndefined();
    expect(result.current.filter.partnerId).toBeUndefined();
    expect(result.current.filter.assigneeId).toBeUndefined();
    expect(result.current.filter.q).toBeUndefined();
  });

  it('preserves fields that are NOT present in the patch', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: wrapperFor('/admin/scheduling/tasks?projectId=p1&partnerId=pa1'),
    });

    // Patch only touches partnerId — projectId must survive untouched.
    act(() => result.current.setFilter({ partnerId: 'pa2' }));

    expect(result.current.filter.projectId).toBe('p1');
    expect(result.current.filter.partnerId).toBe('pa2');
  });

  // ── General status filter (#41) ─────────────────────────────────────────────
  describe('general status (#41)', () => {
    it('defaults status to "open" when no status param is present', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks'),
      });
      expect(result.current.filter.status).toBe('open');
    });

    it('reads status=closed from the URL', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks?status=closed'),
      });
      expect(result.current.filter.status).toBe('closed');
    });

    it('reads status=all from the URL', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks?status=all'),
      });
      expect(result.current.filter.status).toBe('all');
    });

    it('falls back to "open" for an invalid status param', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks?status=garbage'),
      });
      expect(result.current.filter.status).toBe('open');
    });

    it('round-trips status=dismissed through setFilter', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks'),
      });
      act(() => result.current.setFilter({ status: 'dismissed' }));
      expect(result.current.filter.status).toBe('dismissed');
    });

    it('omits status from the URL when it is "open" (re-derived on read)', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks?status=closed'),
      });
      // Switching back to open must clear the URL param but still read as open.
      act(() => result.current.setFilter({ status: 'open' }));
      expect(result.current.filter.status).toBe('open');
    });

    it('preserves status when another filter changes', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks?status=closed'),
      });
      act(() => result.current.setFilter({ q: 'fibra' }));
      expect(result.current.filter.status).toBe('closed');
      expect(result.current.filter.q).toBe('fibra');
    });

    it('clearFilter resets status back to the default "open"', () => {
      const { result } = renderHook(() => useTasksFilterUrl(), {
        wrapper: wrapperFor('/admin/scheduling/tasks?status=dismissed&projectId=p1'),
      });
      act(() => result.current.clearFilter());
      expect(result.current.filter.status).toBe('open');
      expect(result.current.filter.projectId).toBeUndefined();
    });
  });
});
