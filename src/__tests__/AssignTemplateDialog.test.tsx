import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TaskTemplate } from '@/types/taskTemplate';

vi.mock('@/hooks/useTaskTemplates', () => ({
  useTaskTemplates: vi.fn(),
}));

vi.mock('@/hooks/useScheduling', () => ({
  useAssignTemplateToTask: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue([]), isPending: false })),
}));

import { AssignTemplateDialog } from '@/pages/scheduling/SchedulingTaskDetailPage/components/AssignTemplateDialog';
import * as templateHooks from '@/hooks/useTaskTemplates';
import * as schedulingHooks from '@/hooks/useScheduling';
import { mockMutation } from '@/__tests__/_utils/reactQueryMocks';

const mockTemplates: TaskTemplate[] = [
  { id: 'tpl-1', name: 'Instalación fibra', description: null, category: 'installation' },
  { id: 'tpl-2', name: 'Reparación señal', description: 'Detalles', category: 'repair' },
];

describe('AssignTemplateDialog', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(templateHooks.useTaskTemplates).mockReturnValue({
      data: mockTemplates,
      isLoading: false,
    } as ReturnType<typeof templateHooks.useTaskTemplates>);
  });

  it('renders template list', () => {
    render(
      <AssignTemplateDialog taskId="task-1" hasExistingItems={false} onClose={onClose} />
    );
    expect(screen.getByText('Instalación fibra')).toBeInTheDocument();
    expect(screen.getByText('Reparación señal')).toBeInTheDocument();
  });

  it('shows warning when task already has items', () => {
    render(
      <AssignTemplateDialog taskId="task-1" hasExistingItems={true} onClose={onClose} />
    );
    expect(screen.getByText(/reemplazará tu lista/i)).toBeInTheDocument();
  });

  it('does NOT show warning when no existing items', () => {
    render(
      <AssignTemplateDialog taskId="task-1" hasExistingItems={false} onClose={onClose} />
    );
    expect(screen.queryByText(/reemplazará tu lista/i)).not.toBeInTheDocument();
  });

  it('confirm fires useAssignTemplateToTask with selected template', async () => {
    const mockMutate = vi.fn().mockResolvedValue([]);
    vi.mocked(schedulingHooks.useAssignTemplateToTask).mockReturnValue(mockMutation({
      mutateAsync: mockMutate,
      isPending: false,
    }));

    render(
      <AssignTemplateDialog taskId="task-1" hasExistingItems={false} onClose={onClose} />
    );

    // Select template
    fireEvent.click(screen.getByText('Instalación fibra'));

    // Click Cargar (confirm button uses aria-label="Confirmar selección")
    fireEvent.click(screen.getByRole('button', { name: /confirmar selección/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledWith('tpl-1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('cancel does NOT fire mutation', () => {
    const mockMutate = vi.fn();
    vi.mocked(schedulingHooks.useAssignTemplateToTask).mockReturnValue(mockMutation({
      mutateAsync: mockMutate,
      isPending: false,
    }));

    render(
      <AssignTemplateDialog taskId="task-1" hasExistingItems={false} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
