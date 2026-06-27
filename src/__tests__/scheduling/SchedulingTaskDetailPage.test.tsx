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
  useSetTaskGeneralStatus: vi.fn(() => noopMutationFactory()),
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
  useClientContracts: vi.fn(() => ({ data: [] })),
}));

// #122 — the page now reads the iclass-assign flag + the técnico→cuadrilla
// mapping to drive the assignee block. Mock both so the page renders offline.
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(() => ({ data: { key: 'iclass-assign-action', enabled: false }, isLoading: false })),
}));

vi.mock('@/hooks/useIClassTechnicianTeams', () => ({
  useIClassTechnicianTeams: vi.fn(() => ({ data: [], isLoading: false })),
}));

// Mock TaskHeader — renders a minimal stub that exposes a stage-move trigger.
// Wrapped in vi.fn so tests can capture onStageMove and fire it directly
// without needing to drive the StageSelect UI.
// NOTE: the real implementation is in `defaultTaskHeaderImpl` (defined below),
// restored in beforeEach so per-test overrides don't leak.
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader', () => ({
  TaskHeader: vi.fn(),
}));

// Mock TaskTabs — renders a stub with 7 role=tab elements (main tabs)
// Wrapped in vi.fn so individual tests can override the implementation to
// capture the props the page hands down (e.g. #122 datosForm wiring).
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs', () => ({
  TaskTabs: vi.fn(({ detailsProps, commentsTaskId, reviewedByInventory, onInventoryToggle }: {
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
  )),
}));

