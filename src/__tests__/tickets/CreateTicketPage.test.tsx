import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CreateTicketPage from '@/pages/tickets/CreateTicketPage';
import * as useTicketsModule from '@/hooks/useTickets';
import * as clientsApi from '@/api/customers.api';
import * as useTicketAreasModule from '@/hooks/useTicketAreas';
import * as useCustomersModule from '@/hooks/useCustomers';

vi.mock('@/hooks/useTickets');
vi.mock('@/api/customers.api');
vi.mock('@/hooks/useTicketAreas');
vi.mock('@/hooks/useCustomers');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderCreate() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={['/admin/tickets/new']}>
        <Routes>
          <Route path="/admin/tickets/new" element={<CreateTicketPage />} />
          <Route path="/admin/tickets" element={<div>Dashboard Tickets</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockMutateAsync = vi.fn();

// Minimal Contract shape buildContractLabel needs ({ id, plan, address?, technology? }).
const CONTRACTS = [
  { id: 'contract-1', plan: 'Plan 100MB', address: 'Calle 1', technology: 'FTTH' },
  { id: 'contract-2', plan: 'Plan 50MB' },
];

/** Default the contracts hook; pass overrides to simulate loading/empty/etc. */
function mockContracts(over: Partial<ReturnType<typeof useCustomersModule.useClientContracts>> = {}) {
  vi.mocked(useCustomersModule.useClientContracts).mockReturnValue({
    data: CONTRACTS,
    isLoading: false,
    ...over,
  } as unknown as ReturnType<typeof useCustomersModule.useClientContracts>);
}

describe('CreateTicketPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketsModule.useCreateTicket).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as ReturnType<typeof useTicketsModule.useCreateTicket>);

    vi.mocked(clientsApi.getClients).mockResolvedValue({
      data: [{ id: 'client-1', name: 'Juan Pérez' } as never],
      total: 1,
      page: 1,
      totalPages: 1,
    });

    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: [
        { id: 'area-1', name: 'Soporte Técnico' },
        { id: 'area-2', name: 'Facturación' },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);

    mockContracts();
  });

  it('renders page title', () => {
    renderCreate();
    expect(screen.getByRole('heading', { name: 'Nuevo Ticket' })).toBeInTheDocument();
  });

  it('renders all form fields including the contract selector', () => {
    renderCreate();
    expect(screen.getByPlaceholderText('Asunto del ticket')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar cliente...')).toBeInTheDocument();
    // three comboboxes now: contrato + prioridad + area
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);
    expect(screen.getByRole('combobox', { name: 'Contrato' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Descripción del problema...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ID de agente')).toBeInTheDocument();
  });

  it('contract select is disabled and prompts to pick a client first', () => {
    renderCreate();
    const contractSelect = screen.getByRole('combobox', { name: 'Contrato' }) as HTMLSelectElement;
    expect(contractSelect).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Seleccioná un cliente primero' })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form (contract included)', async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.click(screen.getByRole('button', { name: 'Crear Ticket' }));

    await waitFor(() => {
      expect(screen.getByText('El asunto es requerido.')).toBeInTheDocument();
      expect(screen.getByText('Seleccioná un cliente.')).toBeInTheDocument();
      expect(screen.getByText('Seleccioná un contrato.')).toBeInTheDocument();
      expect(screen.getByText('La prioridad es requerida.')).toBeInTheDocument();
      expect(screen.getByText('La descripción es requerida.')).toBeInTheDocument();
      expect(screen.getByText('El area es requerida.')).toBeInTheDocument();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('populates the contract select once a client is chosen, then blocks submit until a contract is picked', async () => {
    const user = userEvent.setup();
    renderCreate();

    // Pick a client via the autocomplete (getClients returns Juan Pérez).
    fireEvent.change(screen.getByPlaceholderText('Buscar cliente...'), {
      target: { value: 'Juan' },
    });
    const clientOption = await screen.findByText('Juan Pérez');
    fireEvent.click(clientOption);

    // Contract select is now enabled and lists the client's contracts.
    const contractSelect = await screen.findByRole('combobox', { name: 'Contrato' });
    await waitFor(() => expect(contractSelect).not.toBeDisabled());
    expect(screen.getByRole('option', { name: 'Plan 100MB - Calle 1 - FTTH' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Plan 50MB' })).toBeInTheDocument();

    // Fill the rest but leave the contract empty → submit blocked with field error.
    fireEvent.change(screen.getByPlaceholderText('Asunto del ticket'), { target: { value: 'Sin señal' } });
    fireEvent.change(screen.getByPlaceholderText('Descripción del problema...'), { target: { value: 'No anda.' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridad' }), { target: { value: 'alta' } });

    await user.click(screen.getByRole('button', { name: 'Crear Ticket' }));
    await waitFor(() => {
      expect(screen.getByText('Seleccioná un contrato.')).toBeInTheDocument();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('resets the picked contract when the client changes', async () => {
    renderCreate();

    // Pick client + contract.
    fireEvent.change(screen.getByPlaceholderText('Buscar cliente...'), { target: { value: 'Juan' } });
    fireEvent.click(await screen.findByText('Juan Pérez'));

    const contractSelect = await screen.findByRole('combobox', { name: 'Contrato' }) as HTMLSelectElement;
    await waitFor(() => expect(contractSelect).not.toBeDisabled());
    fireEvent.change(contractSelect, { target: { value: 'contract-1' } });
    expect(contractSelect.value).toBe('contract-1');

    // Typing in the client search clears the client → the contract must reset to ''.
    fireEvent.change(screen.getByPlaceholderText('Buscar cliente...'), { target: { value: 'Ma' } });
    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: 'Contrato' }) as HTMLSelectElement).value).toBe('');
    });
  });

  it('submits with contractId once client + contract are selected', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ id: 'ticket-1' });
    renderCreate();

    fireEvent.change(screen.getByPlaceholderText('Asunto del ticket'), { target: { value: 'Internet caído' } });
    fireEvent.change(screen.getByPlaceholderText('Descripción del problema...'), { target: { value: 'No tengo señal.' } });

    // client
    fireEvent.change(screen.getByPlaceholderText('Buscar cliente...'), { target: { value: 'Juan' } });
    fireEvent.click(await screen.findByText('Juan Pérez'));
    const contractSelect = await screen.findByRole('combobox', { name: 'Contrato' }) as HTMLSelectElement;
    await waitFor(() => expect(contractSelect).not.toBeDisabled());
    fireEvent.change(contractSelect, { target: { value: 'contract-2' } });

    // priority + area
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridad' }), { target: { value: 'alta' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Area' }), { target: { value: 'area-1' } });

    await user.click(screen.getByRole('button', { name: 'Crear Ticket' }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1', contractId: 'contract-2', areaId: 'area-1' }),
    );
  });

  it('maps the BE 422 CONTRACT_CUSTOMER_MISMATCH code to a clear message', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce({
      response: { status: 422, data: { code: 'CONTRACT_CUSTOMER_MISMATCH' } },
    });
    renderCreate();

    fireEvent.change(screen.getByPlaceholderText('Asunto del ticket'), { target: { value: 'X' } });
    fireEvent.change(screen.getByPlaceholderText('Descripción del problema...'), { target: { value: 'Y' } });
    fireEvent.change(screen.getByPlaceholderText('Buscar cliente...'), { target: { value: 'Juan' } });
    fireEvent.click(await screen.findByText('Juan Pérez'));
    const contractSelect = await screen.findByRole('combobox', { name: 'Contrato' }) as HTMLSelectElement;
    await waitFor(() => expect(contractSelect).not.toBeDisabled());
    fireEvent.change(contractSelect, { target: { value: 'contract-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridad' }), { target: { value: 'alta' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Area' }), { target: { value: 'area-1' } });

    await user.click(screen.getByRole('button', { name: 'Crear Ticket' }));

    await waitFor(() => {
      expect(
        screen.getByText('El contrato no pertenece al cliente seleccionado. Volvé a elegir el contrato.'),
      ).toBeInTheDocument();
    });
  });

  it('shows spinner on Crear Ticket button when pending', () => {
    vi.mocked(useTicketsModule.useCreateTicket).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    } as ReturnType<typeof useTicketsModule.useCreateTicket>);

    renderCreate();
    expect(screen.queryByText('Crear Ticket')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Spinner
  });
});
