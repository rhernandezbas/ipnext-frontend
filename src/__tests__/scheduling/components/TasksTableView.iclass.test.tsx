import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const moveAsync = vi.fn();
vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage:        () => ({ mutateAsync: moveAsync, isPending: false }),
  useBulkMoveTasksToStage:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCloseTask:              () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskInventoryReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskGeneralStatus:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveTask:            () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import { useAuth } from '@/hooks/useAuth';
import type { ScheduledTask } from '@/types/scheduling';
import type { Workflow } from '@/types/workflow';
import type { Project } from '@/types/project';
import type { AuthUser } from '@/types/auth';

const workflows: Workflow[] = [{
  id: 'wf1', name: 'Default', description: null, createdAt: '', updatedAt: '',
  stages: [
    { id: 's1', workflowId: 'wf1', name: 'Nuevo', category: 'nuevo', code: 'nuevo', order: 0 },
    { id: 's-iclass', workflowId: 'wf1', name: 'Enviar a IClass', category: 'enProgreso', code: 'en-progreso', order: 1 },
  ],
}];
const projects: Project[] = [{ id: 'p1', title: 'Fibra', description: null, workflowId: 'wf1', createdAt: '', updatedAt: '' }];

const task = {
  id: 't1', sequenceNumber: 1, title: 'Tarea', stageId: 's1', stageCategory: 'nuevo',
  projectId: 'p1', priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  description: null, watcherIds: [], checklist: [], reviewedByInventory: false, iclassOrderCode: null,
} as unknown as ScheduledTask;

const regularUser: AuthUser = { id: 2, username: 'user', email: 'u@b.com', displayName: 'User', role: 'technician', permissions: [] };

function setup() {
  return render(
    <MemoryRouter>
      <TasksTableView tasks={[task]} projects={projects} workflows={workflows} visibleColumnKeys={['sequenceNumber', 'stageCategory']} />
    </MemoryRouter>,
  );
}

function moveToIClass() {
  fireEvent.click(screen.getByLabelText('Cambiar estado'));
  fireEvent.click(screen.getByRole('option', { name: /Enviar a IClass/ }));
}

describe('TasksTableView — IClass send feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: regularUser, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('opens the modal with the missing fields on 422 MISSING_REQUIRED_FIELDS', async () => {
    moveAsync.mockRejectedValue({
      response: { data: { code: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone', 'address'] } },
    });
    setup();
    moveToIClass();

    await waitFor(() => expect(screen.getByText('Faltan datos para enviar a IClass')).toBeInTheDocument());
    expect(screen.getByText('Teléfono')).toBeInTheDocument();
    expect(screen.getByText('Dirección')).toBeInTheDocument();
  });

  it('shows a success toast with the iclassOrderCode on success', async () => {
    moveAsync.mockResolvedValue({ ...task, stageId: 's-iclass', iclassOrderCode: 'OS-555' });
    setup();
    moveToIClass();

    await waitFor(() => expect(screen.getByText(/OS-555/)).toBeInTheDocument());
  });

  it('does NOT open the modal for a non-IClass error', async () => {
    moveAsync.mockRejectedValue({ response: { data: { code: 'VALIDATION_ERROR' } } });
    setup();
    moveToIClass();

    await waitFor(() => expect(moveAsync).toHaveBeenCalled());
    expect(screen.queryByText('Faltan datos para enviar a IClass')).not.toBeInTheDocument();
  });

  it('navigates to the task detail when "Editar tarea" is clicked', async () => {
    moveAsync.mockRejectedValue({
      response: { data: { code: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone'] } },
    });
    setup();
    moveToIClass();

    await screen.findByRole('button', { name: 'Editar tarea' });
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarea' }));
    expect(navigateMock).toHaveBeenCalledWith('/admin/scheduling/tasks/t1', { state: { from: '/' } });
  });
});
