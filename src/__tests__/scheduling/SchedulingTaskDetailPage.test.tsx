import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ScheduledTask } from '@/types/scheduling';
import type { Admin } from '@/types/admin';

// Mock all API and hook dependencies
const noopMutationFactory = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false, isError: false, error: null, reset: vi.fn() });
vi.mock('@/hooks/useScheduling', () => ({
  useTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useMoveTaskToStage: vi.fn(),
  useDeleteTask: vi.fn(),
  useCloseTask: vi.fn(() => noopMutationFactory()),
  useAddChecklistItem: vi.fn(() => noopMutationFactory()),
  useToggleChecklistItem: vi.fn(() => noopMutationFactory()),
  useUpdateChecklistItem: vi.fn(() => noopMutationFactory()),
  useRemoveChecklistItem: vi.fn(() => noopMutationFactory()),
  useReorderChecklist: vi.fn(() => noopMutationFactory()),
  useAssignTemplateToTask: vi.fn(() => noopMutationFactory()),
  useClearChecklist: vi.fn(() => noopMutationFactory()),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 1, username: 'admin', email: 'a@b.com', displayName: 'Admin', role: 'admin', permissions: [] } })),
}));

vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(),
}));

vi.mock('@/hooks/useAdmins', () => ({
  useAdmins: vi.fn(),
}));

vi.mock('@/hooks/usePartners', () => ({
  usePartners: vi.fn(),
}));

vi.mock('@/hooks/useTaskTemplates', () => ({
  useTaskTemplates: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useReplaceTemplateItems: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

// Mock dnd-kit to avoid jsdom issues
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: undefined })),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn((arr: unknown[]) => arr),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    getHTML: () => '<p>content</p>',
    commands: { setContent: vi.fn() },
    destroy: vi.fn(),
    isFocused: false,
  })),
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock('@tiptap/starter-kit', () => ({ default: {} }));

import { useTask, useUpdateTask, useMoveTaskToStage, useDeleteTask, useCloseTask } from '@/hooks/useScheduling';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAdmins } from '@/hooks/useAdmins';
import { usePartners } from '@/hooks/usePartners';
import { useAuth } from '@/hooks/useAuth';

