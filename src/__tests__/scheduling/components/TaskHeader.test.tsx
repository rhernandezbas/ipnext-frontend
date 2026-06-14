import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskHeader } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader';
import type { ScheduledTask } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import type React from 'react';
import { useCan, useMyPermissions } from '@/hooks/useMyPermissions';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';

// TaskHeader now uses useFeatureFlag (for iclass-close-action gate) and useCan —
// mock them so the component doesn't need a real QueryClient or network.
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(() => ({ data: { key: 'iclass-close-action', enabled: false }, isLoading: false, isError: false, refetch: vi.fn() })),
  useSetFeatureFlag: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// CloseIClassOSModal also needs mocks for its internal hooks
vi.mock('@/hooks/useIClassOsActions', () => ({
  useCloseIClassOS: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() })),
  useAssignIClassTeam: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() })),
}));

vi.mock('@/hooks/useIClassResultCodes', () => ({
  useIClassResultCodes: vi.fn(() => ({ data: [], isLoading: false })),
}));

const mockTask: ScheduledTask = {
  id: 'task-1',
  sequenceNumber: 1,
  title: 'Instalación Cliente Pérez',
  description: null,
  priority: 'high',
  estimatedHours: 2,
  address: null,
  coordinates: null,
  category: 'installation',
  projectId: null,
  projectName: null,
  completedAt: null,
  notes: null,
  stageId: 'stage-1',
  stageCategory: 'nuevo',
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
  watcherIds: [],
  travelTimeTo: null,
  travelTimeFrom: null,
  checklist: [],
  reviewedByInventory: false,
  iclassOrderCode: null,
  kind: 'customer',
  networkSiteId: null,
  networkSiteName: null,
  generalStatus: 'open',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  iclassStatus: null,
};

const mockStages: WorkflowStage[] = [
  { id: 'stage-1', workflowId: 'wf-1', name: 'Nuevo', category: 'nuevo', order: 1 },
  { id: 'stage-2', workflowId: 'wf-1', name: 'En progreso', category: 'enProgreso', order: 2 },
  { id: 'stage-3', workflowId: 'wf-1', name: 'Hecho', category: 'hecho', order: 3 },
];

function renderHeader(props: Partial<Parameters<typeof TaskHeader>[0]> = {}) {
  const defaults = {
    task: mockTask,
    stages: mockStages,
    onTitleSave: vi.fn().mockResolvedValue(undefined),
    onStageMove: vi.fn().mockResolvedValue(undefined),
    onPriorityChange: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    onSetStatus: vi.fn(),
    isAdmin: false,
    isSaving: false,
    ...props,
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TaskHeader {...defaults} />
        </MemoryRouter>
      </QueryClientProvider>
    ),
    ...defaults,
  };
}

