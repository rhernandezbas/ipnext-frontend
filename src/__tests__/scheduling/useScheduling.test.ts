import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/scheduling.api', () => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  moveTaskToStage: vi.fn(),
}));

import * as api from '@/api/scheduling.api';
import { useTask, useMoveTaskToStage } from '@/hooks/useScheduling';
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
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches task when id is provided', async () => {
    vi.mocked(api.getTask).mockResolvedValue(mockTask);
    const { result } = renderHook(() => useTask('task-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTask);
    expect(api.getTask).toHaveBeenCalledWith('task-1');
  });

  it('does not fetch when id is undefined', () => {
    const { result } = renderHook(() => useTask(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.getTask).not.toHaveBeenCalled();
  });

  it('does not fetch when id is empty string', () => {
    const { result } = renderHook(() => useTask(''), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.getTask).not.toHaveBeenCalled();
  });
});

describe('useMoveTaskToStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls moveTaskToStage API with id and stageId', async () => {
    vi.mocked(api.moveTaskToStage).mockResolvedValue({ ...mockTask, stageId: 'stage-2' });
    const { result } = renderHook(() => useMoveTaskToStage(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ id: 'task-1', stageId: 'stage-2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.moveTaskToStage).toHaveBeenCalledWith('task-1', 'stage-2');
  });
});
