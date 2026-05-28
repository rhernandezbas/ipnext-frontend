import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TaskHeader } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskHeader';
import type { ScheduledTask } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import type React from 'react';

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
  serviceId: null,
  partnerId: null,
  reporterId: null,
  assigneeId: null,
  assigneeName: null,
  watcherIds: [],
  travelTimeTo: null,
  travelTimeFrom: null,
  checklist: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
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
    onClose: vi.fn(),
    isAdmin: false,
    isSaving: false,
    ...props,
  };
  return {
    ...render(
      <MemoryRouter>
        <TaskHeader {...defaults} />
      </MemoryRouter>
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

  it('shows "Cerrar tarea" in kebab menu for open task', async () => {
    const user = userEvent.setup();
    renderHeader({ onTitleSave, onStageMove, onPriorityChange, onDelete, isAdmin: false });
    await user.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-close')).toHaveTextContent('Cerrar tarea');
  });

  it('shows "Reabrir tarea" in kebab menu for closed task', async () => {
    const user = userEvent.setup();
    const closedTask = { ...mockTask, isClosed: true };
    renderHeader({ task: closedTask, onTitleSave, onStageMove, onPriorityChange, onDelete, isAdmin: false });
    await user.click(screen.getByTestId('kebab-menu'));
    expect(screen.getByTestId('kebab-close')).toHaveTextContent('Reabrir tarea');
  });

  it('shows "Cerrada" badge when task.isClosed is true', () => {
    const closedTask = { ...mockTask, isClosed: true };
    renderHeader({ task: closedTask });
    expect(screen.getByTestId('task-closed-badge')).toBeInTheDocument();
  });

  it('does NOT show "Cerrada" badge for open task', () => {
    renderHeader({ task: mockTask });
    expect(screen.queryByTestId('task-closed-badge')).not.toBeInTheDocument();
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
});