const mockTask: ScheduledTask = {
  id: 'task-1',
  sequenceNumber: 1001,
  title: 'Instalación Cliente Pérez',
  description: '<p>Descripción de prueba</p>',
  priority: 'high',
  estimatedHours: 2,
  address: 'Av. Corrientes 1234',
  coordinates: { lat: -34.6, lng: -58.38 },
  category: 'installation',
  projectId: 'proj-1',
  projectName: 'Proyecto A',
  completedAt: null,
  notes: null,
  stageId: 'stage-1',
  stageCategory: 'nuevo',
  startDate: '2026-06-01T14:00:00.000Z',
  endDate: '2026-06-01T16:00:00.000Z',
  customerId: 'cust-1',
  customerName: 'Pérez, Juan',
  customerCity: null,
  serviceId: null,
  partnerId: null,
  reporterId: null,
  assigneeId: 'admin-1',
  assigneeName: 'Ana García',
  watcherIds: ['admin-2'],
  travelTimeTo: 30,
  travelTimeFrom: 30,
  checklist: [],
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

const mockAdmins: Admin[] = [
  { id: 'admin-1', name: 'Ana García', email: 'ana@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
  { id: 'admin-2', name: 'Pedro López', email: 'pedro@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
];

const mockWorkflows = [
  {
    id: 'wf-1',
    name: 'Default',
    description: null,
    stages: [
      { id: 'stage-1', workflowId: 'wf-1', name: 'Nuevo', category: 'nuevo', order: 1 },
      { id: 'stage-2', workflowId: 'wf-1', name: 'En progreso', category: 'enProgreso', order: 2 },
      { id: 'stage-3', workflowId: 'wf-1', name: 'Hecho', category: 'hecho', order: 3 },
    ],
    createdAt: '',
    updatedAt: '',
  },
];

const noopMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
};

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/scheduling/tasks/task-1']}>
        <Routes>
          <Route path="/admin/scheduling/tasks/:id" element={children} />
          <Route path="/admin/scheduling/projects" element={<div>Projects</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function setupMocks(overrides?: { taskData?: Partial<ScheduledTask> | null; isLoading?: boolean }) {
  const task = overrides?.taskData === null ? null : { ...mockTask, ...overrides?.taskData };
  vi.mocked(useTask).mockReturnValue({
    data: task ?? undefined,
    isLoading: overrides?.isLoading ?? false,
    isError: false,
    error: null,
  } as ReturnType<typeof useTask>);

  vi.mocked(useUpdateTask).mockReturnValue(noopMutation as ReturnType<typeof useUpdateTask>);
  vi.mocked(useMoveTaskToStage).mockReturnValue(noopMutation as ReturnType<typeof useMoveTaskToStage>);
  vi.mocked(useDeleteTask).mockReturnValue(noopMutation as ReturnType<typeof useDeleteTask>);
  vi.mocked(useCloseTask).mockReturnValue(noopMutation as ReturnType<typeof useCloseTask>);
  vi.mocked(useAuth).mockReturnValue({ user: { id: 1, username: 'admin', email: 'a@b.com', displayName: 'Admin', role: 'admin', permissions: [] } });

  vi.mocked(useWorkflows).mockReturnValue({
    data: mockWorkflows,
    isLoading: false,
  } as ReturnType<typeof useWorkflows>);

  vi.mocked(useAdmins).mockReturnValue({
    data: mockAdmins,
    isLoading: false,
  } as ReturnType<typeof useAdmins>);

  vi.mocked(usePartners).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof usePartners>);
}

// Import page after mocks are set up
const { default: SchedulingTaskDetailPage } = await import('@/pages/scheduling/SchedulingTaskDetailPage');

describe('SchedulingTaskDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all sections given a mock task', async () => {
    setupMocks();
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Instalación Cliente Pérez')).toBeInTheDocument();
    });
    expect(screen.getByText('▣ Datos')).toBeInTheDocument();
    expect(screen.getByText('▣ Ubicación')).toBeInTheDocument();
    expect(screen.getByText('▣ Descripción')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cliente' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Watchers/ })).toBeInTheDocument();
  });

  it('renders 404 state when task not found', async () => {
    setupMocks({ taskData: null });
    vi.mocked(useTask).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('TASK_NOT_FOUND'),
    } as ReturnType<typeof useTask>);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/tarea no encontrada/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /volver/i })).toBeInTheDocument();
  });

  it('renders loading spinner while fetching', () => {
    setupMocks({ isLoading: true });
    vi.mocked(useTask).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows customer card with link when customerId present', async () => {
    setupMocks();
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Pérez, Juan')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /ver perfil/i })).toBeInTheDocument();
  });

  it('shows watcher chips', async () => {
    setupMocks();
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      // Pedro López is admin-2, who is in watcherIds
      expect(screen.getByRole('button', { name: /quitar Pedro López/i })).toBeInTheDocument();
    });
  });

  it('shows "Cerrar tarea" option in kebab menu for an open task', async () => {
    setupMocks();
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-close')).toHaveTextContent('Cerrar tarea');
  });

  it('shows "Reabrir tarea" option in kebab menu for a closed task', async () => {
    setupMocks({ taskData: { isClosed: true } });
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-close')).toHaveTextContent('Reabrir tarea');
  });

  it('shows "Cerrada" badge in header when task is closed', async () => {
    setupMocks({ taskData: { isClosed: true } });
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('task-closed-badge')).toBeInTheDocument();
    });
  });

  it('calls useCloseTask with isClosed:true when "Cerrar tarea" is clicked', async () => {
    setupMocks();
    const closeTaskMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCloseTask).mockReturnValue({ ...noopMutation, mutateAsync: closeTaskMutateAsync } as ReturnType<typeof useCloseTask>);
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    fe.click(screen.getByTestId('kebab-close'));
    await waitFor(() => {
      expect(closeTaskMutateAsync).toHaveBeenCalledWith({ id: 'task-1', isClosed: true });
    });
  });

  it('shows "Eliminar tarea" in kebab menu for admin role', async () => {
    setupMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 1, username: 'admin', email: 'a@b.com', displayName: 'Admin', role: 'admin', permissions: [] } });
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-delete')).toBeInTheDocument();
  });

  it('hides "Eliminar tarea" in kebab menu for non-admin role', async () => {
    setupMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 2, username: 'tech', email: 'tech@b.com', displayName: 'Tech', role: 'technician', permissions: [] } });
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.queryByTestId('kebab-delete')).not.toBeInTheDocument();
  });
});
