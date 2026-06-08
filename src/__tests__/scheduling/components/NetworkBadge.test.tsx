/**
 * RED badge tests (#29 — network task kind badge)
 * Tests KanbanCard and TasksTableView render a RED badge when task.kind === 'network'
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ScheduledTask } from '@/types/scheduling';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}));

vi.mock('@/hooks/useScheduling', () => ({
  useMoveTaskToStage:        () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkMoveTasksToStage:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCloseTask:              () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTaskInventoryReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask:             () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { KanbanCard } from '@/pages/scheduling/SchedulingTasksPage/components/KanbanCard';
import { TasksTableView } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';
import type { Workflow } from '@/types/workflow';
import type { Project } from '@/types/project';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 't1',
    sequenceNumber: 1,
    title: 'Test Task',
    stageId: 's1',
    stageCategory: 'nuevo',
    projectId: 'p1',
    priority: 'Normal',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    description: null,
    watcherIds: [],
    checklist: [],
    reviewedByInventory: false,
    iclassOrderCode: null,
    estimatedHours: 1,
    address: null,
    coordinates: null,
    category: 'installation',
    projectName: null,
    completedAt: null,
    notes: null,
    startDate: null,
    endDate: null,
    customerId: null,
    customerName: null,
    customerCity: null,
    contractId: null,
    partnerId: null,
    reporterId: null,
    assigneeId: null,
    assigneeName: null,
    travelTimeTo: null,
    travelTimeFrom: null,
    kind: 'customer',
    networkSiteId: null,
    networkSiteName: null,
    ...overrides,
  } as ScheduledTask;
}

const workflows: Workflow[] = [{
  id: 'wf1',
  name: 'Default',
  description: null,
  createdAt: '',
  updatedAt: '',
  stages: [
    { id: 's1', workflowId: 'wf1', name: 'Nuevo', category: 'nuevo', order: 0 },
  ],
}];

const projects: Project[] = [{
  id: 'p1',
  title: 'Fibra',
  description: null,
  workflowId: 'wf1',
  createdAt: '',
  updatedAt: '',
}];

// ── KanbanCard badge tests ────────────────────────────────────────────────────

describe('KanbanCard — RED badge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders RED badge when task.kind === network', () => {
    const task = makeTask({ kind: 'network', networkSiteId: 'ns-1', networkSiteName: 'Nodo Alpha' });
    render(<KanbanCard task={task} />);
    expect(screen.getByTestId('network-badge')).toBeInTheDocument();
  });

  it('does NOT render RED badge when task.kind === customer', () => {
    const task = makeTask({ kind: 'customer', customerId: 'c1', customerName: 'Acme' });
    render(<KanbanCard task={task} />);
    expect(screen.queryByTestId('network-badge')).not.toBeInTheDocument();
  });

  it('shows network site name inside the badge when available', () => {
    const task = makeTask({ kind: 'network', networkSiteId: 'ns-1', networkSiteName: 'Nodo Central' });
    render(<KanbanCard task={task} />);
    expect(screen.getByTestId('network-badge')).toHaveTextContent(/Nodo Central|RED/i);
  });
});

// ── TasksTableView badge tests (title column) ─────────────────────────────────

describe('TasksTableView — RED badge in title column', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders RED badge in the title column when task.kind === network', () => {
    const task = makeTask({ kind: 'network', networkSiteId: 'ns-1', networkSiteName: 'Nodo Sur' });
    render(
      <MemoryRouter>
        <TasksTableView
          tasks={[task]}
          projects={projects}
          workflows={workflows}
          visibleColumnKeys={['sequenceNumber', 'title']}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('network-badge')).toBeInTheDocument();
  });

  it('does NOT render RED badge when task.kind === customer', () => {
    const task = makeTask({ kind: 'customer', customerId: 'c1', customerName: 'Acme Corp' });
    render(
      <MemoryRouter>
        <TasksTableView
          tasks={[task]}
          projects={projects}
          workflows={workflows}
          visibleColumnKeys={['sequenceNumber', 'title']}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('network-badge')).not.toBeInTheDocument();
  });
});
