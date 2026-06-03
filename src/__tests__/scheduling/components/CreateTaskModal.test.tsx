import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// CustomerPicker (embedded in the modal) uses useClientList — stub it so the
// modal renders without a QueryClientProvider.
const useClientListMock = vi.fn(() => ({ data: { data: [] as unknown[], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false }));
const useClientDetailMock = vi.fn(() => ({ data: undefined as unknown }));
const useClientContractsMock = vi.fn(() => ({ data: [] as unknown[] }));
vi.mock('@/hooks/useCustomers', () => ({
  useClientList: () => useClientListMock(),
  useClientDetail: () => useClientDetailMock(),
  useClientContracts: () => useClientContractsMock(),
}));
vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: () => ({ data: [
    { id: 'c1', name: 'Instalación', description: null },
    { id: 'c5', name: 'Otro', description: null },
  ] }),
}));
vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: () => ({ data: [
    { id: 'p2', name: 'Normal', color: '#3b82f6', weight: 2 },
    { id: 'p3', name: 'Alta', color: '#f59e0b', weight: 3 },
  ] }),
}));

import { CreateTaskModal } from '@/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal';
import { useConfirm } from '@/context/ConfirmContext';
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
    useClientContractsMock.mockReturnValue({ data: [] });
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

  /** Helper: sets up mocks with a customer that has one contract, renders, and
   *  picks title + customer + contract + project + description so the form can be submitted. */
  async function setupWithFullForm(title = 'Cambiar router') {
    const customer = { id: 'c-full', name: 'FULL CUSTOMER', email: 'full@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-full', name: 'FULL CUSTOMER', address: 'Calle Full 1' } });
    useClientContractsMock.mockReturnValue({
      data: [{ id: 1, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
      isLoading: false,
    });
    const result = render(
      <CreateTaskModal projects={projects} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: title } });
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Full' } });
    fireEvent.click(await screen.findByText('FULL CUSTOMER'));
    const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
    fireEvent.change(contractSelect, { target: { value: '1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'desc' } });
    return result;
  }

  it('disables the create button until title + client + contract are all entered', async () => {
    const customer = { id: 'c-btn', name: 'BTN CUSTOMER', email: 'btn@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-btn', name: 'BTN CUSTOMER', address: 'Calle 1' } });
    useClientContractsMock.mockReturnValue({
      data: [{ id: 2, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
      isLoading: false,
    });
    setup();
    const btn = screen.getByRole('button', { name: /crear tarea/i });
    // No title yet
    expect(btn).toBeDisabled();
    // Title only — still disabled (no client)
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Cambiar router' } });
    expect(btn).toBeDisabled();
    // Pick customer — still disabled (no contract selected yet)
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'BTN' } });
    fireEvent.click(await screen.findByText('BTN CUSTOMER'));
    await screen.findByRole('combobox', { name: /contrato/i });
    expect(btn).toBeDisabled();
    // Pick contract — still disabled (no project, no description)
    fireEvent.change(screen.getByRole('combobox', { name: /contrato/i }), { target: { value: '2' } });
    expect(btn).toBeDisabled();
    // Pick project — still disabled (no description)
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
    expect(btn).toBeDisabled();
    // Add description — now enabled
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'desc' } });
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
    // Button still disabled without client+service — template alone is not enough
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled();
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
    await setupWithFullForm('Cambiar router');
    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cambiar router',
        projectId: 'proj-1',
        stageId: 'stage-new',
        priority: 'Normal',
        category: 'Otro',
        estimatedHours: 1,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('project select starts with empty placeholder (no project pre-selected, no auto-default)', () => {
    const mixed: Project[] = [
      { id: 'no-wf', title: 'Sin workflow', description: null, workflowId: null, createdAt: '', updatedAt: '' },
      ...projects,
    ];
    render(
      <CreateTaskModal projects={mixed} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    // The select must start empty — no auto-default, operator picks consciously.
    const proyectoSelect = screen.getByRole('combobox', { name: /proyecto/i });
    expect((proyectoSelect as HTMLSelectElement).value).toBe('');
    // No workflow warning should NOT appear before a project is selected.
    expect(screen.queryByText(/no tiene un workflow asignado/i)).not.toBeInTheDocument();
  });

  it('warns and keeps the button disabled when the chosen project has no workflow', () => {
    const noWf: Project[] = [
      { id: 'no-wf', title: 'Sin workflow', description: null, workflowId: null, createdAt: '', updatedAt: '' },
    ];
    render(
      <CreateTaskModal projects={noWf} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea' } });
    // The warning only appears after the user consciously picks a workflow-less project.
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'no-wf' } });
    expect(screen.getByText(/no tiene un workflow asignado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled();
  });

  it('shows an error and does not close when creation fails', async () => {
    onCreate.mockRejectedValueOnce(new Error('boom'));
    await setupWithFullForm('X');
    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    expect(await screen.findByText(/no se pudo crear la tarea/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes immediately on backdrop click when the form is empty', () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    setup();
    fireEvent.click(screen.getByTestId('create-task-overlay'));
    expect(confirmFn).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation on backdrop click when the form has data, and closes if confirmed', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    setup();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Algo cargado' } });
    fireEvent.click(screen.getByTestId('create-task-overlay'));
    expect(confirmFn).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('does NOT close on backdrop click when there is data and the user cancels the confirm', async () => {
    const confirmFn = vi.fn().mockResolvedValue(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    setup();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'No quiero perder esto' } });
    fireEvent.click(screen.getByTestId('create-task-overlay'));
    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel button always closes without confirmation, even with data', () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    setup();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Datos' } });
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(confirmFn).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('auto-fills address from the selected contract (contract > customer precedence)', async () => {
    const customer = { id: 'c-10', name: 'PEREZ MARIO', email: 'perez@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-10', name: 'PEREZ MARIO', address: 'Calle Cliente 100' } });
    useClientContractsMock.mockReturnValue({
      data: [
        { id: 55, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Av. Servicio 999' },
      ],
    });

    setup();

    // Pick the customer
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Perez' } });
    fireEvent.click(await screen.findByText('PEREZ MARIO'));

    // The contract dropdown should now be visible — pick the contract
    const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
    fireEvent.change(contractSelect, { target: { value: '55' } });

    // Address should be the CONTRACT address, overriding the customer address
    await waitFor(() =>
      expect((screen.getByPlaceholderText('Dirección del trabajo') as HTMLInputElement).value).toBe('Av. Servicio 999'),
    );
  });

  it('falls back to customer address when selected contract has no address', async () => {
    const customer = { id: 'c-11', name: 'GOMEZ ANA', email: 'gomez@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-11', name: 'GOMEZ ANA', address: 'Calle Fallback 50' } });
    useClientContractsMock.mockReturnValue({
      data: [
        { id: 66, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null },
      ],
    });

    setup();

    // Pick the customer
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Gomez' } });
    fireEvent.click(await screen.findByText('GOMEZ ANA'));

    // Pick the contract (no address)
    const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
    fireEvent.change(contractSelect, { target: { value: '66' } });

    // Address should fall back to the customer address
    await waitFor(() =>
      expect((screen.getByPlaceholderText('Dirección del trabajo') as HTMLInputElement).value).toBe('Calle Fallback 50'),
    );
  });

  describe('start/end date inputs', () => {
    it('disables Termina and shows a hint until Inicia has a value', () => {
      setup();
      const start = screen.getByLabelText('Inicia') as HTMLInputElement;
      const end = screen.getByLabelText('Termina') as HTMLInputElement;
      expect(end).toBeDisabled();
      expect(screen.getByText(/Primero indicá la fecha de inicio/i)).toBeInTheDocument();
      // Once Start is set, End becomes enabled and the hint goes away.
      fireEvent.change(start, { target: { value: '2026-06-15T10:00' } });
      expect(end).toBeEnabled();
      expect(screen.queryByText(/Primero indicá la fecha de inicio/i)).not.toBeInTheDocument();
    });

    it('auto-defaults Termina to Inicia + 1h when Termina is empty', () => {
      setup();
      const start = screen.getByLabelText('Inicia') as HTMLInputElement;
      const end = screen.getByLabelText('Termina') as HTMLInputElement;
      fireEvent.change(start, { target: { value: '2026-06-15T10:00' } });
      expect(end.value).toBe('2026-06-15T11:00');
    });

    it('respects a user-edited Termina and does not override it on subsequent renders', () => {
      setup();
      const start = screen.getByLabelText('Inicia') as HTMLInputElement;
      const end = screen.getByLabelText('Termina') as HTMLInputElement;
      fireEvent.change(start, { target: { value: '2026-06-15T10:00' } });
      expect(end.value).toBe('2026-06-15T11:00');
      // User edits End manually
      fireEvent.change(end, { target: { value: '2026-06-15T14:30' } });
      // Re-edit Start — the previously edited End must survive
      fireEvent.change(start, { target: { value: '2026-06-15T09:00' } });
      expect(end.value).toBe('2026-06-15T14:30');
    });

    it('submits both startDate and endDate as ISO strings to onCreate', async () => {
      await setupWithFullForm('Reagendar');
      fireEvent.change(screen.getByLabelText('Inicia'), { target: { value: '2026-06-15T10:00' } });
      fireEvent.change(screen.getByLabelText('Termina'), { target: { value: '2026-06-15T12:30' } });
      fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
      await waitFor(() => expect(onCreate).toHaveBeenCalled());
      const payload = onCreate.mock.calls[0][0];
      expect(payload.startDate).toBe(new Date('2026-06-15T10:00').toISOString());
      expect(payload.endDate).toBe(new Date('2026-06-15T12:30').toISOString());
    });

    it('blocks submit when End is earlier than Start and shows an error', async () => {
      await setupWithFullForm('Roto');
      fireEvent.change(screen.getByLabelText('Inicia'), { target: { value: '2026-06-15T15:00' } });
      // Override the auto +1h with an earlier value
      fireEvent.change(screen.getByLabelText('Termina'), { target: { value: '2026-06-15T14:00' } });
      fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
      expect(await screen.findByText(/fecha de fin debe ser mayor/i)).toBeInTheDocument();
      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  // ─── NEW: project placeholder + description required ───────────────────────

  it('project select defaults to empty (placeholder), no project pre-selected', () => {
    setup();
    // The Proyecto select must start with the placeholder option selected (value='')
    const proyectoSelect = screen.getByRole('combobox', { name: /proyecto/i });
    expect((proyectoSelect as HTMLSelectElement).value).toBe('');
  });

  it('keeps Crear tarea disabled until a project is selected', async () => {
    // Setup: title + customer + contract + description present, project empty → disabled
    const customer = { id: 'c-proj', name: 'PROJ CUSTOMER', email: 'proj@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-proj', name: 'PROJ CUSTOMER', address: 'Calle Proj 1' } });
    useClientContractsMock.mockReturnValue({
      data: [{ id: 50, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
      isLoading: false,
    });
    render(
      <CreateTaskModal projects={projects} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea con todo menos proyecto' } });
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Proj' } });
    fireEvent.click(await screen.findByText('PROJ CUSTOMER'));
    const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
    fireEvent.change(contractSelect, { target: { value: '50' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'descripción de prueba' } });

    // Project still empty → disabled
    const btn = screen.getByRole('button', { name: /crear tarea/i });
    expect(btn).toBeDisabled();

    // Pick the project → enabled
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
    expect(btn).toBeEnabled();
  });

  it('keeps Crear tarea disabled until a description is entered', async () => {
    // Setup: title + customer + contract + project present, description empty → disabled
    const customer = { id: 'c-desc', name: 'DESC CUSTOMER', email: 'desc@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-desc', name: 'DESC CUSTOMER', address: 'Calle Desc 1' } });
    useClientContractsMock.mockReturnValue({
      data: [{ id: 51, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2500, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
      isLoading: false,
    });
    render(
      <CreateTaskModal projects={projects} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea sin desc' } });
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Desc' } });
    fireEvent.click(await screen.findByText('DESC CUSTOMER'));
    const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
    fireEvent.change(contractSelect, { target: { value: '51' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });

    // Description still empty → disabled
    const btn = screen.getByRole('button', { name: /crear tarea/i });
    expect(btn).toBeDisabled();

    // Type description → enabled
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'descripción requerida' } });
    expect(btn).toBeEnabled();
  });

  it('shows required indicator (*) in the Descripción label', () => {
    setup();
    const descTextarea = screen.getByPlaceholderText('Detalles de la tarea…');
    const descLabel = descTextarea.closest('label');
    expect(descLabel).not.toBeNull();
    expect(descLabel!.textContent).toMatch(/\*/);
  });

  // ─────────────────────────────────────────────────────────────────────────────

  describe('required field indicators', () => {
    it('shows required indicator (*) in the Título label', () => {
      setup();
      // The label text must contain an asterisk to signal the field is required.
      // We look for the aria-label or text node inside the label element.
      const titleInput = screen.getByPlaceholderText('Título de la tarea');
      const titleLabel = titleInput.closest('label');
      expect(titleLabel).not.toBeNull();
      expect(titleLabel!.textContent).toMatch(/\*/);
    });

    it('shows required indicator (*) in the Cliente label', () => {
      setup();
      // "Cliente" is rendered inside a div.label — find by its text and check for *.
      const clienteLabel = screen.getByText(/cliente/i, { selector: '[class*="label"]' });
      expect(clienteLabel.textContent).toMatch(/\*/);
    });

    it('shows required indicator (*) in the Contrato label (when customer is selected)', async () => {
      const customer = { id: 'c-req', name: 'REQ CUSTOMER', email: 'req@test.com' };
      useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
      useClientDetailMock.mockReturnValue({ data: { id: 'c-req', name: 'REQ CUSTOMER', address: 'Calle 1' } });
      useClientContractsMock.mockReturnValue({ data: [], isLoading: false });
      setup();

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Req' } });
      fireEvent.click(await screen.findByText('REQ CUSTOMER'));

      const contratoLabel = await screen.findByRole('combobox', { name: /contrato/i });
      const labelEl = contratoLabel.closest('label');
      expect(labelEl).not.toBeNull();
      expect(labelEl!.textContent).toMatch(/\*/);
    });
  });

  describe('client + contract required', () => {
    function setupWithCustomer(contracts: unknown[] = [], isLoading = false) {
      const customer = { id: 'c-20', name: 'LOPEZ PEDRO', email: 'lopez@test.com' };
      useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
      useClientDetailMock.mockReturnValue({ data: { id: 'c-20', name: 'LOPEZ PEDRO', address: 'Calle 123' } });
      useClientContractsMock.mockReturnValue({ data: contracts, isLoading });
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

    it('keeps Crear tarea disabled when title is present but client is missing', () => {
      setup();
      fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea sin cliente' } });
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled();
    });

    it('keeps Crear tarea disabled when title + client are present but contract is missing', async () => {
      const contracts = [
        { id: 77, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null },
      ];
      setupWithCustomer(contracts);

      fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea con cliente sin contrato' } });

      // Pick the customer
      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      // Contract dropdown is visible but no contract chosen (default empty option)
      await screen.findByRole('combobox', { name: /contrato/i });
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled();
    });

    it('enables Crear tarea when title + client + contract + project + description are all present', async () => {
      const contracts = [
        { id: 88, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2500, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null },
      ];
      setupWithCustomer(contracts);

      fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea completa' } });

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
      fireEvent.change(contractSelect, { target: { value: '88' } });
      fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
      fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'descripción requerida' } });

      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled();
    });

    it('shows informative message and disables select when customer has no contracts', async () => {
      setupWithCustomer([]); // no contracts, not loading

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
      expect(contractSelect).toBeDisabled();
      expect(screen.getByText(/este cliente no tiene contratos/i)).toBeInTheDocument();
    });

    it('does NOT show "sin contratos" message while contracts are loading', async () => {
      setupWithCustomer([], true); // no contracts yet, but loading

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      // While loading, the "no contracts" info must not appear
      await waitFor(() =>
        expect(screen.queryByText(/este cliente no tiene contratos/i)).not.toBeInTheDocument(),
      );
    });

    it('submit passes contractId to onCreate when client + contract are selected', async () => {
      const contracts = [
        { id: 99, plan: 'Plan 200Mbps', type: 'internet', status: 'active', price: 4000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Servicio Calle 9' },
      ];
      setupWithCustomer(contracts);

      fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea con contrato' } });

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
      fireEvent.change(contractSelect, { target: { value: '99' } });
      fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
      fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'descripción requerida' } });

      fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'c-20',
          contractId: '99',
        }),
      );
    });
  });

  describe('initialValues (create-from-ticket prefill)', () => {
    it('prefills title, customer and description from initialValues', () => {
      const customer = { id: 'c-init', name: 'INIT CUSTOMER', email: 'init@test.com' };
      useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
      render(
        <CreateTaskModal
          projects={projects}
          workflows={workflows}
          onClose={onClose}
          onCreate={onCreate}
          loading={false}
          initialValues={{
            title: 'Ticket #7: Sin internet',
            customerId: 'c-init',
            customerName: 'INIT CUSTOMER',
            description: 'No tengo señal desde ayer.',
          }}
        />,
      );
      expect((screen.getByPlaceholderText('Título de la tarea') as HTMLInputElement).value).toBe('Ticket #7: Sin internet');
      expect((screen.getByPlaceholderText('Detalles de la tarea…') as HTMLTextAreaElement).value).toBe('No tengo señal desde ayer.');
      expect(screen.getByText('INIT CUSTOMER')).toBeInTheDocument();
    });

    it('leaves Contrato EMPTY and keeps the submit DISABLED until a contract is chosen', async () => {
      const customer = { id: 'c-init2', name: 'INIT TWO', email: 'init2@test.com' };
      useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
      useClientDetailMock.mockReturnValue({ data: { id: 'c-init2', name: 'INIT TWO', address: 'Calle X' } });
      useClientContractsMock.mockReturnValue({
        data: [{ id: 7, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
        isLoading: false,
      });
      render(
        <CreateTaskModal
          projects={projects}
          workflows={workflows}
          onClose={onClose}
          onCreate={onCreate}
          loading={false}
          initialValues={{ title: 'Pref', customerId: 'c-init2', customerName: 'INIT TWO', description: 'desc' }}
        />,
      );
      const btn = screen.getByRole('button', { name: /crear tarea/i });
      // Title + customer + description prefilled, but contract + project still empty → disabled
      const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
      expect((contractSelect as HTMLSelectElement).value).toBe('');
      expect(btn).toBeDisabled();
      // User picks the contract — still disabled (no project yet)
      fireEvent.change(contractSelect, { target: { value: '7' } });
      expect(btn).toBeDisabled();
      // User picks the project → enabled
      fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
      expect(btn).toBeEnabled();
    });

    it('includes ticketId in the payload when provided', async () => {
      const customer = { id: 'c-tk', name: 'TK CUSTOMER', email: 'tk@test.com' };
      useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
      useClientDetailMock.mockReturnValue({ data: { id: 'c-tk', name: 'TK CUSTOMER', address: 'Calle TK' } });
      useClientContractsMock.mockReturnValue({
        data: [{ id: 3, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
        isLoading: false,
      });
      render(
        <CreateTaskModal
          projects={projects}
          workflows={workflows}
          onClose={onClose}
          onCreate={onCreate}
          loading={false}
          initialValues={{ title: 'Desde ticket', customerId: 'c-tk', customerName: 'TK CUSTOMER', ticketId: 42 }}
        />,
      );
      const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
      fireEvent.change(contractSelect, { target: { value: '3' } });
      fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
      fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'descripción de la tarea' } });
      fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 42 }));
    });

    it('omits ticketId from the payload when not provided (BE-graceful)', async () => {
      await setupWithFullForm('Sin ticket');
      fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
      const payload = onCreate.mock.calls[0][0] as Record<string, unknown>;
      expect('ticketId' in payload).toBe(false);
    });
  });
});
