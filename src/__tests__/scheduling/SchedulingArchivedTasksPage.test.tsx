/**
 * #86 — SchedulingArchivedTasksPage.
 *
 * Renders a list of archived tasks (filter archived:true). Shows an empty state
 * when there are no results. The page is purely read-only (no destructive actions).
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Module mocks (hoisted) ─────────────────────────────────────────────────────

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
    isLoading: false, isError: false, permissions: ['scheduling.read'], roles: [], user: null,
    can: () => false,
  }),
  useCan: () => false,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn() }));

import SchedulingArchivedTasksPage from '@/pages/scheduling/SchedulingArchivedTasksPage';
import type { ScheduledTask } from '@/types/scheduling';

function mkArchivedTask(id: string, seq: number): ScheduledTask {
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
  } as ScheduledTask;
}

describe('SchedulingArchivedTasksPage — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTasksMock.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders the page title', () => {
    render(<MemoryRouter><SchedulingArchivedTasksPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /tareas archivadas/i })).toBeInTheDocument();
  });

  it('shows empty state when no archived tasks exist', () => {
    render(<MemoryRouter><SchedulingArchivedTasksPage /></MemoryRouter>);
    expect(screen.getByTestId('archived-tasks-empty')).toBeInTheDocument();
    expect(screen.getByText(/no hay tareas archivadas/i)).toBeInTheDocument();
  });

  it('passes archived:true filter to useFilteredTasks', () => {
    render(<MemoryRouter><SchedulingArchivedTasksPage /></MemoryRouter>);
    // useFilteredTasks is called with the filter object containing archived:true
    expect(listTasksMock).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });
});

describe('SchedulingArchivedTasksPage — with data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const archivedTasks = [mkArchivedTask('t1', 1), mkArchivedTask('t2', 2)];
    listTasksMock.mockReturnValue({ data: archivedTasks, isLoading: false });
  });

  it('renders archived task rows when data is returned', () => {
    render(<MemoryRouter><SchedulingArchivedTasksPage /></MemoryRouter>);
    expect(screen.queryByTestId('archived-tasks-empty')).not.toBeInTheDocument();
    // The tasks table is shown
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('link back to tasks page is present', () => {
    render(<MemoryRouter><SchedulingArchivedTasksPage /></MemoryRouter>);
    const backLink = screen.getByRole('link', { name: /volver a tareas/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/admin/scheduling/tasks');
  });
});
