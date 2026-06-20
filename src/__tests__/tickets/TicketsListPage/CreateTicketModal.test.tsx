import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTicketModal } from '@/pages/tickets/TicketsListPage/components/CreateTicketModal';

// Mock CustomerPicker to avoid heavy deps
vi.mock('@/pages/scheduling/SchedulingTasksPage/components/CustomerPicker', () => ({
  CustomerPicker: ({ onChange }: { onChange: (id: string | null, name: string | null) => void }) => (
    <div>
      <button
        type="button"
        data-testid="customer-picker-select"
        onClick={() => onChange('42', 'Empresa SA')}
      >
        Select Customer
      </button>
    </div>
  ),
}));

vi.mock('@/hooks/useRbacUsers');
vi.mock('@/hooks/useTicketAreas');
vi.mock('@/hooks/useCustomers');

import * as useRbacUsersModule from '@/hooks/useRbacUsers';
import * as useTicketAreasModule from '@/hooks/useTicketAreas';
import * as useCustomersModule from '@/hooks/useCustomers';

const mockUsers = [
  { id: 'u1', name: 'Ana García', roles: [] },
];

// Minimal Contract shape buildContractLabel needs.
const CONTRACTS = [
  { id: 'contract-1', plan: 'Plan 100MB', address: 'Calle 1', technology: 'FTTH' },
  { id: 'contract-2', plan: 'Plan 50MB' },
];

function mockContracts(over: Partial<ReturnType<typeof useCustomersModule.useClientContracts>> = {}) {
  vi.mocked(useCustomersModule.useClientContracts).mockReturnValue({
    data: CONTRACTS,
    isLoading: false,
    ...over,
  } as unknown as ReturnType<typeof useCustomersModule.useClientContracts>);
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderModal(props: {
  onClose?: () => void;
  onCreate?: (data: unknown) => Promise<unknown>;
  loading?: boolean;
}) {
  const { onClose = vi.fn(), onCreate = vi.fn().mockResolvedValue(undefined), loading = false } = props;
  return {
    onClose,
    onCreate,
    ...render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter>
          <CreateTicketModal onClose={onClose} onCreate={onCreate} loading={loading} />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

describe('CreateTicketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({
      data: mockUsers,
      isLoading: false,
    } as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: [{ id: 'area-1', name: 'Soporte' }, { id: 'area-2', name: 'Facturacion' }],
      isLoading: false,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
    mockContracts();
  });

  it('renders form with required fields', () => {
    renderModal({});
    expect(screen.getByLabelText(/asunto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mensaje/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /prioridad/i })).toBeInTheDocument();
  });

  it('renders Cancelar and Crear buttons', () => {
    renderModal({});
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument();
  });

  it('calls onClose when Cancelar is clicked', () => {
    const { onClose } = renderModal({});
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows validation errors when submitting empty required fields', async () => {
    renderModal({});
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(screen.getByText(/asunto.*requerido/i)).toBeInTheDocument();
    });
  });

  it('shows mensaje validation error when empty', async () => {
    renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(screen.getByText(/mensaje.*requerido/i)).toBeInTheDocument();
    });
  });

  it('does NOT call onCreate when fields are empty', async () => {
    const { onCreate } = renderModal({});
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  // #28 follow-up: the payload must match the BE wire shape — `description`
  // (the BE 400s without it; `message` was the legacy mock field).
  // #49: areaId is now required — validate and include in payload.
  it('calls onCreate with the BE wire shape (incl. contractId) when form is filled', async () => {
    const { onCreate } = renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Falla de red' } });
    fireEvent.input(screen.getByLabelText(/mensaje/i), { target: { value: 'Sin internet desde ayer' } });
    fireEvent.change(screen.getByRole('combobox', { name: /prioridad/i }), { target: { value: 'high' } });
    fireEvent.change(screen.getByRole('combobox', { name: /area/i }), { target: { value: 'area-1' } });
    // pick customer (id '42') then contract — both required by the BE
    fireEvent.click(screen.getByTestId('customer-picker-select'));
    const contractSelect = await screen.findByRole('combobox', { name: 'Contrato' });
    await waitFor(() => expect(contractSelect).not.toBeDisabled());
    fireEvent.change(contractSelect, { target: { value: 'contract-2' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Falla de red',
          description: 'Sin internet desde ayer',
          priority: 'high',
          areaId: 'area-1',
          customerId: '42',
          contractId: 'contract-2',
        })
      );
    });
  });

  it('blocks submit and shows a contract error when no contract is picked', async () => {
    const { onCreate } = renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Falla' } });
    fireEvent.input(screen.getByLabelText(/mensaje/i), { target: { value: 'Sin internet' } });
    fireEvent.change(screen.getByRole('combobox', { name: /area/i }), { target: { value: 'area-1' } });
    fireEvent.click(screen.getByTestId('customer-picker-select')); // customer picked, no contract
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(screen.getByText('Seleccioná un contrato.')).toBeInTheDocument();
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('contract select is disabled until a customer is chosen, then populates with labelled options', async () => {
    renderModal({});
    const contractSelect = screen.getByRole('combobox', { name: 'Contrato' }) as HTMLSelectElement;
    expect(contractSelect).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Seleccioná un cliente primero' })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('customer-picker-select'));
    await waitFor(() => expect(contractSelect).not.toBeDisabled());
    expect(screen.getByRole('option', { name: 'Plan 100MB - Calle 1 - FTTH' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Plan 50MB' })).toBeInTheDocument();
    fireEvent.change(contractSelect, { target: { value: 'contract-1' } });
    expect(contractSelect.value).toBe('contract-1');
  });

  // #49 — area is required
  it('shows area validation error when area is not selected', async () => {
    renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Test' } });
    fireEvent.input(screen.getByLabelText(/mensaje/i), { target: { value: 'Descripcion' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(screen.getByText(/area.*requerida/i)).toBeInTheDocument();
    });
  });

  // #49 — area select is populated from catalog (lesson #27: no hardcoded list)
  it('renders Area select populated from catalog (useTicketAreas)', () => {
    renderModal({});
    expect(screen.getByRole('combobox', { name: /area/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Facturacion' })).toBeInTheDocument();
  });

  it('shows loading state on submit button when loading=true', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('button', { name: /creando/i })).toBeInTheDocument();
  });

  it('disables inputs when loading=true', () => {
    renderModal({ loading: true });
    expect(screen.getByLabelText(/asunto/i)).toBeDisabled();
    expect(screen.getByLabelText(/mensaje/i)).toBeDisabled();
  });

  it('renders Asignado dropdown with RBAC users', () => {
    renderModal({});
    expect(screen.getByRole('combobox', { name: /asignado/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana García' })).toBeInTheDocument();
  });

  // #49 fix wave — the area catalog is async; surface loading/error so a slow or
  // failing catalog never leaves the user stuck on an empty required select.
  describe('area catalog states (#49 fix wave)', () => {
    it('shows a loading placeholder and disables the select while areas load', () => {
      vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
      renderModal({});
      const select = screen.getByRole('combobox', { name: /area/i });
      expect(select).toBeDisabled();
      expect(screen.getByRole('option', { name: /cargando areas/i })).toBeInTheDocument();
    });

    it('shows an error message + Reintentar that calls refetch when the catalog fails', () => {
      const refetch = vi.fn();
      vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch,
      } as unknown as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
      renderModal({});
      // No select rendered in the error state — the retry path replaces it.
      expect(screen.queryByRole('combobox', { name: /area/i })).not.toBeInTheDocument();
      expect(screen.getByText(/no se pudieron cargar las areas/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });
});
