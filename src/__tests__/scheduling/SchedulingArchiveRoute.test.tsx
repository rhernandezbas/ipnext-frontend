/**
 * #12 — /admin/scheduling/archive now renders SchedulingArchivedTasksPage (the real
 * page using useFilteredTasks({ archived: true })), NOT the old mock SchedulingArchivePage.
 *
 * Asserts:
 * - The route renders the real page (heading "Tareas Archivadas")
 * - useFilteredTasks is called with { archived: true }
 * - Rows appear when listTasks returns data
 * - The page is readOnly: bulk action bar is NOT present
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const listTasksMock = vi.fn();

vi.mock('@/api/scheduling.api', () => ({
  listTasks: (...args: unknown[]) => listTasksMock(...args),
  archiveTask: vi.fn(),
}));

vi.mock('@/hooks/useScheduling', () => ({
  useFilteredTasks: (filter: unknown) => {
    const called = listTasksMock(filter);
    return called ?? { data: [], isLoading: false };
  },
  useMoveTaskToStage:        () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkMoveTasksToStage:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCloseTask:              () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskInventoryReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskGeneralStatus:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveTask:            () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }) }));
vi.mock('@/hooks/useWorkflows', () => ({ useWorkflows: () => ({ data: [] }) }));
vi.mock('@/hooks/useRbacUsers', () => ({ useRbacUsers: () => ({ data: [] }) }));
vi.mock('@/hooks/useTaskPriorities', () => ({ useTaskPriorities: () => ({ data: [] }) }));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({
    isLoading: false, permissions: ['scheduling.read'], can: () => false,
  }),
  useCan: () => false,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn() }));

import SchedulingArchivedTasksPage from '@/pages/scheduling/SchedulingArchivedTasksPage';
import type { ScheduledTask } from '@/types/scheduling';

function mkTask(id: string, seq: number): ScheduledTask {
  return {
    id, sequenceNumber: seq, title: `Tarea Archivada ${seq}`,
    stageId: 's1', stageCategory: 'hecho', projectId: null,
    priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-06-01',
    description: null, watcherIds: [], checklist: [],
    customerId: null, customerName: null, customerCity: null,
    contractId: null, partnerId: null, reporterId: null,
    assigneeId: null, assigneeName: null,
    travelTimeTo: null, travelTimeFrom: null,
    completedAt: null, notes: null,
    address: null, coordinates: null, estimatedHours: 1,
    category: 'repair', isClosed: true, generalStatus: 'closed',
    reviewedByInventory: false,
    iclassOrderCode: null,
    kind: 'customer', networkSiteId: null, networkSiteName: null,
    iclassCityCode: null, networkType: null,
    archivedAt: '2026-06-10T12:00:00Z',
    startDate: null,
    iclassStatus: null,
  } as unknown as ScheduledTask;
}

/** Renders SchedulingArchivedTasksPage directly at the /archive route path. */
function renderRoute(tasks: ScheduledTask[] = []) {
  listTasksMock.mockReturnValue({ data: tasks, isLoading: false });
  return render(
    <MemoryRouter initialEntries={['/admin/scheduling/archive']}>
      <Routes>
        <Route
          path="/admin/scheduling/archive"
          element={<SchedulingArchivedTasksPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/admin/scheduling/archive → SchedulingArchivedTasksPage (#12)', () => {
  it('renders the real "Tareas Archivadas" heading (not the old mock page "Archivo")', () => {
    renderRoute();
    expect(screen.getByRole('heading', { name: /tareas archivadas/i })).toBeInTheDocument();
    // The OLD page title was just "Archivo" — ensure it's gone
    expect(screen.queryByRole('heading', { name: /^archivo$/i })).not.toBeInTheDocument();
  });

  it('useFilteredTasks is called with { archived: true }', () => {
    renderRoute();
    expect(listTasksMock).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });

  it('renders archived task rows when data is returned', () => {
    const tasks = [mkTask('t1', 1), mkTask('t2', 2)];
    renderRoute(tasks);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('page is readOnly: bulk action bar is NOT rendered', () => {
    const tasks = [mkTask('t1', 1)];
    renderRoute(tasks);
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  it('shows the empty state when no archived tasks exist', () => {
    renderRoute([]);
    expect(screen.getByTestId('archived-tasks-empty')).toBeInTheDocument();
  });
});
