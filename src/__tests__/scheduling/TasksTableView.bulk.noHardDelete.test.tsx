/**
 * #7 — TasksTableView bulk bar: hard-delete "Eliminar" MUST NOT appear, even when
 * canHardDelete is true (scheduling.hard_delete permission present). "Archivar"
 * MUST remain present.
 *
 * Individual hard-delete (row action) is untouched — we only strip the BULK variant.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let permissions: string[] = [];
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({
    isLoading: false,
    can: (perm: string | string[]) => {
      const arr = Array.isArray(perm) ? perm : [perm];
      return arr.some(p => permissions.includes(p));
    },
  }),
  useCan: (perm: string) => permissions.includes(perm),
}));

vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage:        () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkMoveTasksToStage:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCloseTask:              () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskInventoryReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskGeneralStatus:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveTask:            () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));
vi.mock('@/hooks/useIClassSendFeedback', () => ({
  useIClassSendFeedback: () => ({
    handleSuccess: vi.fn(),
    handleError: vi.fn(() => false),
    closeModal: vi.fn(),
    error: null,
    toast: null,
  }),
}));

import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import type { ScheduledTask } from '@/types/scheduling';

function mkTask(id: string, seq: number, generalStatus: 'closed' | 'open' = 'closed'): ScheduledTask {
  return {
    id, sequenceNumber: seq, title: `Tarea ${seq}`,
    stageId: 's1', stageCategory: 'hecho', projectId: null,
    priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    description: null, watcherIds: [], checklist: [],
    customerId: null, customerName: null, customerCity: null,
    contractId: null, partnerId: null, reporterId: null,
    assigneeId: null, assigneeName: null,
    travelTimeTo: null, travelTimeFrom: null,
    completedAt: null, notes: null,
    address: null, coordinates: null, estimatedHours: 1,
    category: 'repair', isClosed: generalStatus === 'closed', generalStatus,
    reviewedByInventory: false,
    iclassOrderCode: null,
    kind: 'customer', networkSiteId: null, networkSiteName: null,
    iclassCityCode: null, networkType: null,
    archivedAt: null,
    iclassStatus: null,
    startDate: null,
  } as unknown as ScheduledTask;
}

const closedTasks = [mkTask('t1', 1, 'closed'), mkTask('t2', 2, 'closed')];

function setup(tasks = closedTasks) {
  return render(
    <MemoryRouter>
      <TasksTableView tasks={tasks} loading={false} />
    </MemoryRouter>,
  );
}

function selectAll() {
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Include scheduling.hard_delete so the conditional would fire if it still exists
  permissions = ['scheduling.read', 'scheduling.write', 'scheduling.hard_delete', 'scheduling.move_stage'];
});

describe('TasksTableView — bulk bar: hard-delete removed (#7)', () => {
  it('bulk "Eliminar" is NOT present even when scheduling.hard_delete is in permissions', () => {
    setup();
    selectAll();
    // The bulk bar must be visible
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
    // But the delete button must be gone
    expect(screen.queryByTestId('bulk-delete-btn')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('"Archivar" is still present in the bulk bar', () => {
    setup();
    selectAll();
    expect(screen.getByTestId('bulk-archive-btn')).toBeInTheDocument();
  });

  it('"Limpiar" is still present in the bulk bar', () => {
    setup();
    selectAll();
    expect(screen.getByRole('button', { name: 'Limpiar selección' })).toBeInTheDocument();
  });
});
