import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const bulkAsync = vi.fn();
const updateAsync = vi.fn();
const deleteAsync = vi.fn();
const closeAsync = vi.fn();
const archiveAsync = vi.fn();
const setStatusAsync = vi.fn();

vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage:        () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkMoveTasksToStage:   () => ({ mutateAsync: bulkAsync, isPending: false }),
  useDeleteTask:             () => ({ mutateAsync: deleteAsync, isPending: false }),
  useCloseTask:              () => ({ mutateAsync: closeAsync, isPending: false }),
  useSetTaskInventoryReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask:             () => ({ mutateAsync: updateAsync, isPending: false }),
  useSetTaskGeneralStatus:   () => ({ mutateAsync: setStatusAsync, isPending: false }),
  useArchiveTask:            () => ({ mutateAsync: archiveAsync, isPending: false }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

let permissions: string[] = ['scheduling.write', 'scheduling.move_stage', 'scheduling.hard_delete'];
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({
    isLoading: false, isError: false, permissions, roles: [], user: null,
    can: (perm: string | string[]) => {
      const arr = Array.isArray(perm) ? perm : [perm];
      return arr.some(p => p === '*' || permissions.includes(p));
    },
  }),
  useCan: (perm: string) => permissions.includes(perm) || permissions.includes('*'),
}));

const confirmFn = vi.fn().mockResolvedValue(true);
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => confirmFn }));


import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import { useAuth } from '@/hooks/useAuth';
import type { ScheduledTask } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import type { AuthUser } from '@/types/auth';

const stages: WorkflowStage[] = [
  { id: 's1', workflowId: 'wf1', name: 'Nuevo', category: 'nuevo', order: 0 },
  { id: 's-iclass', workflowId: 'wf1', name: 'Enviar a IClass', category: 'enProgreso', order: 1 },
];

function mkTask(id: string, seq: number, generalStatus: 'open' | 'closed' | 'dismissed' = 'open'): ScheduledTask {
  return {
    id, sequenceNumber: seq, title: `Tarea ${seq}`, stageId: 's1', stageCategory: 'nuevo',
    projectId: 'p1', priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    description: null, watcherIds: [], checklist: [], reviewedByInventory: false, iclassOrderCode: null,
    generalStatus, isClosed: generalStatus === 'closed', archivedAt: null,
    customerId: null, customerName: null, customerCity: null, contractId: null, partnerId: null,
    reporterId: null, assigneeId: null, assigneeName: null, travelTimeTo: null, travelTimeFrom: null,
    completedAt: null, notes: null, address: null, coordinates: null, estimatedHours: 1,
    category: 'repair' as const, kind: 'customer' as const, networkSiteId: null, networkSiteName: null,
    iclassCityCode: null, networkType: null,
  } as ScheduledTask;
}
const tasks = [mkTask('t1', 1), mkTask('t2', 2), mkTask('t3', 3)];

const user: AuthUser = { id: 2, username: 'u', email: 'u@b.com', displayName: 'U', role: 'technician', permissions: [] };

function setup() {
  return render(
    <MemoryRouter>
      <TasksTableView tasks={tasks} availableStages={stages} visibleColumnKeys={['sequenceNumber', 'title']} />
    </MemoryRouter>,
  );
}

/** Select all rows, open the move dialog, pick the IClass stage and confirm. */
function bulkMoveToIClass() {
  // header select-all checkbox is the first checkbox
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Mover estado' }));
  const dialog = screen.getByRole('dialog', { name: /Mover/ });
  fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 's-iclass' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Mover' }));
}

