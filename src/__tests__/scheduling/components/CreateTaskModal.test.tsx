import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// CustomerPicker (embedded in the modal) uses useClientList — stub it so the
// modal renders without a QueryClientProvider.
const useClientListMock = vi.fn(() => ({ data: { data: [] as unknown[], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false }));
const useClientDetailMock = vi.fn(() => ({ data: undefined as unknown }));
vi.mock('@/hooks/useClients', () => ({
  useClientList: () => useClientListMock(),
  useClientDetail: () => useClientDetailMock(),
}));
vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: () => ({ data: [
    { id: 'c1', name: 'Instalación', description: null },
    { id: 'c5', name: 'Otro', description: null },
  ] }),
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
    useClientListMock.mockReturnValue({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: undefined });
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

  it('does NOT overwrite a description the user already typed when applying a template', () => {
    const templates = [
      { id: 'tpl-1', name: 'Instalación FTTH', description: 'Tirar fibra', category: 'installation' as const },
    ];
    render(
      <CreateTaskModal projects={projects} workflows={workflows} templates={templates} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    // User types their own description first…
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'test' } });
    // …then applies a template.
    fireEvent.change(screen.getByLabelText(/aplicar plantilla/i), { target: { value: 'tpl-1' } });
    // Their text survives; only the empty title gets filled.
    expect((screen.getByPlaceholderText('Detalles de la tarea…') as HTMLTextAreaElement).value).toBe('test');
    expect((screen.getByPlaceholderText('Título de la tarea') as HTMLInputElement).value).toBe('Instalación FTTH');
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
        category: 'Otro',
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

  it('auto-fills the address with the selected customer address', async () => {
    const customer = { id: 'c-9', name: 'ACOSTA JUAN PABLO', email: 'acosta@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-9', name: 'ACOSTA JUAN PABLO', address: 'LOTE 10', city: 'Open Door' } });
    setup();

    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Acosta' } });
    fireEvent.click(await screen.findByText('ACOSTA JUAN PABLO'));

    await waitFor(() =>
      expect((screen.getByPlaceholderText('Dirección del trabajo') as HTMLInputElement).value).toBe('LOTE 10'),
    );
  });
});
