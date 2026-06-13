import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'admin', email: 'a@b.com', displayName: 'Admin', role: 'admin', permissions: [] }, isLoading: false, login: vi.fn(), logout: vi.fn() }),
}));

import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import type { ScheduledTask } from '@/types/scheduling';
import type { Admin } from '@/types/admin';

const admins: Admin[] = [
  { id: 'a1', name: 'Emanuel',     email: 'em@x.com', role: 'admin',      status: 'active', createdAt: '', lastLogin: null },
  { id: 'a2', name: 'Luis Sarcos', email: 'lu@x.com', role: 'technician', status: 'active', createdAt: '', lastLogin: null },
];

function makeTask(overrides: Partial<ScheduledTask>): ScheduledTask {
  return {
    id: 't1', sequenceNumber: 1, title: 'Tarea',
    stageId: 's1', stageCategory: 'nuevo',
    projectId: null, priority: 'normal',
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    description: null, watcherIds: [], checklist: [],
    customerId: null, customerName: null,
    isClosed: false,
    ...overrides,
  } as unknown as ScheduledTask;
}

function renderWith(task: ScheduledTask, adminsProp: Admin[] | undefined = admins) {
  return render(
    <MemoryRouter>
      <TasksTableView
        tasks={[task]}
        admins={adminsProp}
        visibleColumnKeys={['sequenceNumber', 'reporterName']}
      />
    </MemoryRouter>,
  );
}

describe('TasksTableView — Reporter column', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the admin name when the task reporterId matches an admin', () => {
    renderWith(makeTask({ reporterId: 'a1' }));
    expect(screen.getByText('Emanuel')).toBeInTheDocument();
  });

  it('renders an em-dash placeholder when the task has no reporter', () => {
    renderWith(makeTask({ reporterId: null }));
    // The em-dash is in the reporterName cell — assert via the column cell.
    // Use queryAllByText to be tolerant if "—" appears elsewhere in the row.
    const dashes = screen.queryAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders an em-dash when reporterId does not match any known admin', () => {
    // Different reporter — pick a name that ISN'T in admins. Without a real
    // resolution, the cell must fall back to "—" instead of leaking the raw id.
    renderWith(makeTask({ reporterId: 'unknown-id' }));
    const dashes = screen.queryAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    // And critically, the raw id must NOT leak into the UI.
    expect(screen.queryByText('unknown-id')).not.toBeInTheDocument();
  });

  it('uses the Reporter column label in the table header', () => {
    renderWith(makeTask({ reporterId: 'a1' }));
    expect(screen.getByRole('columnheader', { name: 'Reporter' })).toBeInTheDocument();
  });
});
