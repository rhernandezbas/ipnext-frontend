import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// CustomerPicker (embedded in the modal) uses useClientList — stub it so the
// modal renders without a QueryClientProvider.
vi.mock('@/hooks/useClients', () => ({
  useClientList: vi.fn(() => ({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false })),
}));

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

  it('applies a template — fills title, description and category', () => {
    const templates = [
      { id: 'tpl-1', name: 'Instalación FTTH', description: 'Tirar fibra', category: 'installation' as const },
    ];
    render(
      <CreateTaskModal projects={projects} workflows={workflows} templates={templates} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByLabelText(/aplicar plantilla/i), { target: { value: 'tpl-1' } });
    expect((screen.getByPlaceholderText('Título de la tarea') as HTMLInputElement).value).toBe('Instalación FTTH');
    expect((screen.getByPlaceholderText('Detalles de la tarea…') as HTMLTextAreaElement).value).toBe('Tirar fibra');
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled();
  });

  it('does not render the template selector when there are no templates', () => {
    setup();
    expect(screen.queryByLabelText(/aplicar plantilla/i)).not.toBeInTheDocument();
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

  it('defaults to the first project WITH a workflow, skipping workflow-less ones', () => {
    const mixed: Project[] = [
      { id: 'no-wf', title: 'Sin workflow', description: null, workflowId: null, createdAt: '', updatedAt: '' },
      ...projects,
    ];
    render(
      <CreateTaskModal projects={mixed} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea' } });
    // Button enabled because the default selection landed on 'proj-1' (has workflow), not 'no-wf'.
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled();
  });

  it('warns and keeps the button disabled when the chosen project has no workflow', () => {
    const noWf: Project[] = [
      { id: 'no-wf', title: 'Sin workflow', description: null, workflowId: null, createdAt: '', updatedAt: '' },
    ];
    render(
      <CreateTaskModal projects={noWf} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea' } });
    expect(screen.getByText(/no tiene un workflow asignado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled();
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
