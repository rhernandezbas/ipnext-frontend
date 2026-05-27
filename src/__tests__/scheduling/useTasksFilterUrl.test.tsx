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
});
