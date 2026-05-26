import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTaskModal } from '@/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';

const workflows: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Default',
    description: null,
    createdAt: '',
    updatedAt: '',
    stages: [
      { id: 'stage-done', workflowId: 'wf-1', name: 'Hecho', category: 'hecho', order: 2 },
      { id: 'stage-new', workflowId: 'wf-1', name: 'Nuevo', category: 'nuevo', order: 0 },
      { id: 'stage-prog', workflowId: 'wf-1', name: 'En progreso', category: 'enProgreso', order: 1 },
    ],
  },
];

const projects: Project[] = [
  { id: 'proj-1', title: 'Instalaciones', description: null, workflowId: 'wf-1', createdAt: '', updatedAt: '' },
];

describe('CreateTaskModal', () => {
  const onClose = vi.fn();
  const onCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onCreate.mockResolvedValue(undefined);
  });

  function setup() {
    return render(
      <CreateTaskModal
        projects={projects}
        workflows={workflows}
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
  }

  it('disables the create button until a title is entered', () => {
    setup();
    const btn = screen.getByRole('button', { name: /crear tarea/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Cambiar router' } });
    expect(btn).toBeEnabled();
  });

  it('creates a task on the FIRST stage (lowest order) of the project workflow', async () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Cambiar router' } });
    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cambiar router',
        projectId: 'proj-1',
        stageId: 'stage-new',
        priority: 'normal',
        category: 'other',
        estimatedHours: 1,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows an error and does not close when creation fails', async () => {
    onCreate.mockRejectedValueOnce(new Error('boom'));
    setup();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    expect(await screen.findByText(/no se pudo crear la tarea/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
