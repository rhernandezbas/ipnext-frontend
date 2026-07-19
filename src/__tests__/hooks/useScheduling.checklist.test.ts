/**
 * Tests for useToggleChecklistItem optimistic update and rollback.
 * Mocks at the API layer, not queryClient.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TaskChecklistItem } from '@/types/scheduling';
import type { ScheduledTask } from '@/types/scheduling';

// Mock the entire scheduling.api module
vi.mock('@/api/scheduling.api', () => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  moveTaskToStage: vi.fn(),
  addChecklistItem: vi.fn(),
  toggleChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  removeChecklistItem: vi.fn(),
  reorderChecklist: vi.fn(),
  assignTemplateToTask: vi.fn(),
  clearChecklist: vi.fn(),
}));

import * as schedulingApi from '@/api/scheduling.api';
import { useToggleChecklistItem } from '@/hooks/useScheduling';

const TASK_ID = 'task-1';
const ITEM_ID = 'item-1';

function makeChecklistItem(overrides: Partial<TaskChecklistItem> = {}): TaskChecklistItem {
  return {
    id: ITEM_ID,
    taskId: TASK_ID,
    text: 'Test item',
    done: false,
    order: 0,
    fromTemplateItemId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTask(checklist: TaskChecklistItem[]): ScheduledTask {
  return {
    id: TASK_ID,
    sequenceNumber: 1,
    title: 'Test Task',
    description: null,
    priority: 'normal',
    estimatedHours: 1,
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
    checklist,
    generalStatus: 'open',
    reviewedByInventory: false,
    iclassOrderCode: null,
    kind: 'customer',
    networkSiteId: null,
    networkSiteName: null,
    iclassCityCode: null,
    networkType: null,
    archivedAt: null,
    lastBroadcastAt: null,
    lastBroadcastByName: null,
    iclassStatus: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useToggleChecklistItem — optimistic update', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.clearAllMocks();
  });

  it('applies optimistic update (flips done) before API resolves', async () => {
    const item = makeChecklistItem({ done: false });
    const task = makeTask([item]);
    qc.setQueryData(['scheduling-task', TASK_ID], task);

    // API resolves after a delay (simulated with a resolvable promise)
    let resolveToggle!: (v: TaskChecklistItem) => void;
    vi.mocked(schedulingApi.toggleChecklistItem).mockReturnValue(
      new Promise(res => { resolveToggle = res; })
    );

    const { result } = renderHook(
      () => useToggleChecklistItem(TASK_ID),
      { wrapper: createWrapper(qc) }
    );

    // Trigger mutation — onMutate runs synchronously within TanStack Query
    act(() => { void result.current.mutate(ITEM_ID); });

    // After act flushes state updates, the optimistic update should be applied
    await waitFor(() => {
      const cachedTask = qc.getQueryData<ScheduledTask>(['scheduling-task', TASK_ID]);
      expect(cachedTask?.checklist[0].done).toBe(true);
    });

    // Resolve the API
    resolveToggle({ ...item, done: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back optimistic update on API error', async () => {
    const item = makeChecklistItem({ done: false });
    const task = makeTask([item]);
    qc.setQueryData(['scheduling-task', TASK_ID], task);

    vi.mocked(schedulingApi.toggleChecklistItem).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () => useToggleChecklistItem(TASK_ID),
      { wrapper: createWrapper(qc) }
    );

    await act(async () => {
      try {
        await result.current.mutateAsync(ITEM_ID);
      } catch {
        // expected error
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // After rollback, cache should show original (done: false)
    const cachedTask = qc.getQueryData<ScheduledTask>(['scheduling-task', TASK_ID]);
    expect(cachedTask?.checklist[0].done).toBe(false);
  });
});