const closedTasks = [mkTask('t1', 1, 'closed'), mkTask('t2', 2, 'closed'), mkTask('t3', 3, 'closed')];
const admins = [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Luis' }];

function setupWithAdmins(taskList = tasks) {
  return render(
    <MemoryRouter>
      <TasksTableView tasks={taskList} availableStages={stages} visibleColumnKeys={['sequenceNumber', 'title']} admins={admins} />
    </MemoryRouter>,
  );
}

describe('TasksTableView — bulk move to IClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = ['scheduling.write', 'scheduling.move_stage', 'scheduling.hard_delete'];
    confirmFn.mockResolvedValue(true);
    updateAsync.mockResolvedValue({});
    deleteAsync.mockResolvedValue({});
    closeAsync.mockResolvedValue({});
    archiveAsync.mockResolvedValue({});
    setStatusAsync.mockResolvedValue({});
    bulkAsync.mockResolvedValue({ summary: { total: 0, ok: 0, failed: 0 }, results: [] });
    vi.mocked(useAuth).mockReturnValue({ user, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('calls bulkMoveToStage once with all selected ids (not a loop)', async () => {
    bulkAsync.mockResolvedValue({ summary: { total: 3, ok: 3, failed: 0 }, results: [
      { taskId: 't1', ok: true }, { taskId: 't2', ok: true }, { taskId: 't3', ok: true },
    ] });
    setup();
    bulkMoveToIClass();

    await waitFor(() => expect(bulkAsync).toHaveBeenCalledTimes(1));
    expect(bulkAsync).toHaveBeenCalledWith({ ids: ['t1', 't2', 't3'], stageId: 's-iclass' });
  });

  it('all OK → toast, no result modal', async () => {
    bulkAsync.mockResolvedValue({ summary: { total: 3, ok: 3, failed: 0 }, results: [
      { taskId: 't1', ok: true }, { taskId: 't2', ok: true }, { taskId: 't3', ok: true },
    ] });
    setup();
    bulkMoveToIClass();

    await waitFor(() => expect(screen.getByText(/3.*enviada/)).toBeInTheDocument());
    expect(screen.queryByText('Resultado del envío a IClass')).not.toBeInTheDocument();
  });

  it('partial failure → opens the result modal with the failed list and reasons', async () => {
    bulkAsync.mockResolvedValue({ summary: { total: 3, ok: 1, failed: 2 }, results: [
      { taskId: 't1', ok: true },
      { taskId: 't2', ok: false, errorCode: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone'] },
      { taskId: 't3', ok: false, errorCode: 'ICLASS_REJECTED', reason: 'ICLERR_X' },
    ] });
    setup();
    bulkMoveToIClass();

    await waitFor(() => expect(screen.getByText('Resultado del envío a IClass')).toBeInTheDocument());
    expect(screen.getByText(/1 de 3/)).toBeInTheDocument();
    expect(screen.getByText(/Teléfono/)).toBeInTheDocument();
    expect(screen.getByText(/ICLERR_X/)).toBeInTheDocument();
  });

  it('retry reprocesses only the failed ids and closes when they all succeed', async () => {
    bulkAsync
      .mockResolvedValueOnce({ summary: { total: 3, ok: 1, failed: 2 }, results: [
        { taskId: 't1', ok: true },
        { taskId: 't2', ok: false, errorCode: 'ICLASS_UNAVAILABLE' },
        { taskId: 't3', ok: false, errorCode: 'ICLASS_UNAVAILABLE' },
      ] })
      .mockResolvedValueOnce({ summary: { total: 2, ok: 2, failed: 0 }, results: [
        { taskId: 't2', ok: true }, { taskId: 't3', ok: true },
      ] });
    setup();
    bulkMoveToIClass();

    await screen.findByRole('button', { name: 'Reintentar las fallidas' });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar las fallidas' }));

    await waitFor(() => expect(bulkAsync).toHaveBeenCalledTimes(2));
    expect(bulkAsync).toHaveBeenLastCalledWith({ ids: ['t2', 't3'], stageId: 's-iclass' });
    // no more failures → modal closes
    await waitFor(() => expect(screen.queryByText('Resultado del envío a IClass')).not.toBeInTheDocument());
  });
});

// ── New bulk actions (#86) ─────────────────────────────────────────────────────

describe('TasksTableView — bulk Asignar (#86)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = ['scheduling.write', 'scheduling.move_stage', 'scheduling.hard_delete'];
    confirmFn.mockResolvedValue(true);
    updateAsync.mockResolvedValue({});
    vi.mocked(useAuth).mockReturnValue({ user, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('opens Asignar picker, assigns all, clears selection', async () => {
    setupWithAdmins();
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // select all

    fireEvent.click(screen.getByTestId('bulk-assign-btn'));
    const dialog = screen.getByRole('dialog', { name: /Asignar/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'u1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(3));
    expect(updateAsync).toHaveBeenCalledWith({ id: 't1', data: { assigneeId: 'u1' } });
    await waitFor(() => expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument());
  });

  it('partial failure: selection narrowed to failed ids', async () => {
    updateAsync.mockImplementation(({ id }: { id: string }) =>
      id === 't2' ? Promise.reject(new Error('boom')) : Promise.resolve({}));
    setupWithAdmins();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    fireEvent.click(screen.getByTestId('bulk-assign-btn'));
    const dialog = screen.getByRole('dialog', { name: /Asignar/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'u1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/1 de 3 no se pudieron asignar/));
    const bar = screen.getByTestId('bulk-action-bar');
    expect(within(bar).getByText(/1 tarea/)).toBeInTheDocument();
  });
});

describe('TasksTableView — bulk Cambiar estado (#86)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = ['scheduling.write', 'scheduling.move_stage'];
    confirmFn.mockResolvedValue(true);
    setStatusAsync.mockResolvedValue({});
    vi.mocked(useAuth).mockReturnValue({ user, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('opens picker, applies closed status to all, clears selection', async () => {
    setupWithAdmins();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    fireEvent.click(screen.getByTestId('bulk-change-status-btn'));
    const dialog = screen.getByRole('dialog', { name: /estado/ });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'closed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(setStatusAsync).toHaveBeenCalledTimes(3));
    expect(setStatusAsync).toHaveBeenCalledWith({ id: 't1', status: 'closed' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/3 tareas actualizadas/));
  });
});

describe('TasksTableView — bulk Archivar (#86)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = ['scheduling.write', 'scheduling.move_stage'];
    confirmFn.mockResolvedValue(true);
    archiveAsync.mockResolvedValue({});
    vi.mocked(useAuth).mockReturnValue({ user, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('Archivar button disabled when selection contains open tasks', () => {
    setupWithAdmins(tasks); // all open
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByTestId('bulk-archive-btn')).toBeDisabled();
  });

  it('Archivar button enabled when all selected tasks are closed', () => {
    setupWithAdmins(closedTasks);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByTestId('bulk-archive-btn')).not.toBeDisabled();
  });

  it('archives all closed tasks on confirm', async () => {
    setupWithAdmins(closedTasks);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    fireEvent.click(screen.getByTestId('bulk-archive-btn'));

    await waitFor(() => expect(archiveAsync).toHaveBeenCalledTimes(3));
    expect(archiveAsync).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/3 tareas archivadas/));
  });
});

describe('TasksTableView — bulk Eliminar removed (#7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('bulk-delete-btn is NEVER present, even with scheduling.hard_delete (#7)', () => {
    permissions = ['scheduling.write', 'scheduling.hard_delete'];
    setupWithAdmins();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.queryByTestId('bulk-delete-btn')).not.toBeInTheDocument();
  });
});
