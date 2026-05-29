import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const moveAsync = vi.fn();
const deleteAsync = vi.fn();
const closeAsync = vi.fn();
vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage:        () => ({ mutateAsync: moveAsync,   isPending: false }),
  useBulkMoveTasksToStage:   () => ({ mutateAsync: vi.fn(),     isPending: false }),
  useDeleteTask:             () => ({ mutateAsync: deleteAsync, isPending: false }),
  useCloseTask:              () => ({ mutateAsync: closeAsync,  isPending: false }),
  useSetTaskInventoryReview: () => ({ mutateAsync: vi.fn(),     isPending: false }),
  useUpdateTask:             () => ({ mutateAsync: vi.fn(),     isPending: false }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useMyPermissions';
import type { ScheduledTask } from '@/types/scheduling';
import type { Workflow } from '@/types/workflow';
import type { Project } from '@/types/project';
import type { AuthUser } from '@/types/auth';

const workflows: Workflow[] = [{
  id: 'wf1', name: 'Default', description: null, createdAt: '', updatedAt: '',
  stages: [
    { id: 's2', workflowId: 'wf1', name: 'Confirmado', category: 'nuevo', order: 1 },
    { id: 's1', workflowId: 'wf1', name: 'Nuevo', category: 'nuevo', order: 0 },
  ],
}];
const projects: Project[] = [{ id: 'p1', title: 'Fibra', description: null, workflowId: 'wf1', createdAt: '', updatedAt: '' }];

const task = {
  id: 't1', sequenceNumber: 1, title: 'Tarea', stageId: 's1', stageCategory: 'nuevo',
  projectId: 'p1', priority: 'normal', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  description: null, watcherIds: [], checklist: [],
  customerId: 'cust-9', customerName: 'ACOSTA JUAN PABLO',
  isClosed: false,
} as unknown as ScheduledTask;

const closedTask: ScheduledTask = { ...task, isClosed: true };

const adminUser: AuthUser = { id: 1, username: 'admin', email: 'a@b.com', displayName: 'Admin', role: 'admin', permissions: [] };
const regularUser: AuthUser = { id: 2, username: 'user', email: 'u@b.com', displayName: 'User', role: 'technician', permissions: [] };

function setup(tasks = [task], columns: string[] = ['sequenceNumber', 'stageCategory']) {
  return render(
    <MemoryRouter>
      <TasksTableView tasks={tasks} projects={projects} workflows={workflows} visibleColumnKeys={columns} />
    </MemoryRouter>,
  );
}

describe('TasksTableView — inline estado selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moveAsync.mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ user: regularUser, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('shows the real stage name on the trigger and lists colour-coded options when opened', () => {
    setup();
    const trigger = screen.getByLabelText('Cambiar estado');
    expect(trigger).toHaveTextContent('Nuevo'); // current stage name, not the category
    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: /Nuevo/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Confirmado/ })).toBeInTheDocument();
  });

  it('moves the task to the chosen stage when an option is picked', async () => {
    setup();
    fireEvent.click(screen.getByLabelText('Cambiar estado'));
    fireEvent.click(screen.getByRole('option', { name: /Confirmado/ }));
    await waitFor(() => expect(moveAsync).toHaveBeenCalledWith({ id: 't1', stageId: 's2' }));
  });

  it('renders the customer name as a link to the customer detail page', () => {
    setup([task], ['sequenceNumber', 'customerName']);
    const link = screen.getByRole('link', { name: 'ACOSTA JUAN PABLO' });
    expect(link).toHaveAttribute('href', '/admin/customers/view/cust-9');
  });
});

describe('TasksTableView — closed task indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: regularUser, isLoading: false, login: vi.fn(), logout: vi.fn() });
  });

  it('shows the "Cerrada" badge when isClosed is true', () => {
    setup([closedTask], ['title']);
    expect(screen.getByTestId('closed-badge')).toBeInTheDocument();
    expect(screen.getByTestId('closed-badge')).toHaveTextContent('Cerrada');
  });

  it('does NOT show the "Cerrada" badge when isClosed is false', () => {
    setup([task], ['title']);
    expect(screen.queryByTestId('closed-badge')).not.toBeInTheDocument();
  });
});

describe('TasksTableView — bulk actions', () => {
  // Helper: select the first row checkbox to reveal bulk bar
  function selectFirstRow() {
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // [0] is "select all"
  }

  beforeEach(() => {
    vi.clearAllMocks();
    closeAsync.mockResolvedValue(undefined);
    deleteAsync.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Restore default permissive behaviour after vi.clearAllMocks()
    vi.mocked(useCan).mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Cerrar" button in bulk bar for user without scheduling.bulk_delete permission', () => {
    vi.mocked(useAuth).mockReturnValue({ user: regularUser, isLoading: false, login: vi.fn(), logout: vi.fn() });
    // Override useCan to deny bulk_delete for this test
    vi.mocked(useCan).mockImplementation((perm: string) => perm !== 'scheduling.bulk_delete');
    setup();
    selectFirstRow();
    expect(screen.getByTestId('bulk-close-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-delete-btn')).not.toBeInTheDocument();
  });

  it('shows both "Cerrar" and "Eliminar" for user with scheduling.bulk_delete permission', () => {
    vi.mocked(useAuth).mockReturnValue({ user: adminUser, isLoading: false, login: vi.fn(), logout: vi.fn() });
    // Default global mock grants all permissions (useCan → true)
    setup();
    selectFirstRow();
    expect(screen.getByTestId('bulk-close-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-delete-btn')).toBeInTheDocument();
  });

  it('calls closeTask with isClosed:true when "Cerrar" is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: regularUser, isLoading: false, login: vi.fn(), logout: vi.fn() });
    setup();
    selectFirstRow();
    fireEvent.click(screen.getByTestId('bulk-close-btn'));
    await waitFor(() => expect(closeAsync).toHaveBeenCalledWith({ id: 't1', isClosed: true }));
  });

  it('calls deleteTask when user with scheduling.bulk_delete permission clicks "Eliminar"', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: adminUser, isLoading: false, login: vi.fn(), logout: vi.fn() });
    // Default global mock grants all permissions
    setup();
    selectFirstRow();
    fireEvent.click(screen.getByTestId('bulk-delete-btn'));
    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith('t1'));
  });
});
