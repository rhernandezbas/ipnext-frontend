import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the move API at the api layer so the kanban's own optimistic mutation runs.
const moveTaskToStage = vi.fn();
vi.mock('@/api/scheduling.api', () => ({
  moveTaskToStage: (...args: unknown[]) => moveTaskToStage(...args),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({ data: [{ id: 'p1', title: 'Fibra', workflowId: 'wf1' }] }),
}));
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: () => ({
    data: {
      id: 'wf1',
      stages: [
        { id: 's1', workflowId: 'wf1', name: 'Nuevo', category: 'nuevo', order: 0 },
        { id: 's-iclass', workflowId: 'wf1', name: 'Enviar a IClass', category: 'enProgreso', order: 1 },
      ],
    },
    isLoading: false,
  }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// dnd-kit drag is unreliable in jsdom; drive the move through the exposed
// onDragEnd handler by stubbing DndContext to call it with a synthetic event.
let dragEndHandler: ((e: { active: { id: string }; over: { id: string } | null }) => void) | null = null;
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: typeof dragEndHandler }) => {
      dragEndHandler = onDragEnd;
      return <div data-testid="dnd-context">{children}</div>;
    },
  };
});

import { TasksKanbanView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksKanbanView';
import type { ScheduledTask } from '@/types/scheduling';

const baseTask = {
  id: 't1', sequenceNumber: 1, title: 'Tarea', stageId: 's1', stageCategory: 'nuevo',
  projectId: 'p1', priority: 'normal', description: null, watcherIds: [], checklist: [],
  reviewedByInventory: false, iclassOrderCode: null, assigneeName: null, customerName: null,
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
} as unknown as ScheduledTask;

const filter = { projectId: 'p1' };

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(['scheduling-tasks', filter], [baseTask]);
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TasksKanbanView tasks={[baseTask]} filter={filter} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { qc, ...utils };
}

function drop(stageId: string, taskId = 't1') {
  dragEndHandler?.({ active: { id: taskId }, over: { id: stageId } });
}

describe('TasksKanbanView — IClass send feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dragEndHandler = null;
  });

  it('opens the modal on 422 MISSING_REQUIRED_FIELDS and rolls back the card', async () => {
    moveTaskToStage.mockRejectedValue({
      response: { data: { code: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone'] } },
    });
    const { qc } = renderView();

    drop('s-iclass');

    await waitFor(() => expect(screen.getByText('Faltan datos para enviar a IClass')).toBeInTheDocument());
    expect(screen.getByText('Teléfono')).toBeInTheDocument();

    // Rollback: the cached task stays in its original stage.
    const cached = qc.getQueryData<ScheduledTask[]>(['scheduling-tasks', filter]);
    expect(cached?.[0].stageId).toBe('s1');
  });

  it('shows a success toast with the iclassOrderCode on a successful move', async () => {
    moveTaskToStage.mockResolvedValue({ ...baseTask, stageId: 's-iclass', iclassOrderCode: 'OS-987' });
    renderView();

    drop('s-iclass');

    await waitFor(() => expect(screen.getByText(/OS-987/)).toBeInTheDocument());
    expect(screen.queryByText('Faltan datos para enviar a IClass')).not.toBeInTheDocument();
  });

  it('does NOT open the modal for a non-IClass error', async () => {
    moveTaskToStage.mockRejectedValue({ response: { data: { code: 'VALIDATION_ERROR' } } });
    renderView();

    drop('s-iclass');

    await waitFor(() => expect(moveTaskToStage).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates to the task detail when "Editar tarea" is clicked', async () => {
    moveTaskToStage.mockRejectedValue({
      response: { data: { code: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone'] } },
    });
    renderView();

    drop('s-iclass');
    await screen.findByRole('button', { name: 'Editar tarea' });
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarea' }));
    expect(navigateMock).toHaveBeenCalledWith('/admin/scheduling/tasks/t1');
  });
});
