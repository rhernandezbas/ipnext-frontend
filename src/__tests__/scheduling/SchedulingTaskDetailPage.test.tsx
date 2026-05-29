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
  useSetTaskInventoryReview: vi.fn(() => noopMutationFactory()),
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

vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: vi.fn(),
}));

vi.mock('@/hooks/usePartners', () => ({
  usePartners: vi.fn(),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
}));

vi.mock('@/hooks/useTaskTemplates', () => ({
  useTaskTemplates: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteTaskTemplate: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useReplaceTemplateItems: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

// Mock useCustomers so CustomerSidebar doesn't fetch
vi.mock('@/hooks/useCustomers', () => ({
  useClientDetail: vi.fn(() => ({ data: undefined, isLoading: false })),
  useClientServices: vi.fn(() => ({ data: [] })),
}));

// Mock TaskTabs — renders a stub with 7 role=tab elements (main tabs)
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs', () => ({
  TaskTabs: ({ detailsProps, commentsTaskId, reviewedByInventory, onInventoryToggle }: {
    detailsProps: Record<string, unknown>;
    commentsTaskId: string;
    reviewedByInventory: boolean;
    onInventoryToggle: (v: boolean) => void;
  }) => (
    <div data-testid="task-tabs" data-comments-id={commentsTaskId} data-inventory={String(reviewedByInventory)}>
      {/* Stub 7 tabs so tests can assert tab presence */}
      {['Detalles', 'Adjuntos', 'Comentarios', 'Relacionado', 'Inventory', 'Registro de trabajo', 'Actividad'].map(label => (
        <button key={label} role="tab" aria-selected={label === 'Detalles' ? 'true' : 'false'}>{label}</button>
      ))}
      {/* Expose description change for integration tests — the editor is now
          controlled (controlled API: onChange(html, isDirty)), so editing it
          only updates parent state. The actual save happens via datos-save-btn. */}
      <button
        data-testid="desc-change-btn"
        onClick={() => {
          const onChange = (detailsProps.descriptionEditor as { onChange?: (h: string, dirty: boolean) => void })?.onChange;
          onChange?.('<p>updated</p>', true);
        }}
      >
        Change Desc
      </button>
      {/* Expose datos form save for integration test */}
      <button
        data-testid="datos-save-btn"
        onClick={() => {
          const onSubmit = (detailsProps.datosForm as { onSubmit?: (v: Record<string, unknown>) => Promise<void> })?.onSubmit;
          const initial = (detailsProps.datosForm as { initial?: Record<string, unknown> })?.initial ?? {};
          void onSubmit?.(initial);
        }}
      >
        Save Datos
      </button>
      <button
        data-testid="inventory-toggle-btn"
        onClick={() => onInventoryToggle(!reviewedByInventory)}
      >
        Toggle Inventory
      </button>
    </div>
  ),
}));

// Mock CustomerSidebar — renders a stub with 3 role=tab elements (sidebar tabs)
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar', () => ({
  CustomerSidebar: ({ customerId, customerName, watcherIds, admins }: {
    customerId: string | null;
    customerName: string | null;
    serviceId: string | null;
    reporterId: string | null;
    watcherIds: string[];
    admins: { id: string; name: string }[];
    onWatchersChange: (ids: string[]) => void;
    isSavingWatchers: boolean;
  }) => (
    <div data-testid="customer-sidebar" data-customer-id={customerId ?? ''}>
      {['Detalles', 'Inventario', 'Documentos'].map(label => (
        <button key={label} role="tab" aria-selected={label === 'Detalles' ? 'true' : 'false'}>{label}</button>
      ))}
      {/* CustomerCard heading so legacy test passes */}
      <h2>Cliente</h2>
      <span>{customerName}</span>
      <a href={`/admin/customers/${customerId}`}>Ver perfil</a>
      {/* WatchersChips heading */}
      <h2>Watchers</h2>
      {watcherIds.map(wId => {
        const admin = admins.find(a => a.id === wId);
        return admin ? (
          <button key={wId} aria-label={`Quitar ${admin.name}`}>{admin.name}</button>
        ) : null;
      })}
    </div>
  ),
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

import { useTask, useUpdateTask, useMoveTaskToStage, useDeleteTask, useCloseTask, useSetTaskInventoryReview } from '@/hooks/useScheduling';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { usePartners } from '@/hooks/usePartners';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useMyPermissions';

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
  reviewedByInventory: false,
  iclassOrderCode: null,
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
  vi.mocked(useSetTaskInventoryReview).mockReturnValue(noopMutation as ReturnType<typeof useSetTaskInventoryReview>);
  vi.mocked(useAuth).mockReturnValue({ user: { id: 1, username: 'admin', email: 'a@b.com', displayName: 'Admin', role: 'admin', permissions: [] } });

  vi.mocked(useWorkflows).mockReturnValue({
    data: mockWorkflows,
    isLoading: false,
  } as ReturnType<typeof useWorkflows>);

  vi.mocked(useRbacUsers).mockReturnValue({
    data: mockAdmins,
    isLoading: false,
  } as ReturnType<typeof useRbacUsers>);

  vi.mocked(usePartners).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof usePartners>);

  vi.mocked(useProjects).mockReturnValue({
    data: [{ id: 'proj-1', title: 'Proyecto A', description: null, workflowId: null, createdAt: '', updatedAt: '' }],
    isLoading: false,
  } as ReturnType<typeof useProjects>);
}

// Import page after mocks are set up
const { default: SchedulingTaskDetailPage } = await import('@/pages/scheduling/SchedulingTaskDetailPage');

