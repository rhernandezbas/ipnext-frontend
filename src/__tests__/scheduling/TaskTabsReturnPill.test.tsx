/**
 * Tests for FIX 3 — Return status pill in the Inventory tab of the task detail.
 *
 * Covers:
 * - pending status → amber pill "Devolución pendiente"
 * - needs_review status → amber pill "Devolución en revisión"
 * - confirmed status → green pill "Devolución confirmada"
 * - discarded status → gray pill "Devolución descartada"
 * - no suggestions (empty array) → no pill rendered at all
 * - "Ver en Devoluciones" link renders when suggestions present
 * - gate: fetch only when iclassOrderCode is present
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Heavy deps ───────────────────────────────────────────────────────────────

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    getHTML: () => '<p></p>',
    commands: { setContent: vi.fn() },
    on: vi.fn(), off: vi.fn(), destroy: vi.fn(),
  })),
  EditorContent: () => (
    <div data-testid="editor-content">
      <div contentEditable="true" role="textbox" aria-label="Editor de descripción" />
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({ default: {} }));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline', () => ({
  TaskCommentsTimeline: () => <div data-testid="task-comments-timeline" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskActivityFeed', () => ({
  TaskActivityFeed: () => <div data-testid="task-activity-feed" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm', () => ({
  DatosForm: () => <div data-testid="datos-form" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/UbicacionMap', () => ({
  UbicacionMap: () => <div data-testid="ubicacion-map" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/DescriptionEditor', () => ({
  DescriptionEditor: () => <div data-testid="description-editor" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/ChecklistSection', () => ({
  ChecklistSection: () => <div data-testid="checklist-section" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskInventorySuggestions', () => ({
  TaskInventorySuggestions: () => <div data-testid="inventory-suggestions" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskMaterialConsumptions', () => ({
  TaskMaterialConsumptions: () => <div data-testid="material-consumptions" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskAuditFeed', () => ({
  TaskAuditFeed: () => <div data-testid="task-audit-feed" />,
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/ManualSuggestionForm', () => ({
  ManualSuggestionForm: () => <div data-testid="manual-suggestion-form" />,
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(() => false),
}));

// ── Mock the returns hook ────────────────────────────────────────────────────
vi.mock('@/hooks/useReturns', () => ({
  useReturnsByTask: vi.fn(),
  usePendingReturns: vi.fn(() => ({ data: [] })),
  useConfirmReturn: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDiscardReturn: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

import { useReturnsByTask } from '@/hooks/useReturns';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { ReturnSuggestion } from '@/types/returns';

// ── Mock service inventory hooks (used by TaskInventorySuggestions) ──────────
vi.mock('@/hooks/useServiceInventory', () => ({
  useTaskInventorySuggestions: vi.fn(() => ({ data: [], isLoading: false })),
  useConfirmSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDiscardSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCorrectSuggestionType: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useReplaceSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useAddInstalledItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCreateManualSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// ── Mock task materials consumptions hook ─────────────────────────────────────
vi.mock('@/hooks/useTaskMaterials', () => ({
  useTaskMaterialConsumptions: vi.fn(() => ({ data: [], isLoading: false })),
}));

import { TaskTabs } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs';
import type { TaskDetailsTabProps } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskDetailsTab';

// ── Test helpers ─────────────────────────────────────────────────────────────

function mockPerms() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: ['scheduling.read', 'inventory.read'],
    isLoading: false, isError: false,
    can: (p: string | string[]) => {
      const arr = Array.isArray(p) ? p : [p];
      return arr.some(x => ['scheduling.read', 'inventory.read'].includes(x));
    },
  });
}

function mockReturns(data: ReturnSuggestion[]) {
  vi.mocked(useReturnsByTask).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useReturnsByTask>);
}

const baseDetailsProps: TaskDetailsTabProps = {
  datosForm: {
    initial: {
      projectId: null, assigneeId: null, partnerId: null, customerId: null,
      contractId: null, startDate: null, endDate: null,
      travelTimeTo: null, travelTimeFrom: null, address: null, coordinates: null,
    },
    onSubmit: vi.fn(),
    isSaving: false,
    admins: [],
    partners: [],
    projects: [],
    iclassOrderCode: null,
    originalProjectId: null,
    onDirtyChange: vi.fn(),
  },
  ubicacionMap: { address: null, coordinates: null, onChange: vi.fn() },
  descriptionEditor: { initialHtml: '', onChange: vi.fn() },
  checklistSection: { taskId: 'task-1', checklist: [], onError: vi.fn() },
};

function renderTabs({
  iclassOrderCode = null,
}: { iclassOrderCode?: string | null } = {}) {
  return render(
    <MemoryRouter>
      <TaskTabs
        detailsProps={baseDetailsProps}
        commentsTaskId="task-1"
        reviewedByInventory={false}
        onInventoryToggle={vi.fn()}
        iclassOrderCode={iclassOrderCode}
      />
    </MemoryRouter>,
  );
}

async function switchToInventoryTab() {
  const user = userEvent.setup();
  const inventoryTab = screen.getByRole('tab', { name: /inventory/i });
  await user.click(inventoryTab);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FIX 3 — Return pill: pending status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    mockReturns([
      {
        id: 'ret-1',
        serviceOrderId: 'os-1',
        taskId: 'task-1',
        serialNumber: 'SN-001',
        matchedAssetId: 'asset-1',
        status: 'pending',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ]);
  });

  it('renders the pending pill when there is a pending return', async () => {
    renderTabs({ iclassOrderCode: 'OS-001' });
    await switchToInventoryTab();
    expect(screen.getByTestId('return-pill-pending')).toBeInTheDocument();
    expect(screen.getByTestId('return-pill-pending')).toHaveTextContent('Devolución pendiente');
  });

  it('renders the "Ver en Devoluciones" link', async () => {
    renderTabs({ iclassOrderCode: 'OS-001' });
    await switchToInventoryTab();
    const link = screen.getByTestId('return-link');
    expect(link).toHaveAttribute('href', '/admin/inventory/returns');
  });
});

describe('FIX 3 — Return pill: needs_review status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    mockReturns([
      {
        id: 'ret-2',
        serviceOrderId: 'os-1',
        taskId: 'task-1',
        serialNumber: 'SN-002',
        matchedAssetId: null,
        status: 'needs_review',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ]);
  });

  it('renders the needs_review pill', async () => {
    renderTabs({ iclassOrderCode: 'OS-001' });
    await switchToInventoryTab();
    expect(screen.getByTestId('return-pill-needs_review')).toHaveTextContent('Devolución en revisión');
  });
});

describe('FIX 3 — Return pill: confirmed status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    mockReturns([
      {
        id: 'ret-3',
        serviceOrderId: 'os-1',
        taskId: 'task-1',
        serialNumber: 'SN-003',
        matchedAssetId: 'asset-3',
        status: 'confirmed',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ]);
  });

  it('renders the confirmed pill', async () => {
    renderTabs({ iclassOrderCode: 'OS-001' });
    await switchToInventoryTab();
    expect(screen.getByTestId('return-pill-confirmed')).toHaveTextContent('Devolución confirmada');
  });
});

describe('FIX 3 — Return pill: discarded status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    mockReturns([
      {
        id: 'ret-4',
        serviceOrderId: 'os-1',
        taskId: 'task-1',
        serialNumber: 'SN-004',
        matchedAssetId: null,
        status: 'discarded',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ]);
  });

  it('renders the discarded pill', async () => {
    renderTabs({ iclassOrderCode: 'OS-001' });
    await switchToInventoryTab();
    expect(screen.getByTestId('return-pill-discarded')).toHaveTextContent('Devolución descartada');
  });
});

describe('FIX 3 — Return pill: no suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    mockReturns([]);
  });

  it('does not render the pill row when no returns', async () => {
    renderTabs({ iclassOrderCode: 'OS-001' });
    await switchToInventoryTab();
    expect(screen.queryByTestId('return-pill-row')).not.toBeInTheDocument();
  });

  it('does not render the "Ver en Devoluciones" link when no returns', async () => {
    renderTabs({ iclassOrderCode: 'OS-001' });
    await switchToInventoryTab();
    expect(screen.queryByTestId('return-link')).not.toBeInTheDocument();
  });
});

describe('FIX 3 — Return pill: gate (no iclassOrderCode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms();
    // When iclassOrderCode is absent the hook is called with enabled=false.
    // In that case TanStack Query returns data=undefined. Replicate this here.
    vi.mocked(useReturnsByTask).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useReturnsByTask>);
  });

  it('does not render the pill when iclassOrderCode is absent (data undefined)', async () => {
    renderTabs({ iclassOrderCode: null });
    await switchToInventoryTab();
    expect(screen.queryByTestId('return-pill-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('return-pill-row')).not.toBeInTheDocument();
  });

  it('calls useReturnsByTask with enabled=false when iclassOrderCode is null', async () => {
    renderTabs({ iclassOrderCode: null });
    await switchToInventoryTab();
    // The hook should have been called with enabled=false
    expect(vi.mocked(useReturnsByTask)).toHaveBeenCalledWith('task-1', false);
  });
});