// Mock CustomerSidebar — renders a stub with 3 role=tab elements (sidebar tabs)
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar', () => ({
  CustomerSidebar: ({ customerId, customerName, watcherIds, admins }: {
    customerId: string | null;
    customerName: string | null;
    contractId: string | null;
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

import { useTask, useUpdateTask, useMoveTaskToStage, useDeleteTask, useCloseTask, useSetTaskGeneralStatus, useSetTaskInventoryReview } from '@/hooks/useScheduling';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { usePartners } from '@/hooks/usePartners';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { useCan } from '@/hooks/useMyPermissions';
import { TaskHeader } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader';

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
  contractId: null,
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
  kind: 'customer',
  networkSiteId: null,
  networkSiteName: null,
  generalStatus: 'open',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

// Shape matches RbacUserWithRolesDto (roles array drives the technicians filter)
const mockAdmins: any[] = [
  { id: 'admin-1', name: 'Ana García', email: 'ana@test.com', login: 'ana', status: 'active', createdAt: '', updatedAt: '', lastLoginAt: null, roles: [{ id: 'r-t', code: 'tecnico', label: 'Técnico' }] },
  { id: 'admin-2', name: 'Pedro López', email: 'pedro@test.com', login: 'pedro', status: 'active', createdAt: '', updatedAt: '', lastLoginAt: null, roles: [{ id: 'r-t', code: 'tecnico', label: 'Técnico' }] },
];

const mockWorkflows = [
  {
    id: 'wf-1',
    name: 'Default',
    description: null,
    stages: [
      { id: 'stage-1', workflowId: 'wf-1', name: 'Nuevo', code: 'nuevo', category: 'nuevo', order: 1 },
      { id: 'stage-2', workflowId: 'wf-1', name: 'En progreso', code: 'en_progreso', category: 'enProgreso', order: 2 },
      { id: 'stage-3', workflowId: 'wf-1', name: 'Hecho', code: 'hecho', category: 'hecho', order: 3 },
      { id: 'stage-iclass', workflowId: 'wf-1', name: 'Registrar en IClass', code: 'send_to_iclass', category: 'enProgreso', order: 4 },
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
  vi.mocked(useSetTaskGeneralStatus).mockReturnValue(noopMutation as ReturnType<typeof useSetTaskGeneralStatus>);
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

// Default TaskHeader implementation — restored in beforeEach so per-test
// overrides via mockImplementation don't leak into subsequent tests.
const defaultTaskHeaderImpl = ({ task, onStageMove: _onStageMove, onSetStatus, onDelete, isAdmin }: {
  task: { title: string; generalStatus: string; isClosed?: boolean };
  onStageMove: (stageId: string) => Promise<void>;
  onSetStatus: (status: string) => void;
  onDelete: () => void;
  isAdmin: boolean;
}) => (
  <div data-testid="task-header">
    <span>{task.title}</span>
    <span data-testid="task-status-badge">{task.generalStatus === 'closed' ? 'Cerrada' : 'Activa'}</span>
    <button data-testid="kebab-menu" onClick={() => {
      const menu = document.getElementById('kebab-menu-content');
      if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }}>⋮</button>
    <div id="kebab-menu-content" style={{ display: 'none' }}>
      <button data-testid="kebab-close" onClick={() => onSetStatus('closed')}>Cerrar tarea</button>
      <button data-testid="kebab-dismiss" onClick={() => onSetStatus('dismissed')}>Descartar tarea</button>
      {task.generalStatus === 'closed' && (
        <button data-testid="kebab-reopen" onClick={() => onSetStatus('open')}>Reabrir tarea</button>
      )}
      {isAdmin && (
        <button data-testid="kebab-delete" onClick={() => onDelete()}>Eliminar tarea</button>
      )}
    </div>
  </div>
);

describe('SchedulingTaskDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore permissive default for useCan after vi.clearAllMocks() wipes it
    vi.mocked(useCan).mockImplementation(() => true);
    // Restore TaskHeader default so per-test mockImplementation overrides don't leak
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(TaskHeader).mockImplementation(defaultTaskHeaderImpl as any);
    // Restore feature flag defaults (flag OFF, teams empty) so tests that call
    // enableIclassAssign() don't leak state into subsequent tests.
    const { useFeatureFlag } = await import('@/hooks/useFeatureFlags');
    const { useIClassTechnicianTeams } = await import('@/hooks/useIClassTechnicianTeams');
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'iclass-assign-action', enabled: false },
      isLoading: false,
    } as ReturnType<typeof useFeatureFlag>);
    vi.mocked(useIClassTechnicianTeams).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useIClassTechnicianTeams>);
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

  it('shows "Cerrar tarea" option in kebab menu for an open task (#41)', async () => {
    setupMocks();
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-close')).toHaveTextContent('Cerrar tarea');
    expect(screen.getByTestId('kebab-dismiss')).toHaveTextContent('Descartar tarea');
  });

  it('shows "Reabrir tarea" option in kebab menu for a closed task (#41)', async () => {
    setupMocks({ taskData: { generalStatus: 'closed', isClosed: true } });
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-reopen')).toHaveTextContent('Reabrir tarea');
  });

  it('shows "Cerrada" badge in header when task is closed (#41)', async () => {
    setupMocks({ taskData: { generalStatus: 'closed', isClosed: true } });
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('task-status-badge')).toHaveTextContent('Cerrada');
    });
  });

  it('calls useSetTaskGeneralStatus with "closed" when "Cerrar tarea" is clicked (#41)', async () => {
    setupMocks();
    const setStatusMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useSetTaskGeneralStatus).mockReturnValue({ ...noopMutation, mutateAsync: setStatusMutateAsync } as ReturnType<typeof useSetTaskGeneralStatus>);
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    fe.click(screen.getByTestId('kebab-close'));
    await waitFor(() => {
      expect(setStatusMutateAsync).toHaveBeenCalledWith({ id: 'task-1', status: 'closed' });
    });
  });

  it('dismiss routes through a confirm before calling useSetTaskGeneralStatus (#41)', async () => {
    setupMocks();
    const setStatusMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useSetTaskGeneralStatus).mockReturnValue({ ...noopMutation, mutateAsync: setStatusMutateAsync } as ReturnType<typeof useSetTaskGeneralStatus>);
    // Confirm auto-resolves true via the global setup mock.
    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
    });
    fe.click(screen.getByTestId('kebab-menu'));
    fe.click(screen.getByTestId('kebab-dismiss'));
    await waitFor(() => {
      expect(setStatusMutateAsync).toHaveBeenCalledWith({ id: 'task-1', status: 'dismissed' });
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

  // ── #130 — IClass pre-move validator ────────────────────────────────────────
  // When operator moves a task to send_to_iclass AND iclassAssignActive is ON,
  // the page must BLOCK the move and show a ConfirmModal if the task is missing
  // a técnico or a valid time window (08:00–20:00 local, start < end).
  // When flag is OFF, the move ALWAYS proceeds (today's behaviour).

  // Helper: turn on the flag + teams so iclassAssignActive === true
  async function enableIclassAssign() {
    const { useFeatureFlag } = await import('@/hooks/useFeatureFlags');
    const { useIClassTechnicianTeams } = await import('@/hooks/useIClassTechnicianTeams');
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'iclass-assign-action', enabled: true },
      isLoading: false,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useFeatureFlag>);
    vi.mocked(useIClassTechnicianTeams).mockReturnValue({
      data: [{ userId: 'admin-1', userName: 'Ana', userLogin: 'ana', iclassTeamLogin: 'equipo-a', teamName: 'Alpha', teamActive: true }],
      isLoading: false,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useIClassTechnicianTeams>);
  }

  it('#130 flag ON + no assignee → modal shows, moveToStage NOT called', async () => {
    await enableIclassAssign();
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    setupMocks({ taskData: { assigneeId: null, assigneeName: null } });

    // Capture handleStageMove from TaskHeader's onStageMove prop
    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    const { fireEvent: fe } = await import('@testing-library/react');
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());

    // Trigger move to send_to_iclass stage
    await waitFor(() => { capturedOnStageMove?.('stage-iclass'); });

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog').textContent).toMatch(/técnico/i);
    // Move was NOT called
    expect(moveAsync).not.toHaveBeenCalled();

    // Dismiss modal
    fe.click(screen.getByText('Entendido'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('#130 flag ON + no startDate/endDate → modal shows, not moved', async () => {
    await enableIclassAssign();
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    setupMocks({ taskData: { assigneeId: 'admin-1', startDate: null, endDate: null } });

    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());

    await waitFor(() => { capturedOnStageMove?.('stage-iclass'); });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByRole('dialog').textContent).toMatch(/horario/i);
    expect(moveAsync).not.toHaveBeenCalled();
  });

  it('#130 flag ON + time outside 08:00-20:00 (07:00 start) → modal shows, not moved', async () => {
    await enableIclassAssign();
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    // 07:00 AM local — below minimum
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const start = new Date(2026, 5, 20, 7, 0, 0).toISOString();
    const end = new Date(2026, 5, 20, 9, 0, 0).toISOString();
    setupMocks({ taskData: { assigneeId: 'admin-1', startDate: start, endDate: end } });

    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());
    await waitFor(() => { capturedOnStageMove?.('stage-iclass'); });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(moveAsync).not.toHaveBeenCalled();
    // suppress unused variable warning
    void tzOffset;
  });

  it('#130 flag ON + end past 20:00 (21:00) → modal shows, not moved', async () => {
    await enableIclassAssign();
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    const start = new Date(2026, 5, 20, 10, 0, 0).toISOString();
    const end = new Date(2026, 5, 20, 21, 0, 0).toISOString();
    setupMocks({ taskData: { assigneeId: 'admin-1', startDate: start, endDate: end } });

    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());
    await waitFor(() => { capturedOnStageMove?.('stage-iclass'); });

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(moveAsync).not.toHaveBeenCalled();
  });

  it('#130 flag ON + valid técnico + valid window (13:00-14:00) → move proceeds', async () => {
    await enableIclassAssign();
    const start = new Date(2026, 5, 20, 13, 0, 0).toISOString();
    const end = new Date(2026, 5, 20, 14, 0, 0).toISOString();
    setupMocks({ taskData: { assigneeId: 'admin-1', startDate: start, endDate: end } });
    // Must be AFTER setupMocks — setupMocks overwrites useMoveTaskToStage with noopMutation.
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());
    await waitFor(() => { capturedOnStageMove?.('stage-iclass'); });

    // Modal must NOT appear, move must be called
    await waitFor(() => {
      expect(moveAsync).toHaveBeenCalledWith({ id: 'task-1', stageId: 'stage-iclass' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('#130 flag OFF → move to send_to_iclass proceeds even without técnico/horario', async () => {
    // Default mock has flag OFF (see vi.mock at top: enabled: false)
    setupMocks({ taskData: { assigneeId: null, startDate: null, endDate: null } });
    // Must be AFTER setupMocks — setupMocks overwrites useMoveTaskToStage with noopMutation.
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());
    await waitFor(() => { capturedOnStageMove?.('stage-iclass'); });

    await waitFor(() => {
      expect(moveAsync).toHaveBeenCalledWith({ id: 'task-1', stageId: 'stage-iclass' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('#130 moving to a NON-send_to_iclass stage never validates (proceeds always)', async () => {
    await enableIclassAssign();
    // Task with no assignee, no dates — would fail validation if target were send_to_iclass
    setupMocks({ taskData: { assigneeId: null, startDate: null, endDate: null } });
    // Must be AFTER setupMocks — setupMocks overwrites useMoveTaskToStage with noopMutation.
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());
    // Move to stage-2 (En progreso — code: 'en_progreso'), NOT send_to_iclass
    await waitFor(() => { capturedOnStageMove?.('stage-2'); });

    await waitFor(() => {
      expect(moveAsync).toHaveBeenCalledWith({ id: 'task-1', stageId: 'stage-2' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ── #tz-fix — timezone-safe window validation ────────────────────────────────
  // Regression: the old code used getHours()/getMinutes() (host-local). In a
  // UTC host, a task at 19:30–20:00 ART (= 22:30–23:00 UTC) has UTC hours 22/23
  // → fails the 08:00–20:00 check (22 ≥ 20) and is incorrectly BLOCKED.
  // Fix: use arHour()/arMinute() so the window is evaluated in Argentina time.
  it('#tz-fix: 19:30–20:00 ART (22:30–23:00 UTC) PASSES window — arHour not getHours', async () => {
    await enableIclassAssign();
    // 19:30 ART = 22:30 UTC; 20:00 ART = 23:00 UTC.
    // Old code (getHours on UTC host): startH=22 → 22≥20 → BLOCK (wrong).
    // Fixed code (arHour): startH=19 → OK; endH=20 endM=0 → OK (exact 20:00 allowed).
    const startDate = '2026-06-27T22:30:00Z'; // 19:30 ART
    const endDate   = '2026-06-27T23:00:00Z'; // 20:00 ART
    setupMocks({ taskData: { assigneeId: 'admin-1', startDate, endDate } });
    const moveAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMoveTaskToStage).mockReturnValue({ ...noopMutation, mutateAsync: moveAsync } as ReturnType<typeof useMoveTaskToStage>);

    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    let capturedOnStageMove: ((stageId: string) => void) | undefined;
    const { TaskHeader } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader');
    vi.mocked(TaskHeader).mockImplementation(({ onStageMove }: { onStageMove: (stageId: string) => void }) => {
      capturedOnStageMove = onStageMove;
      return <div data-testid="task-header-capture" />;
    });
    vi.mocked(TaskTabs).mockImplementation(() => <div data-testid="task-tabs-capture" />);

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-header-capture')).toBeInTheDocument());
    await waitFor(() => { capturedOnStageMove?.('stage-iclass'); });

    // Must PASS validation → moveAsync called, no blocking modal.
    await waitFor(() => {
      expect(moveAsync).toHaveBeenCalledWith({ id: 'task-1', stageId: 'stage-iclass' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // TaskTabs is mocked in this file, so DatosForm never renders here.
  // The project select is thoroughly covered in DatosForm.test.tsx.
  it.todo('renders project select in task detail (covered by DatosForm.test.tsx component tests)');

  // #122 — el selector manual de cuadrilla IClass se removió de la tarea. Aun
  // con una OS de IClass presente (iclassOrderCode), no debe renderizarse.
  it('does NOT render the IClass team selector even when the task has an iclassOrderCode (#122)', async () => {
    setupMocks({ taskData: { iclassOrderCode: 'OS-99' } });
    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Instalación Cliente Pérez')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/cuadrilla iclass/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /asignar cuadrilla/i })).not.toBeInTheDocument();
  });

  // #122 — el padre debe pasar a DatosForm la info de bloqueo de cuadrilla:
  // el flag activo + un lookup técnico→cuadrilla.
  it('passes iclassAssignActive + technicianHasTeam down to the Datos form (#122)', async () => {
    const { useFeatureFlag } = await import('@/hooks/useFeatureFlags');
    const { useIClassTechnicianTeams } = await import('@/hooks/useIClassTechnicianTeams');
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'iclass-assign-action', enabled: true },
      isLoading: false,
    } as ReturnType<typeof useFeatureFlag>);
    vi.mocked(useIClassTechnicianTeams).mockReturnValue({
      data: [
        { userId: 'admin-1', userName: 'Ana', userLogin: 'ana', iclassTeamLogin: 'equipo-a', teamName: 'Alpha', teamActive: true },
        { userId: 'admin-2', userName: 'Pedro', userLogin: 'pedro', iclassTeamLogin: null, teamName: null, teamActive: false },
      ],
      isLoading: false,
    } as ReturnType<typeof useIClassTechnicianTeams>);

    setupMocks();
    let captured: { iclassAssignActive?: boolean; technicianHasTeam?: (id: string) => boolean } = {};
    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    vi.mocked(TaskTabs).mockImplementation(({ detailsProps }: { detailsProps: { datosForm: typeof captured } }) => {
      captured = detailsProps.datosForm;
      return <div data-testid="task-tabs-capture" />;
    });

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-tabs-capture')).toBeInTheDocument());

    expect(captured.iclassAssignActive).toBe(true);
    expect(captured.technicianHasTeam?.('admin-1')).toBe(true);
    expect(captured.technicianHasTeam?.('admin-2')).toBe(false);
  });

  // #122 FIX-FIRST #1 — FAIL-OPEN: el bloqueo se decide con un Set armado desde
  // useIClassTechnicianTeams(). Mientras ese query está loading (data undefined)
  // o si erroró, el Set queda vacío → technicianHasTeam devuelve false para TODOS
  // → con el flag ON se bloquearía a TODOS los técnicos (incluso los que SÍ tienen
  // cuadrilla). El bloqueo SOLO debe activarse cuando el mapeo cargó OK (isSuccess).
  // Si el mapeo está cargando o falló → NO bloquear (iclassAssignActive=false).
  it('flag ON pero mapeo de cuadrillas LOADING: NO bloquea (fail-open) (#122 FIX-1)', async () => {
    const { useFeatureFlag } = await import('@/hooks/useFeatureFlags');
    const { useIClassTechnicianTeams } = await import('@/hooks/useIClassTechnicianTeams');
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'iclass-assign-action', enabled: true },
      isLoading: false,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useFeatureFlag>);
    // Mapeo todavía cargando: data undefined, isSuccess false.
    vi.mocked(useIClassTechnicianTeams).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useIClassTechnicianTeams>);

    setupMocks();
    let captured: { iclassAssignActive?: boolean; technicianHasTeam?: (id: string) => boolean } = {};
    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    vi.mocked(TaskTabs).mockImplementation(({ detailsProps }: { detailsProps: { datosForm: typeof captured } }) => {
      captured = detailsProps.datosForm;
      return <div data-testid="task-tabs-capture" />;
    });

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-tabs-capture')).toBeInTheDocument());

    // FAIL-OPEN: aunque el flag esté ON, el mapeo no cargó → NO bloquear.
    expect(captured.iclassAssignActive).toBe(false);
  });

  it('flag ON pero mapeo de cuadrillas ERROR: NO bloquea (fail-open) (#122 FIX-1)', async () => {
    const { useFeatureFlag } = await import('@/hooks/useFeatureFlags');
    const { useIClassTechnicianTeams } = await import('@/hooks/useIClassTechnicianTeams');
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'iclass-assign-action', enabled: true },
      isLoading: false,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useFeatureFlag>);
    // Mapeo erroró: data undefined, isError true, isSuccess false.
    vi.mocked(useIClassTechnicianTeams).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
    } as ReturnType<typeof useIClassTechnicianTeams>);

    setupMocks();
    let captured: { iclassAssignActive?: boolean; technicianHasTeam?: (id: string) => boolean } = {};
    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    vi.mocked(TaskTabs).mockImplementation(({ detailsProps }: { detailsProps: { datosForm: typeof captured } }) => {
      captured = detailsProps.datosForm;
      return <div data-testid="task-tabs-capture" />;
    });

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-tabs-capture')).toBeInTheDocument());

    // FAIL-OPEN: el query erroró → NO bloquear (mejor dejar pasar que bloquear a todos).
    expect(captured.iclassAssignActive).toBe(false);
  });

  // Consistencia con el WARNING #4: el mismo criterio de carga aplica al flag.
  // Si el flag todavía no cargó (isSuccess false), no se puede afirmar que esté
  // ON → NO bloquear, aun cuando el mapeo de cuadrillas ya cargó.
  it('mapeo OK pero flag LOADING: NO bloquea (fail-open en el flag) (#122 FIX-1)', async () => {
    const { useFeatureFlag } = await import('@/hooks/useFeatureFlags');
    const { useIClassTechnicianTeams } = await import('@/hooks/useIClassTechnicianTeams');
    // Flag todavía cargando: data undefined, isSuccess false.
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
    } as ReturnType<typeof useFeatureFlag>);
    vi.mocked(useIClassTechnicianTeams).mockReturnValue({
      data: [
        { userId: 'admin-1', userName: 'Ana', userLogin: 'ana', iclassTeamLogin: 'equipo-a', teamName: 'Alpha', teamActive: true },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
    } as ReturnType<typeof useIClassTechnicianTeams>);

    setupMocks();
    let captured: { iclassAssignActive?: boolean; technicianHasTeam?: (id: string) => boolean } = {};
    const { TaskTabs } = await import('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs');
    vi.mocked(TaskTabs).mockImplementation(({ detailsProps }: { detailsProps: { datosForm: typeof captured } }) => {
      captured = detailsProps.datosForm;
      return <div data-testid="task-tabs-capture" />;
    });

    render(<SchedulingTaskDetailPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('task-tabs-capture')).toBeInTheDocument());

    expect(captured.iclassAssignActive).toBe(false);
  });
});
