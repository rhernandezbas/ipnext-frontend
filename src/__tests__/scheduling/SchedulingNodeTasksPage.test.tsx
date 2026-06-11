/**
 * SchedulingNodeTasksPage (#40) — thin wrapper over TasksPageBase.
 *  - REQ-NTP-1: renders title "Tareas Nodos".
 *  - REQ-NTP-2: fetches with kind='network' merged into the backend filter.
 *  - REQ-NTP-4: create modal receives only isNetworkProject=true projects.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

// dnd-kit stubs (same as SchedulingTasksPage test) — table view path doesn't need them
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  DragOverlay: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useDraggable: vi.fn(() => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, isDragging: false })),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
  PointerSensor: class {}, KeyboardSensor: class {},
  useSensor: vi.fn((S: unknown) => S), useSensors: vi.fn((...s: unknown[]) => s), closestCenter: vi.fn(),
}));
vi.mock('@dnd-kit/sortable', () => ({
  sortableKeyboardCoordinates: vi.fn(),
  SortableContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));
vi.mock('@dnd-kit/utilities', () => ({ CSS: { Translate: { toString: vi.fn(() => '') }, Transform: { toString: vi.fn(() => '') } } }));

// Stub the heavy table + filter children — this test exercises the page wiring
// (title, kind filter, modal project filtering), not the table internals.
// Capture the props so we can assert the page forwards a nodos-specific
// emptyMessage (#40 FIX-4).
const tasksTableProps = vi.fn();
vi.mock('@/pages/scheduling/SchedulingTasksPage/components/TasksTableView', () => ({
  TasksTableView: (props: { emptyMessage?: string; visibleColumnKeys?: string[] }) => {
    tasksTableProps(props);
    return React.createElement('div', { 'data-testid': 'tasks-table' }, props.emptyMessage ?? 'table');
  },
  // Mirror the real catalog closely enough that the Cliente column exclusion
  // (#40b fix-b) is exercised: it MUST include 'customerName'.
  ALL_TASK_COLUMNS: [
    { key: 'sequenceNumber', label: '#' },
    { key: 'title', label: 'Título' },
    { key: 'customerName', label: 'Cliente' },
    { key: 'address', label: 'Dirección' },
  ],
}));
vi.mock('@/pages/scheduling/SchedulingTasksPage/components/TaskFilterBar', () => ({
  TaskFilterBar: () => React.createElement('div', { 'data-testid': 'task-filter-bar' }),
}));
vi.mock('@/pages/scheduling/SchedulingTasksPage/components/TasksKanbanView', () => ({
  TasksKanbanView: () => React.createElement('div', { 'data-testid': 'tasks-kanban' }),
}));
const columnSelectorProps = vi.fn();
vi.mock('@/pages/scheduling/SchedulingTasksPage/components/ColumnSelector', () => ({
  ColumnSelector: (props: { columns?: { key: string }[]; visible?: string[] }) => {
    columnSelectorProps(props);
    return React.createElement('div', { 'data-testid': 'column-selector' });
  },
}));

const useFilteredTasksMock = vi.fn();
const idleMut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false });
vi.mock('@/hooks/useScheduling', () => ({
  useFilteredTasks: (f: unknown) => useFilteredTasksMock(f),
  useTasks: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateTask: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
  useMoveTaskToStage: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
  useBulkMoveTasksToStage: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({ summary: { total: 0, ok: 0, failed: 0 }, results: [] }), isPending: false })),
  useDeleteTask: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
  useCloseTask: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
  useSetTaskInventoryReview: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
  useUpdateTask: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
}));
void idleMut;

const useProjectsMock = vi.fn();
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => useProjectsMock() }));
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: () => ({ data: [], isLoading: false }),
  useWorkflow: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('@/hooks/useRbacUsers', () => ({ useRbacUsers: () => ({ data: [] }) }));
vi.mock('@/hooks/useTaskTemplates', () => ({ useTaskTemplates: () => ({ data: [] }) }));
vi.mock('@/hooks/useTaskPriorities', () => ({ useTaskPriorities: () => ({ data: [] }) }));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({ can: () => true, isLoading: false }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'admin', email: 'a@b.com', displayName: 'Admin', role: 'admin', permissions: [] } }),
}));
vi.mock('@/hooks/useNetworkSites', () => ({ useNetworkSites: () => ({ data: [], isLoading: false }) }));
// CreateTaskModal dependencies (it renders when the modal-project test opens "Añadir")
vi.mock('@/hooks/useCustomers', () => ({
  useClientList: () => ({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false }),
  useClientDetail: () => ({ data: undefined }),
  useClientContracts: () => ({ data: [] }),
}));
vi.mock('@/hooks/useTaskCategories', () => ({ useTaskCategories: () => ({ data: [{ id: 'c5', name: 'Otro', description: null }] }) }));
vi.mock('@/context/ConfirmContext', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));

import SchedulingNodeTasksPage from '@/pages/scheduling/SchedulingNodeTasksPage';
import type { Project } from '@/types/project';

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={['/admin/scheduling/nodos']}>
        <Routes>
          <Route path="/admin/scheduling/nodos" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const projects: Project[] = [
  { id: 'np-1', title: 'RED - FIBRA', description: null, workflowId: 'wf-1', isNetworkProject: true, createdAt: '', updatedAt: '' },
  { id: 'cp-1', title: 'INSTALACION', description: null, workflowId: 'wf-1', isNetworkProject: false, createdAt: '', updatedAt: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  useFilteredTasksMock.mockReturnValue({ data: [], isLoading: false, refetch: vi.fn() });
  useProjectsMock.mockReturnValue({ data: projects, isLoading: false });
});

describe('SchedulingNodeTasksPage', () => {
  it('renders the title "Tareas Nodos" (REQ-NTP-1)', () => {
    render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
    expect(screen.getByRole('heading', { name: 'Tareas Nodos' })).toBeInTheDocument();
  });

  it('fetches tasks with kind="network" merged into the filter (REQ-NTP-2)', () => {
    render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
    expect(useFilteredTasksMock).toHaveBeenCalled();
    const lastArg = useFilteredTasksMock.mock.calls.at(-1)?.[0];
    expect(lastArg).toMatchObject({ kind: 'network' });
  });

  it('create modal receives only isNetworkProject=true projects (REQ-NTP-4)', async () => {
    render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
    fireEvent.click(screen.getByRole('button', { name: /añadir/i }));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /proyecto/i })).toBeInTheDocument();
    });
    // Only the network project must appear as an option.
    expect(screen.getByRole('option', { name: 'RED - FIBRA' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'INSTALACION' })).not.toBeInTheDocument();
  });

  // ── #40b fix-b: the Cliente column is meaningless for node tasks and must be
  //   STRUCTURALLY excluded — not toggleable, not in the visible set, not in the
  //   ColumnSelector catalog.
  describe('Cliente column hidden on the Nodos table (#40b fix-b)', () => {
    beforeEach(() => {
      // Ensure no stored prefs re-introduce the column from a prior visit.
      window.localStorage.clear();
    });

    it('never passes customerName in visibleColumnKeys to the table', () => {
      render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
      const lastProps = tasksTableProps.mock.calls.at(-1)?.[0] as { visibleColumnKeys?: string[] };
      expect(lastProps.visibleColumnKeys).toBeDefined();
      expect(lastProps.visibleColumnKeys).not.toContain('customerName');
    });

    it('excludes customerName from the ColumnSelector catalog (not toggleable)', () => {
      render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
      const lastProps = columnSelectorProps.mock.calls.at(-1)?.[0] as { columns?: { key: string }[]; visible?: string[] };
      expect(lastProps.columns?.some(c => c.key === 'customerName')).toBe(false);
      expect(lastProps.visible).not.toContain('customerName');
    });

    it('still shows other columns (e.g. title) — only Cliente is hidden', () => {
      render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
      const lastProps = tasksTableProps.mock.calls.at(-1)?.[0] as { visibleColumnKeys?: string[] };
      expect(lastProps.visibleColumnKeys).toContain('title');
    });

    // Regression: a user who visited the Nodos page BEFORE the column was hidden
    // could have 'customerName' persisted in the nodos column-visibility store.
    // The structural guard must filter it out at render time so it can never
    // resurface from a stale preference.
    it('keeps customerName hidden even when a stale localStorage pref includes it', () => {
      window.localStorage.setItem(
        'scheduling-node-tasks-visible-columns',
        JSON.stringify(['sequenceNumber', 'title', 'customerName', 'address']),
      );
      render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
      const lastProps = tasksTableProps.mock.calls.at(-1)?.[0] as { visibleColumnKeys?: string[] };
      expect(lastProps.visibleColumnKeys).not.toContain('customerName');
      // Other stored columns still survive — only the hidden key is dropped.
      expect(lastProps.visibleColumnKeys).toContain('title');
    });
  });

  // ── FIX-4: nodos-specific empty message (REQ-NTP-6) ────────────────────────
  it('passes a nodos-specific emptyMessage to the table', () => {
    render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
    const lastProps = tasksTableProps.mock.calls.at(-1)?.[0] as { emptyMessage?: string };
    expect(lastProps.emptyMessage).toBe('No hay tareas de nodos para mostrar.');
  });

  // ── FIX-1: day-1 dead-end guidance (REQ-NTP-5) ─────────────────────────────
  // With zero tagged network projects the "Añadir" button is disabled, so the
  // modal hint (the only guidance) is unreachable. The page must surface an
  // ACTIONABLE inline hint near the button so the operator knows what to do.
  describe('empty-network-projects guidance (FIX-1)', () => {
    const hintCopy = /No hay proyectos de red configurados\. Marcá un proyecto en Scheduling → Configuración → Proyectos de red\./i;

    it('shows the actionable inline hint when NO network project exists', () => {
      useProjectsMock.mockReturnValue({
        data: [
          { id: 'cp-1', title: 'INSTALACION', description: null, workflowId: 'wf-1', isNetworkProject: false, createdAt: '', updatedAt: '' },
        ] as Project[],
        isLoading: false,
      });
      render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
      expect(screen.getByText(hintCopy)).toBeInTheDocument();
      // Button stays disabled — the hint is the guidance.
      expect(screen.getByRole('button', { name: /añadir/i })).toBeDisabled();
    });

    it('does NOT show the hint when at least one network project exists', () => {
      // default beforeEach projects include one isNetworkProject=true
      render(<Wrapper><SchedulingNodeTasksPage /></Wrapper>);
      expect(screen.queryByText(hintCopy)).not.toBeInTheDocument();
    });
  });
});
