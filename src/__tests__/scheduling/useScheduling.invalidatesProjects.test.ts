import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/scheduling.api', () => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  moveTaskToStage: vi.fn(),
  bulkMoveToStage: vi.fn(),
  setTaskGeneralStatus: vi.fn(),
}));

import * as api from '@/api/scheduling.api';
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskStatus,
  useCloseTask,
  useMoveTaskToStage,
  useBulkMoveTasksToStage,
} from '@/hooks/useScheduling';
import { PROJECTS_KEY } from '@/hooks/useProjects';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ScheduledTask } from '@/types/scheduling';

const mockTask: ScheduledTask = {
  id: 'task-1',
  sequenceNumber: 1,
  title: 'Test Task',
  description: null,
  priority: 'normal',
  estimatedHours: 2,
  address: null,
  coordinates: null,
  category: 'installation',
  projectId: null,
  projectName: null,
  completedAt: null,
  notes: null,
  stageId: 'stage-1',
  stageCategory: 'nuevo',
  startDate: null,
  endDate: null,
  customerId: null,
  customerName: null,
  customerCity: null,
  contractId: null,
  partnerId: null,
  reporterId: null,
  assigneeId: null,
  assigneeName: null,
  watcherIds: [],
  travelTimeTo: null,
  travelTimeFrom: null,
  checklist: [],
  generalStatus: 'open',
  reviewedByInventory: false,
  iclassOrderCode: null,
  kind: 'customer',
  networkSiteId: null,
  networkSiteName: null,
  iclassCityCode: null,
  networkType: null,
  archivedAt: null,
  iclassStatus: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function createHarness() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, invalidateSpy, wrapper };
}

function projectsInvalidated(spy: ReturnType<typeof vi.spyOn>): boolean {
  return spy.mock.calls.some((call: unknown[]) => {
    const arg = call[0] as { queryKey?: readonly unknown[] } | undefined;
    const k = arg?.queryKey;
    return Array.isArray(k) && k.length === PROJECTS_KEY.length && k[0] === PROJECTS_KEY[0];
  });
}

describe('scheduling mutations invalidate projects query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useCreateTask invalidates [projects] on success', async () => {
    vi.mocked(api.createTask).mockResolvedValue(mockTask);
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    result.current.mutate({ title: 'x' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });

  it('useUpdateTask invalidates [projects] on success', async () => {
    vi.mocked(api.updateTask).mockResolvedValue(mockTask);
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useUpdateTask(), { wrapper });
    result.current.mutate({ id: 'task-1', data: { title: 'y' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });

  it('useDeleteTask invalidates [projects] on success', async () => {
    vi.mocked(api.deleteTask).mockResolvedValue(undefined as never);
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useDeleteTask(), { wrapper });
    result.current.mutate('task-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });

  it('useUpdateTaskStatus invalidates [projects] on success', async () => {
    vi.mocked(api.updateTaskStatus).mockResolvedValue(mockTask);
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper });
    result.current.mutate({ id: 'task-1', status: 'done' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });

  it('useCloseTask invalidates [projects] on success', async () => {
    // #41 — useCloseTask now writes via the general-status endpoint, not PUT.
    vi.mocked(api.setTaskGeneralStatus).mockResolvedValue({ ...mockTask });
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useCloseTask(), { wrapper });
    result.current.mutate({ id: 'task-1', isClosed: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });

  it('useMoveTaskToStage invalidates [projects] on success', async () => {
    vi.mocked(api.moveTaskToStage).mockResolvedValue({ ...mockTask, stageId: 'stage-2' });
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useMoveTaskToStage(), { wrapper });
    result.current.mutate({ id: 'task-1', stageId: 'stage-2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });

  it('useBulkMoveTasksToStage invalidates [projects] on settle', async () => {
    vi.mocked(api.bulkMoveToStage).mockResolvedValue({
      successful: ['task-1'],
      failed: [],
    } as never);
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useBulkMoveTasksToStage(), { wrapper });
    result.current.mutate({ ids: ['task-1'], stageId: 'stage-2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });
});
