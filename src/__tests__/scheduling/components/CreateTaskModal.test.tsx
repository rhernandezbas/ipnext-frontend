import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// CustomerPicker (embedded in the modal) uses useClientList — stub it so the
// modal renders without a QueryClientProvider.
const useClientListMock = vi.fn(() => ({ data: { data: [] as unknown[], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false }));
const useClientDetailMock = vi.fn(() => ({ data: undefined as unknown }));
const useClientServicesMock = vi.fn(() => ({ data: [] as unknown[] }));
vi.mock('@/hooks/useCustomers', () => ({
  useClientList: () => useClientListMock(),
  useClientDetail: () => useClientDetailMock(),
  useClientServices: () => useClientServicesMock(),
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
    useClientServicesMock.mockReturnValue({ data: [] });
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

  /** Helper: sets up mocks with a customer that has one service, renders, and
   *  picks both the customer and the service so the form can be submitted. */
  async function setupWithFullForm(title = 'Cambiar router') {
    const customer = { id: 'c-full', name: 'FULL CUSTOMER', email: 'full@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-full', name: 'FULL CUSTOMER', address: 'Calle Full 1' } });
    useClientServicesMock.mockReturnValue({
      data: [{ id: 1, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
      isLoading: false,
    });
    const result = render(
      <CreateTaskModal projects={projects} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: title } });
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Full' } });
    fireEvent.click(await screen.findByText('FULL CUSTOMER'));
    const serviceSelect = await screen.findByRole('combobox', { name: /servicio/i });
    fireEvent.change(serviceSelect, { target: { value: '1' } });
    return result;
  }

  it('disables the create button until title + client + service are all entered', async () => {
    const customer = { id: 'c-btn', name: 'BTN CUSTOMER', email: 'btn@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-btn', name: 'BTN CUSTOMER', address: 'Calle 1' } });
    useClientServicesMock.mockReturnValue({
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
    // Pick customer — still disabled (no service selected yet)
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'BTN' } });
    fireEvent.click(await screen.findByText('BTN CUSTOMER'));
    await screen.findByRole('combobox', { name: /servicio/i });
    expect(btn).toBeDisabled();
    // Pick service — now enabled
    fireEvent.change(screen.getByRole('combobox', { name: /servicio/i }), { target: { value: '2' } });
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

  it('defaults to the first project WITH a workflow, skipping workflow-less ones', () => {
    const mixed: Project[] = [
      { id: 'no-wf', title: 'Sin workflow', description: null, workflowId: null, createdAt: '', updatedAt: '' },
      ...projects,
    ];
    render(
      <CreateTaskModal projects={mixed} workflows={workflows} onClose={onClose} onCreate={onCreate} loading={false} />,
    );
    // The "no workflow" warning should NOT appear — default selection landed on 'proj-1' (has workflow).
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

  it('auto-fills address from the selected service (service > customer precedence)', async () => {
    const customer = { id: 'c-10', name: 'PEREZ MARIO', email: 'perez@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-10', name: 'PEREZ MARIO', address: 'Calle Cliente 100' } });
    useClientServicesMock.mockReturnValue({
      data: [
        { id: 55, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Av. Servicio 999' },
      ],
    });

    setup();

    // Pick the customer
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Perez' } });
    fireEvent.click(await screen.findByText('PEREZ MARIO'));

    // The service dropdown should now be visible — pick the service
    const serviceSelect = await screen.findByRole('combobox', { name: /servicio/i });
    fireEvent.change(serviceSelect, { target: { value: '55' } });

    // Address should be the SERVICE address, overriding the customer address
    await waitFor(() =>
      expect((screen.getByPlaceholderText('Dirección del trabajo') as HTMLInputElement).value).toBe('Av. Servicio 999'),
    );
  });

  it('falls back to customer address when selected service has no address', async () => {
    const customer = { id: 'c-11', name: 'GOMEZ ANA', email: 'gomez@test.com' };
    useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-11', name: 'GOMEZ ANA', address: 'Calle Fallback 50' } });
    useClientServicesMock.mockReturnValue({
      data: [
        { id: 66, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null },
      ],
    });

    setup();

    // Pick the customer
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Gomez' } });
    fireEvent.click(await screen.findByText('GOMEZ ANA'));

    // Pick the service (no address)
    const serviceSelect = await screen.findByRole('combobox', { name: /servicio/i });
    fireEvent.change(serviceSelect, { target: { value: '66' } });

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

    it('shows required indicator (*) in the Servicio label (when customer is selected)', async () => {
      const customer = { id: 'c-req', name: 'REQ CUSTOMER', email: 'req@test.com' };
      useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
      useClientDetailMock.mockReturnValue({ data: { id: 'c-req', name: 'REQ CUSTOMER', address: 'Calle 1' } });
      useClientServicesMock.mockReturnValue({ data: [], isLoading: false });
      setup();

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Req' } });
      fireEvent.click(await screen.findByText('REQ CUSTOMER'));

      const servicioLabel = await screen.findByRole('combobox', { name: /servicio/i });
      const labelEl = servicioLabel.closest('label');
      expect(labelEl).not.toBeNull();
      expect(labelEl!.textContent).toMatch(/\*/);
    });
  });

  describe('client + service required', () => {
    function setupWithCustomer(services: unknown[] = [], isLoading = false) {
      const customer = { id: 'c-20', name: 'LOPEZ PEDRO', email: 'lopez@test.com' };
      useClientListMock.mockReturnValue({ data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
      useClientDetailMock.mockReturnValue({ data: { id: 'c-20', name: 'LOPEZ PEDRO', address: 'Calle 123' } });
      useClientServicesMock.mockReturnValue({ data: services, isLoading });
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

    it('keeps Crear tarea disabled when title + client are present but service is missing', async () => {
      const services = [
        { id: 77, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null },
      ];
      setupWithCustomer(services);

      fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea con cliente sin servicio' } });

      // Pick the customer
      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      // Service dropdown is visible but no service chosen (default empty option)
      await screen.findByRole('combobox', { name: /servicio/i });
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled();
    });

    it('enables Crear tarea when title + client + service are all present', async () => {
      const services = [
        { id: 88, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2500, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null },
      ];
      setupWithCustomer(services);

      fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea completa' } });

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      const serviceSelect = await screen.findByRole('combobox', { name: /servicio/i });
      fireEvent.change(serviceSelect, { target: { value: '88' } });

      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled();
    });

    it('shows informative message and disables select when customer has no services', async () => {
      setupWithCustomer([]); // no services, not loading

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      const serviceSelect = await screen.findByRole('combobox', { name: /servicio/i });
      expect(serviceSelect).toBeDisabled();
      expect(screen.getByText(/este cliente no tiene servicios/i)).toBeInTheDocument();
    });

    it('does NOT show "sin servicios" message while services are loading', async () => {
      setupWithCustomer([], true); // no services yet, but loading

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      // While loading, the "no services" info must not appear
      await waitFor(() =>
        expect(screen.queryByText(/este cliente no tiene servicios/i)).not.toBeInTheDocument(),
      );
    });

    it('submit passes serviceId to onCreate when client + service are selected', async () => {
      const services = [
        { id: 99, plan: 'Plan 200Mbps', type: 'internet', status: 'active', price: 4000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Servicio Calle 9' },
      ];
      setupWithCustomer(services);

      fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea con servicio' } });

      fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Lopez' } });
      fireEvent.click(await screen.findByText('LOPEZ PEDRO'));

      const serviceSelect = await screen.findByRole('combobox', { name: /servicio/i });
      fireEvent.change(serviceSelect, { target: { value: '99' } });

      fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));

      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'c-20',
          serviceId: '99',
        }),
      );
    });
  });
});
