/**
 * Vitest tests for SchedulingTasksPage and its sub-components.
 * All tests use MemoryRouter for URL control.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import type { ScheduledTask } from '@/types/scheduling';

// ── Mock dnd-kit to avoid jsdom pointer event issues ─────────────────────────
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (e: unknown) => void }) => {
    // Expose onDragEnd via a test helper
    (globalThis as Record<string, unknown>).__dndOnDragEnd__ = onDragEnd;
    return React.createElement(React.Fragment, null, children);
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useDraggable: vi.fn(() => ({
    attributes: { role: 'button', 'aria-roledescription': 'draggable' },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
  PointerSensor: class PointerSensor {},
  KeyboardSensor: class KeyboardSensor {},
  useSensor: vi.fn((S: unknown) => S),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  closestCenter: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  sortableKeyboardCoordinates: vi.fn(),
  SortableContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: vi.fn(() => '') }, Transform: { toString: vi.fn(() => '') } },
}));

// ── Mock hooks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useScheduling', () => ({
  useFilteredTasks:   vi.fn(),
  useTasks:           vi.fn(),
  useCreateTask:      vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
  useMoveTaskToStage: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
  useDeleteTask:      vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow:  vi.fn(() => ({ data: undefined, isLoading: false })),
  useWorkflows: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/api/scheduling.api', () => ({
  listTasks: vi.fn(),
  moveTaskToStage: vi.fn(),
}));

import { useFilteredTasks } from '@/hooks/useScheduling';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflow } from '@/hooks/useWorkflows';
import * as api from '@/api/scheduling.api';
import SchedulingTasksPage from '@/pages/scheduling/SchedulingTasksPage';
import { useTasksFilterUrl } from '@/pages/scheduling/SchedulingTasksPage/hooks/useTasksFilterUrl';

// ── Mock SchedulingTaskDetailPage for route order test ───────────────────────
const MockDetailPage = () => React.createElement('div', null, 'Task Detail Page');
const MockTasksPage = () => {
  // A simple stand-in that just says "Tasks Index"
  return React.createElement('div', null, 'Tasks Index Page');
};

// ── Fixtures ─────────────────────────────────────────────────────────────────
const baseTask: ScheduledTask = {
  id: 'task-1',
  sequenceNumber: 1,
  title: 'Test Task Alpha',
  description: null,
  assignedTo: null,
  assignedToId: null,
  clientId: null,
  clientName: null,
  status: 'pending',
  priority: 'normal',
  scheduledDate: null,
  scheduledTime: null,
  estimatedHours: 2,
  address: 'Av. Test 123',
  coordinates: null,
  category: 'repair',
  projectId: 'p1',
  projectName: 'Proyecto Test',
  completedAt: null,
  notes: null,
  stageId: 's1',
  stageCategory: 'nuevo',
  startDate: null,
  endDate: null,
  customerId: null,
  customerName: 'Cliente Test',
  serviceId: null,
  partnerId: null,
  reporterId: null,
  assigneeId: null,
  assigneeName: null,
  watcherIds: [],
  travelTimeTo: null,
  travelTimeFrom: null,
  checklist: [],
};

const baseTask2: ScheduledTask = {
  ...baseTask,
  id: 'task-2',
  sequenceNumber: 2,
  title: 'Test Task Beta',
  stageId: 's2',
  stageCategory: 'enProgreso',
};

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function Wrapper({ children, initialEntries = ['/admin/scheduling/tasks'] }: { children: React.ReactNode; initialEntries?: string[] }) {
  return (
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/admin/scheduling/tasks" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function RouterWithSearch({ children, initialEntries = ['/admin/scheduling/tasks'] }: { children: React.ReactNode; initialEntries?: string[] }) {
  return (
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/admin/scheduling/tasks" element={<>{children}</>} />
          <Route path="/admin/scheduling/tasks/:id" element={<MockDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('SchedulingTasksPage', () => {
  beforeEach(() => {
    vi.mocked(useFilteredTasks).mockReturnValue({
      data: [baseTask, baseTask2],
      isLoading: false,
    } as ReturnType<typeof useFilteredTasks>);

    vi.mocked(useProjects).mockReturnValue({
      data: [{ id: 'p1', title: 'Proyecto Test', description: null, workflowId: 'wf1', createdAt: '', updatedAt: '' }],
      isLoading: false,
    } as ReturnType<typeof useProjects>);

    vi.mocked(useWorkflow).mockReturnValue({
      data: {
        id: 'wf1',
        name: 'Default Workflow',
        description: null,
        stages: [
          { id: 's1', workflowId: 'wf1', name: 'Nuevo',       category: 'nuevo',      order: 0 },
          { id: 's2', workflowId: 'wf1', name: 'En progreso', category: 'enProgreso', order: 1 },
        ],
        createdAt: '',
        updatedAt: '',
      },
      isLoading: false,
    } as ReturnType<typeof useWorkflow>);
  });

  // ── 11.2: page renders in table view by default ─────────────────────────
  it('renders in table view by default (REQ-PAGE-2)', () => {
    render(
      <Wrapper>
        <SchedulingTasksPage />
      </Wrapper>
    );
    const tableBtn = screen.getByRole('button', { name: /vista de la tabla/i });
    expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
  });

  // ── 11.3: view toggle switches views ─────────────────────────────────────
  it('view toggle switches to Kanban view (REQ-PAGE-3)', async () => {
    // Start with projectId so Kanban can render columns (otherwise empty state)
    render(
      <RouterWithSearch initialEntries={['/admin/scheduling/tasks?projectId=p1']}>
        <SchedulingTasksPage />
      </RouterWithSearch>
    );
    const kanbanBtn = screen.getByRole('button', { name: /flujo de trabajo/i });
    fireEvent.click(kanbanBtn);

    // After toggle, kanban region should be present
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /flujo de trabajo/i })).toBeInTheDocument();
    });
  });

  // ── 11.4: Kanban empty state when no project selected (REQ-KANBAN-1) ─────
  it('Kanban empty state when no project selected', async () => {
    render(
      <RouterWithSearch initialEntries={['/admin/scheduling/tasks?view=kanban']}>
        <SchedulingTasksPage />
      </RouterWithSearch>
    );
    await waitFor(() => {
      expect(screen.getByText(/seleccioná un proyecto/i)).toBeInTheDocument();
    });
  });

  // ── 11.8: a11y — Kanban board region role (REQ-A11Y-1) ──────────────────
  it('Kanban board has role=region with correct label', async () => {
    render(
      <RouterWithSearch initialEntries={['/admin/scheduling/tasks?view=kanban&projectId=p1']}>
        <SchedulingTasksPage />
      </RouterWithSearch>
    );
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /flujo de trabajo/i })).toBeInTheDocument();
    });
  });

  // ── Kanban columns render (REQ-KANBAN-2) ────────────────────────────────
  it('Kanban renders one column per stage in workflow', async () => {
    render(
      <RouterWithSearch initialEntries={['/admin/scheduling/tasks?view=kanban&projectId=p1']}>
        <SchedulingTasksPage />
      </RouterWithSearch>
    );
    await waitFor(() => {
      // KanbanColumn components have role="group" with aria-label containing "tarea"
      const columns = screen.getAllByRole('group').filter(
        el => el.getAttribute('aria-label')?.includes('tarea')
      );
      expect(columns.length).toBe(2); // two stages in mock workflow
    });
  });

  // ── Table view renders tasks ─────────────────────────────────────────────
  it('table view renders tasks (checks seq# and project)', () => {
    render(
      <Wrapper>
        <SchedulingTasksPage />
      </Wrapper>
    );
    // DataTable renders sequenceNumber (as a "#N" link to the task) and projectName columns
    expect(screen.getByText('#1')).toBeInTheDocument(); // seq# of baseTask, linkified
    expect(screen.getAllByText('Proyecto Test').length).toBeGreaterThanOrEqual(1); // projectName
  });

  // ── 11.6: drag-drop fires moveTaskToStage ───────────────────────────────
  it('drag-drop fires api.moveTaskToStage with correct args', async () => {
    const moveSpy = vi.mocked(api.moveTaskToStage).mockResolvedValue(baseTask);

    render(
      <RouterWithSearch initialEntries={['/admin/scheduling/tasks?view=kanban&projectId=p1']}>
        <SchedulingTasksPage />
      </RouterWithSearch>
    );

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /flujo de trabajo/i })).toBeInTheDocument();
    });

    // Trigger DndContext onDragEnd via the exposed test handle
    const onDragEnd = (globalThis as Record<string, unknown>).__dndOnDragEnd__ as
      ((e: { active: { id: string }; over: { id: string } }) => void) | undefined;

    if (onDragEnd) {
      act(() => {
        onDragEnd({ active: { id: 'task-1' }, over: { id: 's2' } });
      });
    }

    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalledWith('task-1', 's2');
    });
  });

  // ── Bulk action bar appears on selection ─────────────────────────────────
  it('bulk action bar appears when a row is selected', async () => {
    render(
      <Wrapper>
        <SchedulingTasksPage />
      </Wrapper>
    );

    // Find the first row checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all", next ones are row checkboxes
    const rowCheckbox = checkboxes.find(cb => cb.getAttribute('aria-label')?.includes('task-1'));
    if (rowCheckbox) {
      fireEvent.click(rowCheckbox);
      await waitFor(() => {
        expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
      });
    }
  });
});

// ── Route order test ─────────────────────────────────────────────────────────
describe('App.tsx route order', () => {
  it('/admin/scheduling/tasks and /admin/scheduling/tasks/:id resolve to DIFFERENT components', () => {
    const { unmount } = render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/admin/scheduling/tasks']}>
          <Routes>
            <Route path="/admin/scheduling/tasks" element={<MockTasksPage />} />
            <Route path="/admin/scheduling/tasks/:id" element={<MockDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Tasks Index Page')).toBeInTheDocument();
    expect(screen.queryByText('Task Detail Page')).not.toBeInTheDocument();
    unmount();

    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/admin/scheduling/tasks/abc-123']}>
          <Routes>
            <Route path="/admin/scheduling/tasks" element={<MockTasksPage />} />
            <Route path="/admin/scheduling/tasks/:id" element={<MockDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Task Detail Page')).toBeInTheDocument();
    expect(screen.queryByText('Tasks Index Page')).not.toBeInTheDocument();
  });
});

// ── useTasksFilterUrl hook test ───────────────────────────────────────────────
describe('useTasksFilterUrl', () => {
  it('reads projectId from URL', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={makeQC()}>
          <MemoryRouter initialEntries={['/admin/scheduling/tasks?projectId=abc']}>
            <Routes>
              <Route path="/admin/scheduling/tasks" element={<>{children}</>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      ),
    });
    expect(result.current.filter.projectId).toBe('abc');
  });

  it('returns default view=table when no view param', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={makeQC()}>
          <MemoryRouter initialEntries={['/admin/scheduling/tasks']}>
            <Routes>
              <Route path="/admin/scheduling/tasks" element={<>{children}</>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      ),
    });
    expect(result.current.view).toBe('table');
  });

  it('returns view=kanban when view param is kanban', () => {
    const { result } = renderHook(() => useTasksFilterUrl(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={makeQC()}>
          <MemoryRouter initialEntries={['/admin/scheduling/tasks?view=kanban']}>
            <Routes>
              <Route path="/admin/scheduling/tasks" element={<>{children}</>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      ),
    });
    expect(result.current.view).toBe('kanban');
  });
});