describe('SchedulingTaskDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore permissive default for useCan after vi.clearAllMocks() wipes it
    vi.mocked(useCan).mockImplementation(() => true);
  });

  it('renders TaskHeader and layout structure', async () => {
    setupMocks();
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Instalación Cliente Pérez')).toBeInTheDocument();
    });
    // main and aside are in DOM
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(document.querySelector('aside')).toBeInTheDocument();
    // TaskTabs stub is in main
    expect(screen.getByTestId('task-tabs')).toBeInTheDocument();
    // CustomerSidebar stub is in aside
    expect(screen.getByTestId('customer-sidebar')).toBeInTheDocument();
  });

  it('renders 7 main tabs (inside TaskTabs)', async () => {
    setupMocks();
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Instalación Cliente Pérez')).toBeInTheDocument();
    });

    const allTabs = screen.getAllByRole('tab');
    // 7 from TaskTabs + 3 from CustomerSidebar = 10 total
    expect(allTabs.length).toBe(10);

    const mainTabLabels = ['Detalles', 'Adjuntos', 'Comentarios', 'Relacionado', 'Inventory', 'Registro de trabajo', 'Actividad'];
    for (const label of mainTabLabels) {
      // getAllByText because "Detalles" appears in both stubs
      const matches = screen.getAllByText(label);
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it('renders 3 sidebar tabs (inside CustomerSidebar)', async () => {
    setupMocks();
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('customer-sidebar')).toBeInTheDocument();
    });

    const sidebarTabLabels = ['Inventario', 'Documentos'];
    for (const label of sidebarTabLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
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

  it('shows "Eliminar tarea" in kebab menu for user with scheduling.delete permission', async () => {
    setupMocks();
    // Default global mock grants all (useCan → true), so delete is visible
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-delete')).toBeInTheDocument();
  });

  it('hides "Eliminar tarea" in kebab menu for user without scheduling.delete permission', async () => {
    setupMocks();
    // Deny scheduling.delete for this test
    vi.mocked(useCan).mockImplementation((perm: string) => perm !== 'scheduling.delete');
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.queryByTestId('kebab-delete')).not.toBeInTheDocument();
  });

  it('editing the description alone does NOT trigger updateTask (save is via datos submit)', async () => {
    // The unified save model: editing the description only updates parent state.
    // No network call happens until the user clicks the single bottom "Guardar".
    setupMocks();
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateTask).mockReturnValue({ ...noopMutation, mutateAsync } as ReturnType<typeof useUpdateTask>);
    const { fireEvent: fe } = await import('@testing-library/react');

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('desc-change-btn')).toBeInTheDocument());
    fe.click(screen.getByTestId('desc-change-btn'));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('unified save: after editing description, a single datos submit sends BOTH description and datos in ONE updateTask call', async () => {
    setupMocks();
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateTask).mockReturnValue({ ...noopMutation, mutateAsync } as ReturnType<typeof useUpdateTask>);
    const { fireEvent: fe } = await import('@testing-library/react');

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('desc-change-btn')).toBeInTheDocument());

    // 1) User edits the description — parent stores it as dirty.
    fe.click(screen.getByTestId('desc-change-btn'));
    // 2) User clicks the single bottom Guardar (the datos submit).
    fe.click(screen.getByTestId('datos-save-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        id: 'task-1',
        data: expect.objectContaining({ description: '<p>updated</p>' }),
      }));
    });
  });

  it('datos submit without a description edit sends datos only — no description field in the payload', async () => {
    // When the description was not touched, the unified save MUST NOT push the
    // current task description back to the server (that would be a noisy write
    // for a field the user never edited).
    setupMocks();
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateTask).mockReturnValue({ ...noopMutation, mutateAsync } as ReturnType<typeof useUpdateTask>);
    const { fireEvent: fe } = await import('@testing-library/react');

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('datos-save-btn')).toBeInTheDocument());
    fe.click(screen.getByTestId('datos-save-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
      const call = mutateAsync.mock.calls[0][0] as { id: string; data: Record<string, unknown> };
      expect(call.id).toBe('task-1');
      expect(call.data).not.toHaveProperty('description');
    });
  });

  it('delete modal appears and dispatches delete on confirm', async () => {
    setupMocks();
    const deleteAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useDeleteTask).mockReturnValue({ ...noopMutation, mutateAsync: deleteAsync } as ReturnType<typeof useDeleteTask>);
    const { fireEvent: fe } = await import('@testing-library/react');

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('kebab-menu')).toBeInTheDocument());
    fe.click(screen.getByTestId('kebab-menu'));
    fe.click(screen.getByTestId('kebab-delete'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fe.click(screen.getByText('Eliminar'));
    await waitFor(() => {
      expect(deleteAsync).toHaveBeenCalledWith('task-1');
    });
  });

  it('inventory toggle calls useSetTaskInventoryReview', async () => {
    setupMocks();
    const inventoryMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useSetTaskInventoryReview).mockReturnValue({ ...noopMutation, mutateAsync: inventoryMutateAsync } as ReturnType<typeof useSetTaskInventoryReview>);
    const { fireEvent: fe } = await import('@testing-library/react');

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('inventory-toggle-btn')).toBeInTheDocument());
    fe.click(screen.getByTestId('inventory-toggle-btn'));
    await waitFor(() => {
      expect(inventoryMutateAsync).toHaveBeenCalledWith({ id: 'task-1', reviewed: true });
    });
  });

  // TaskTabs is mocked in this file, so DatosForm never renders here.
  // The project select is thoroughly covered in DatosForm.test.tsx.
  it.todo('renders project select in task detail (covered by DatosForm.test.tsx component tests)');
});
