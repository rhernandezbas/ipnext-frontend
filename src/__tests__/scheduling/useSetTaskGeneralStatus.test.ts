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
import { useSetTaskGeneralStatus, useCloseTask } from '@/hooks/useScheduling';
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
  reviewedByInventory: false,
  iclassOrderCode: null,
  kind: 'customer',
  networkSiteId: null,
  networkSiteName: null,
  generalStatus: 'open',
  iclassCityCode: null,
  networkType: null,
  archivedAt: null,
  lastBroadcastAt: null,
  lastBroadcastByName: null,
  iclassStatus: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function createHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, invalidateSpy, wrapper };
}

function invalidatedKey(spy: ReturnType<typeof vi.spyOn>, head: unknown): boolean {
  return spy.mock.calls.some((call: unknown[]) => {
    const arg = call[0] as { queryKey?: readonly unknown[] } | undefined;
    const k = arg?.queryKey;
    return Array.isArray(k) && k[0] === head;
  });
}

function projectsInvalidated(spy: ReturnType<typeof vi.spyOn>): boolean {
  return spy.mock.calls.some((call: unknown[]) => {
    const arg = call[0] as { queryKey?: readonly unknown[] } | undefined;
    const k = arg?.queryKey;
    return Array.isArray(k) && k.length === PROJECTS_KEY.length && k[0] === PROJECTS_KEY[0];
  });
}

describe('useSetTaskGeneralStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls setTaskGeneralStatus API with id and status', async () => {
    vi.mocked(api.setTaskGeneralStatus).mockResolvedValue({ ...mockTask, generalStatus: 'closed', isClosed: true });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useSetTaskGeneralStatus(), { wrapper });
    result.current.mutate({ id: 'task-1', status: 'closed' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.setTaskGeneralStatus).toHaveBeenCalledWith('task-1', 'closed');
  });

  it('invalidates scheduling-tasks, scheduling-task, task-activity and projects on success', async () => {
    vi.mocked(api.setTaskGeneralStatus).mockResolvedValue({ ...mockTask, generalStatus: 'dismissed' });
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useSetTaskGeneralStatus(), { wrapper });
    result.current.mutate({ id: 'task-1', status: 'dismissed' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidatedKey(invalidateSpy, 'scheduling-tasks')).toBe(true);
    expect(invalidatedKey(invalidateSpy, 'scheduling-task')).toBe(true);
    expect(invalidatedKey(invalidateSpy, 'task-activity')).toBe(true);
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });
});

describe('useCloseTask (re-implemented over setTaskGeneralStatus)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps isClosed:true → status "closed" via setTaskGeneralStatus', async () => {
    vi.mocked(api.setTaskGeneralStatus).mockResolvedValue({ ...mockTask, generalStatus: 'closed', isClosed: true });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useCloseTask(), { wrapper });
    result.current.mutate({ id: 'task-1', isClosed: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.setTaskGeneralStatus).toHaveBeenCalledWith('task-1', 'closed');
    expect(api.updateTask).not.toHaveBeenCalled();
  });

  it('maps isClosed:false → status "open" via setTaskGeneralStatus', async () => {
    vi.mocked(api.setTaskGeneralStatus).mockResolvedValue({ ...mockTask, generalStatus: 'open', isClosed: false });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useCloseTask(), { wrapper });
    result.current.mutate({ id: 'task-1', isClosed: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.setTaskGeneralStatus).toHaveBeenCalledWith('task-1', 'open');
  });

  it('invalidates projects on success (signature intact)', async () => {
    vi.mocked(api.setTaskGeneralStatus).mockResolvedValue({ ...mockTask, generalStatus: 'closed', isClosed: true });
    const { wrapper, invalidateSpy } = createHarness();
    const { result } = renderHook(() => useCloseTask(), { wrapper });
    result.current.mutate({ id: 'task-1', isClosed: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsInvalidated(invalidateSpy)).toBe(true);
  });
});
