/**
 * #114 — TasksTableView columna "Localidad": fallback a iclassCityCode para
 * tareas de nodo (kind: 'network') donde customerCity es null.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let permissions: string[] = ['scheduling.read', 'scheduling.write'];

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

function mkTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 't1', sequenceNumber: 1, title: 'Tarea test',
    stageId: 's1', stageCategory: 'pendiente', projectId: null,
    priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    description: null, watcherIds: [], checklist: [],
    customerId: null, customerName: null, customerCity: null,
    contractId: null, partnerId: null, reporterId: null,
    assigneeId: null, assigneeName: null,
    travelTimeTo: null, travelTimeFrom: null,
    completedAt: null, notes: null,
    address: null, coordinates: null, estimatedHours: 1,
    category: 'repair', isClosed: false, generalStatus: 'open',
    reviewedByInventory: false,
    iclassOrderCode: null,
    kind: 'customer', networkSiteId: null, networkSiteName: null,
    iclassCityCode: null, networkType: null,
    archivedAt: null,
    startDate: null,
    ...overrides,
  } as ScheduledTask;
}

function setup(tasks: ScheduledTask[]) {
  return render(
    <MemoryRouter>
      <TasksTableView
        tasks={tasks}
        loading={false}
        visibleColumnKeys={['customerCity']}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TasksTableView — columna Localidad (#114)', () => {
  it('tarea de nodo sin customerCity muestra iclassCityCode', () => {
    const task = mkTask({ kind: 'network', customerCity: null, iclassCityCode: 'CORDOBA' });
    setup([task]);
    expect(screen.getByText('CORDOBA')).toBeInTheDocument();
  });

  it('tarea de cliente con customerCity muestra customerCity', () => {
    const task = mkTask({ kind: 'customer', customerCity: 'Cordoba', iclassCityCode: null });
    setup([task]);
    expect(screen.getByText('Cordoba')).toBeInTheDocument();
  });

  it('ambos null muestra el placeholder —', () => {
    const task = mkTask({ kind: 'network', customerCity: null, iclassCityCode: null });
    setup([task]);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
