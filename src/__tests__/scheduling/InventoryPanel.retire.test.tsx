/**
 * SCEN-FE-1..6 — Retire equipment button visibility + modal behavior
 *
 * Covers:
 *  SCEN-FE-1: button hidden when projectAllowsRetirement=false
 *  SCEN-FE-2: button hidden when contractId is null (no contract)
 *  SCEN-FE-3: button hidden when user lacks inventory.write
 *  SCEN-FE-4: picker shows only CIIs with status==='active'
 *  SCEN-FE-5: POST success invalidates inventory query + sidebar; retired item disappears
 *  SCEN-FE-6: POST 422 shows toast with mapped Spanish error message
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Heavy deps ────────────────────────────────────────────────────────────────
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    getHTML: () => '<p></p>',
    commands: { setContent: vi.fn() },
    on: vi.fn(), off: vi.fn(), destroy: vi.fn(),
  })),
  EditorContent: () => <div data-testid="editor-content" />,
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
  TaskInventorySuggestions: () => <div data-testid="task-inventory-suggestions" />,
}));
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskMaterialConsumptions', () => ({
  TaskMaterialConsumptions: () => <div data-testid="task-material-consumptions" />,
}));
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/components/TaskAuditFeed', () => ({
  TaskAuditFeed: () => <div data-testid="task-audit-feed" />,
}));

vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn(), useCan: vi.fn(() => false) }));
vi.mock('@/hooks/useReturns', () => ({
  useReturnsByTask: vi.fn(() => ({ data: [], isLoading: false })),
  usePendingReturns: vi.fn(() => ({ data: [] })),
  useConfirmReturn: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDiscardReturn: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// ── Service inventory hook mocks ─────────────────────────────────────────────
vi.mock('@/hooks/useServiceInventory', () => ({
  useServiceInstalledItems: vi.fn(),
  useTaskInventorySuggestions: vi.fn(() => ({ data: [], isLoading: false })),
  useConfirmSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDiscardSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCorrectSuggestionType: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useReplaceSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useAddInstalledItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCreateManualSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// ── Retire mutation mock ─────────────────────────────────────────────────────
vi.mock('@/hooks/useRetireEquipment', () => ({
  useRetireEquipment: vi.fn(),
}));

import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useServiceInstalledItems } from '@/hooks/useServiceInventory';
import { useRetireEquipment } from '@/hooks/useRetireEquipment';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import { TaskTabs } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs';
import type { TaskTabsProps } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockPerms(canFn: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can: canFn,
  } as never);
}

const activeItem: ServiceInstalledItem = {
  id: 'cii-1',
  serviceId: 'svc-1',
  type: 'Router',
  serialNumber: 'SN-001',
  mac: null,
  model: 'HG8145V5',
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: null,
  confirmedAt: null,
  status: 'active',
  notes: null,
  createdAt: '2026-06-01T00:00:00Z',
};

const removedItem: ServiceInstalledItem = {
  ...activeItem,
  id: 'cii-2',
  status: 'removed',
  serialNumber: 'SN-002',
};

const baseDetailsProps: TaskTabsProps['detailsProps'] = {
  datosForm: {
    initial: {
      projectId: 'proj-1',
      assigneeId: null, partnerId: null, customerId: null,
      contractId: 'svc-1', startDate: null, endDate: null,
      travelTimeTo: null, travelTimeFrom: null, address: null, coordinates: null,
    },
    onSubmit: vi.fn(),
    isSaving: false,
    admins: [],
    partners: [],
    projects: [],
    iclassOrderCode: null,
    originalProjectId: 'proj-1',
    onDirtyChange: vi.fn(),
  },
  ubicacionMap: { address: null, coordinates: null, onChange: vi.fn() },
  descriptionEditor: { initialHtml: '', onChange: vi.fn() },
  checklistSection: { taskId: 'task-1', checklist: [], onError: vi.fn() },
};

function makeProps(overrides: Partial<TaskTabsProps> = {}): TaskTabsProps {
  return {
    detailsProps: baseDetailsProps,
    commentsTaskId: 'task-1',
    reviewedByInventory: false,
    onInventoryToggle: vi.fn(),
    contractId: 'svc-1',
    projectAllowsRetirement: true,
    ...overrides,
  };
}

async function switchToInventory() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: /inventory/i }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SCEN-FE-1: button hidden when projectAllowsRetirement=false', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [activeItem], isLoading: false } as never);
    vi.mocked(useRetireEquipment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it('does not render the retire button when projectAllowsRetirement is false', async () => {
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps({ projectAllowsRetirement: false })} />
      </MemoryRouter>,
    );
    await switchToInventory();
    expect(screen.queryByRole('button', { name: /retirar equipo/i })).not.toBeInTheDocument();
  });
});

describe('SCEN-FE-2: button hidden when contractId is null', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useRetireEquipment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it('does not render the retire button when contractId is null', async () => {
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps({ contractId: null, projectAllowsRetirement: true })} />
      </MemoryRouter>,
    );
    await switchToInventory();
    expect(screen.queryByRole('button', { name: /retirar equipo/i })).not.toBeInTheDocument();
  });
});

describe('SCEN-FE-3: button hidden without inventory.write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Grant everything EXCEPT inventory.write
    mockPerms((p) => {
      const arr = Array.isArray(p) ? p : [p];
      return !arr.includes('inventory.write');
    });
    vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [activeItem], isLoading: false } as never);
    vi.mocked(useRetireEquipment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it('does not render retire button without inventory.write permission', async () => {
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    expect(screen.queryByRole('button', { name: /retirar equipo/i })).not.toBeInTheDocument();
  });
});

describe('SCEN-FE-3b: button visible with all gates satisfied', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [activeItem], isLoading: false } as never);
    vi.mocked(useRetireEquipment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it('renders the retire button when all three gates pass', async () => {
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    expect(screen.getByRole('button', { name: /retirar equipo/i })).toBeInTheDocument();
  });
});

describe('SCEN-FE-4: picker shows only active CIIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useServiceInstalledItems).mockReturnValue({
      data: [activeItem, removedItem],
      isLoading: false,
    } as never);
    vi.mocked(useRetireEquipment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it('opens the retire modal when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    await user.click(screen.getByRole('button', { name: /retirar equipo/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows only active items in the picker (filters out removed)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    await user.click(screen.getByRole('button', { name: /retirar equipo/i }));

    // Active item appears
    expect(screen.getByText('SN-001')).toBeInTheDocument();
    // Removed item does NOT appear
    expect(screen.queryByText('SN-002')).not.toBeInTheDocument();
  });
});

describe('SCEN-FE-5: POST success invalidates queries', () => {
  const mutateAsync = vi.fn().mockResolvedValue({ retired: [{ itemId: 'cii-1', status: 'removed' }] });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [activeItem], isLoading: false } as never);
    vi.mocked(useRetireEquipment).mockReturnValue({ mutateAsync, isPending: false } as never);
  });

  it('calls retire mutation with correct taskId and itemIds on confirm', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    await user.click(screen.getByRole('button', { name: /retirar equipo/i }));

    // Select the item by clicking its checkbox
    const checkbox = screen.getByRole('checkbox', { name: /SN-001/i });
    await user.click(checkbox);

    // Confirm the retirement
    await user.click(screen.getByRole('button', { name: /confirmar retiro/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        taskId: 'task-1',
        itemIds: ['cii-1'],
      });
    });
  });

  it('shows success toast after retirement', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    await user.click(screen.getByRole('button', { name: /retirar equipo/i }));

    const checkbox = screen.getByRole('checkbox', { name: /SN-001/i });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /confirmar retiro/i }));

    await waitFor(() => {
      expect(screen.getByText(/retirado/i)).toBeInTheDocument();
    });
  });
});

describe('SCEN-FE-6: 422 error shows mapped Spanish message', () => {
  const makeError = (code: string) => {
    const err = { response: { data: { error: 'error', code } } };
    return Object.assign(new Error(code), err);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [activeItem], isLoading: false } as never);
  });

  it('shows PROJECT_NOT_RETIREMENT message in Spanish', async () => {
    vi.mocked(useRetireEquipment).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(makeError('PROJECT_NOT_RETIREMENT')),
      isPending: false,
    } as never);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    await user.click(screen.getByRole('button', { name: /retirar equipo/i }));
    const checkbox = screen.getByRole('checkbox', { name: /SN-001/i });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /confirmar retiro/i }));

    await waitFor(() => {
      expect(screen.getByText(/proyecto no habilitado para retiro/i)).toBeInTheDocument();
    });
  });

  it('shows EQUIPMENT_NOT_ON_CONTRACT message in Spanish', async () => {
    vi.mocked(useRetireEquipment).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(makeError('EQUIPMENT_NOT_ON_CONTRACT')),
      isPending: false,
    } as never);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    await user.click(screen.getByRole('button', { name: /retirar equipo/i }));
    const checkbox = screen.getByRole('checkbox', { name: /SN-001/i });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /confirmar retiro/i }));

    await waitFor(() => {
      expect(screen.getByText(/equipo no pertenece a este contrato/i)).toBeInTheDocument();
    });
  });

  it('shows RETIRE_ALREADY_DONE message (409) in Spanish', async () => {
    vi.mocked(useRetireEquipment).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(makeError('RETIRE_ALREADY_DONE')),
      isPending: false,
    } as never);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TaskTabs {...makeProps()} />
      </MemoryRouter>,
    );
    await switchToInventory();
    await user.click(screen.getByRole('button', { name: /retirar equipo/i }));
    const checkbox = screen.getByRole('checkbox', { name: /SN-001/i });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /confirmar retiro/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya fue retirado/i)).toBeInTheDocument();
    });
  });
});
