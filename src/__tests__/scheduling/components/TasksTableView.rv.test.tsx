/**
 * Tests for the RV (Revisado por Inventario) column in TasksTableView.
 * TDD — written before implementation.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const moveAsync = vi.fn();
const deleteAsync = vi.fn();
const closeAsync = vi.fn();
const setInventoryReviewAsync = vi.fn();

vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage:         () => ({ mutateAsync: moveAsync,                isPending: false }),
  useBulkMoveTasksToStage:    () => ({ mutateAsync: vi.fn(),                   isPending: false }),
  useDeleteTask:              () => ({ mutateAsync: deleteAsync,               isPending: false }),
  useCloseTask:               () => ({ mutateAsync: closeAsync,                isPending: false }),
  useSetTaskInventoryReview:  () => ({ mutateAsync: setInventoryReviewAsync,   isPending: false }),
  useUpdateTask:              () => ({ mutateAsync: vi.fn(),                   isPending: false }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import { useAuth } from '@/hooks/useAuth';
import type { ScheduledTask } from '@/types/scheduling';
import type { AuthUser } from '@/types/auth';

const regularUser: AuthUser = {
  id: 2, username: 'user', email: 'u@b.com',
  displayName: 'User', role: 'technician', permissions: [],
};

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 't1', sequenceNumber: 1, title: 'Tarea RV',
    stageId: 's1', stageCategory: 'nuevo',
    projectId: null, priority: 'normal',
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    description: null, watcherIds: [], checklist: [],
    customerId: null, customerName: null, customerCity: null,
    serviceId: null, partnerId: null, reporterId: null,
    assigneeId: null, assigneeName: null,
    estimatedHours: 0, address: null, coordinates: null,
    category: 'installation', projectName: null,
    completedAt: null, notes: null,
    startDate: null, endDate: null,
    travelTimeTo: null, travelTimeFrom: null,
    isClosed: false,
    reviewedByInventory: false,
    ...overrides,
  } as ScheduledTask;
}

function setup(tasks: ScheduledTask[]) {
  return render(
    <MemoryRouter>
      <TasksTableView tasks={tasks} visibleColumnKeys={['reviewedByInventory']} />
    </MemoryRouter>,
  );
}

describe('TasksTableView — RV (inventory review) column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setInventoryReviewAsync.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: regularUser, isLoading: false,
      login: vi.fn(), logout: vi.fn(),
    });
  });

  it('renders a red indicator when reviewedByInventory is false', () => {
    setup([makeTask({ reviewedByInventory: false })]);
    const btn = screen.getByRole('button', { name: /RV: no revisado/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('data-reviewed', 'false');
  });

  it('renders a green indicator when reviewedByInventory is true', () => {
    setup([makeTask({ reviewedByInventory: true })]);
    const btn = screen.getByRole('button', { name: /RV: revisado/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('data-reviewed', 'true');
  });

  it('calls setInventoryReview(true) when clicking a false indicator', async () => {
    setup([makeTask({ reviewedByInventory: false })]);
    fireEvent.click(screen.getByRole('button', { name: /RV: no revisado/i }));
    await waitFor(() =>
      expect(setInventoryReviewAsync).toHaveBeenCalledWith({ id: 't1', reviewed: true }),
    );
  });

  it('calls setInventoryReview(false) when clicking a true indicator', async () => {
    setup([makeTask({ reviewedByInventory: true })]);
    fireEvent.click(screen.getByRole('button', { name: /RV: revisado/i }));
    await waitFor(() =>
      expect(setInventoryReviewAsync).toHaveBeenCalledWith({ id: 't1', reviewed: false }),
    );
  });
});