describe('TaskHeader', () => {
  const onTitleSave = vi.fn();
  const onStageMove = vi.fn();
  const onPriorityChange = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onTitleSave.mockResolvedValue(undefined);
    onStageMove.mockResolvedValue(undefined);
    onPriorityChange.mockResolvedValue(undefined);
  });

  it('displays the task title', () => {
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete });
    expect(screen.getByText('Instalación Cliente Pérez')).toBeInTheDocument();
  });

  it('shows input when title is clicked', async () => {
    const user = userEvent.setup();
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete });
    await user.click(screen.getByText('Instalación Cliente Pérez'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onTitleSave when Enter is pressed with changed value', async () => {
    const user = userEvent.setup();
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete });
    await user.click(screen.getByText('Instalación Cliente Pérez'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Nuevo título');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onTitleSave).toHaveBeenCalledWith('Nuevo título'));
  });

  it('cancels title edit on Escape', async () => {
    const user = userEvent.setup();
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete });
    await user.click(screen.getByText('Instalación Cliente Pérez'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onTitleSave).not.toHaveBeenCalled();
  });

  it('shows current stage on the colour-coded selector', () => {
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete });
    expect(screen.getByLabelText('Cambiar estado')).toHaveTextContent('Nuevo');
  });

  it('calls onStageMove when a stage option is picked', async () => {
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete });
    fireEvent.click(screen.getByLabelText('Cambiar estado'));
    fireEvent.click(screen.getByRole('option', { name: /En progreso/ }));
    await waitFor(() => expect(onStageMove).toHaveBeenCalledWith('stage-2'));
  });

  it('renders kebab menu button', () => {
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete });
    expect(screen.getByTestId('kebab-menu')).toBeInTheDocument();
  });

  // ── General status actions (#41) ─────────────────────────────────────────
  it('open task shows "Cerrar tarea" and "Descartar tarea"', async () => {
    const user = userEvent.setup();
    renderHeader({ task: { ...mockTask, generalStatus: 'open' } });
    await user.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-close')).toHaveTextContent('Cerrar tarea');
    expect(screen.getByTestId('kebab-dismiss')).toHaveTextContent('Descartar tarea');
    expect(screen.queryByTestId('kebab-reopen')).not.toBeInTheDocument();
  });

  it('closed task shows "Reabrir tarea" and "Descartar tarea"', async () => {
    const user = userEvent.setup();
    renderHeader({ task: { ...mockTask, generalStatus: 'closed', isClosed: true } });
    await user.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-reopen')).toHaveTextContent('Reabrir tarea');
    expect(screen.getByTestId('kebab-dismiss')).toHaveTextContent('Descartar tarea');
    expect(screen.queryByTestId('kebab-close')).not.toBeInTheDocument();
  });

  it('dismissed task shows "Reabrir tarea" and "Cerrar tarea"', async () => {
    const user = userEvent.setup();
    renderHeader({ task: { ...mockTask, generalStatus: 'dismissed' } });
    await user.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-reopen')).toHaveTextContent('Reabrir tarea');
    expect(screen.getByTestId('kebab-close')).toHaveTextContent('Cerrar tarea');
    expect(screen.queryByTestId('kebab-dismiss')).not.toBeInTheDocument();
  });

  it('calls onSetStatus("closed") when "Cerrar tarea" is clicked on an open task', async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn();
    renderHeader({ task: { ...mockTask, generalStatus: 'open' }, onSetStatus });
    await user.click(screen.getByTestId('kebab-menu'));
    await user.click(screen.getByTestId('kebab-close'));
    expect(onSetStatus).toHaveBeenCalledWith('closed');
  });

  it('calls onSetStatus("dismissed") when "Descartar tarea" is clicked', async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn();
    renderHeader({ task: { ...mockTask, generalStatus: 'open' }, onSetStatus });
    await user.click(screen.getByTestId('kebab-menu'));
    await user.click(screen.getByTestId('kebab-dismiss'));
    expect(onSetStatus).toHaveBeenCalledWith('dismissed');
  });

  it('calls onSetStatus("open") when "Reabrir tarea" is clicked on a dismissed task', async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn();
    renderHeader({ task: { ...mockTask, generalStatus: 'dismissed' }, onSetStatus });
    await user.click(screen.getByTestId('kebab-menu'));
    await user.click(screen.getByTestId('kebab-reopen'));
    expect(onSetStatus).toHaveBeenCalledWith('open');
  });

  it('shows "Cerrada" badge for a closed task', () => {
    renderHeader({ task: { ...mockTask, generalStatus: 'closed', isClosed: true } });
    expect(screen.getByTestId('task-status-badge')).toHaveTextContent('Cerrada');
  });

  it('shows "Descartada" badge for a dismissed task', () => {
    renderHeader({ task: { ...mockTask, generalStatus: 'dismissed' } });
    expect(screen.getByTestId('task-status-badge')).toHaveTextContent('Descartada');
  });

  it('does NOT show a status badge for an open task', () => {
    renderHeader({ task: { ...mockTask, generalStatus: 'open' } });
    expect(screen.queryByTestId('task-status-badge')).not.toBeInTheDocument();
  });

  it('hides "Eliminar tarea" in kebab menu for non-admin', async () => {
    const user = userEvent.setup();
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete, isAdmin: false });
    await user.click(screen.getByTestId('kebab-menu'));
    expect(screen.queryByTestId('kebab-delete')).not.toBeInTheDocument();
  });

  it('shows "Eliminar tarea" in kebab menu for admin', async () => {
    const user = userEvent.setup();
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete, isAdmin: true });
    await user.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-delete')).toBeInTheDocument();
  });

  // ── FIX 4: Gate "Cerrar OS" button — lives in TaskHeader (not in modal) ─────

  // FIX 4a: Without scheduling.iclass_close permission, button does NOT appear
  it('does NOT show "Cerrar OS" button without scheduling.iclass_close permission', () => {
    // useCan is globally mocked to return true; override to deny this permission.
    vi.mocked(useCan).mockImplementation((perm) => perm !== 'scheduling.iclass_close');
    // useMyPermissions.can() also needs to deny (Can component uses it)
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (perm) => {
        const p = Array.isArray(perm) ? perm : [perm];
        return p.every(x => x !== 'scheduling.iclass_close');
      },
    });
    // Flag ON so only permission blocks it
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'iclass-close-action', enabled: true },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useFeatureFlag>);

    renderHeader({ task: { ...mockTask, iclassOrderCode: 'OS-001' } });

    expect(screen.queryByTestId('close-iclass-os-btn')).not.toBeInTheDocument();
  });

  // FIX 4b (happy path): With permission + flag ON + iclassOrderCode set → button appears
  it('shows "Cerrar OS" button with permission + flag ON + iclassOrderCode', () => {
    // useCan: grant all (global default already does this, but be explicit)
    vi.mocked(useCan).mockImplementation(() => true);
    // Flag ON
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'iclass-close-action', enabled: true },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useFeatureFlag>);

    renderHeader({ task: { ...mockTask, iclassOrderCode: 'OS-001' } });

    expect(screen.getByTestId('close-iclass-os-btn')).toBeInTheDocument();
  });
});
