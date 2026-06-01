import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContractsTab } from '@/pages/customers/tabs/ContractsTab';
import * as useClientsModule from '@/hooks/useCustomers';
import type { Contract } from '@/types/customer';

vi.mock('@/hooks/useCustomers');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTab(clientId = '1') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ContractsTab clientId={clientId} active={true} />
    </QueryClientProvider>
  );
}

const mockContracts: Contract[] = [
  {
    id: 101,
    type: 'internet',
    plan: 'Plan 50Mbps',
    status: 'active',
    price: 3000,
    startDate: '2024-01-01',
    endDate: null,
    ipAddress: '192.168.1.100',
    description: 'Internet residencial',
  },
  {
    id: 102,
    type: 'tv',
    plan: 'Plan HD',
    status: 'active',
    price: 1500,
    startDate: '2024-01-01',
    endDate: null,
    ipAddress: null,
    description: 'Televisión digital',
  },
];

const mockMutate = vi.fn();

describe('ContractsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useClientsModule.useAddContract).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useAddContract>);

    vi.mocked(useClientsModule.useUpdateContract).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useUpdateContract>);

    vi.mocked(useClientsModule.useDeleteContract).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useDeleteContract>);
  });

  it('renders contracts table with mock data', () => {
    vi.mocked(useClientsModule.useClientContracts).mockReturnValue({
      data: mockContracts,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientContracts>);

    renderTab();

    expect(screen.getByText('Plan 50Mbps')).toBeInTheDocument();
    expect(screen.getByText('Plan HD')).toBeInTheDocument();
    expect(screen.getByText('internet')).toBeInTheDocument();
    expect(screen.getByText('tv')).toBeInTheDocument();
  });

  it('"Agregar contrato" button is present', () => {
    vi.mocked(useClientsModule.useClientContracts).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientContracts>);

    renderTab();
    expect(screen.getByRole('button', { name: 'Agregar contrato' })).toBeInTheDocument();
  });

  it('clicking "Agregar contrato" shows the add form', async () => {
    vi.mocked(useClientsModule.useClientContracts).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientContracts>);

    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Agregar contrato' }));

    expect(screen.getByText('Agregar contrato', { selector: 'h3' })).toBeInTheDocument();
  });

  it('"Eliminar" button is present per row', () => {
    vi.mocked(useClientsModule.useClientContracts).mockReturnValue({
      data: mockContracts,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientContracts>);

    renderTab();

    const deleteButtons = screen.getAllByRole('button', { name: 'Eliminar' });
    expect(deleteButtons).toHaveLength(mockContracts.length);
  });

  it('form fields for Tipo and Plan are visible after clicking add', async () => {
    vi.mocked(useClientsModule.useClientContracts).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientContracts>);

    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Agregar contrato' }));

    expect(screen.getByRole('combobox', { name: /tipo/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /plan/i })).toBeInTheDocument();
  });
});
