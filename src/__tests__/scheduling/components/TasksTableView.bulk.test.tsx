import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const bulkAsync = vi.fn();
vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage:        () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkMoveTasksToStage:   () => ({ mutateAsync: bulkAsync, isPending: false }),
  useDeleteTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCloseTask:              () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskInventoryReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import { useAuth } from '@/hooks/useAuth';
import type { ScheduledTask } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import type { AuthUser } from '@/types/auth';

const stages: WorkflowStage[] = [
  { id: 's1', workflowId: 'wf1', name: 'Nuevo', category: 'nuevo', order: 0 },
  { id: 's-iclass', workflowId: 'wf1', name: 'Enviar a IClass', category: 'enProgreso', order: 1 },
];

function mkTask(id: string, seq: number): ScheduledTask {
  return {
    id, sequenceNumber: seq, title: `Tarea ${seq}`, stageId: 's1', stageCategory: 'nuevo',
    projectId: 'p1', priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    description: null, watcherIds: [], checklist: [], reviewedByInventory: false, iclassOrderCode: null,
  } as unknown as ScheduledTask;
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

describe('TasksTableView — bulk move to IClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
