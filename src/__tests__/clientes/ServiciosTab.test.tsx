import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ServiciosTab } from '@/pages/clientes/tabs/ServiciosTab';
import * as useClientsModule from '@/hooks/useClients';
import type { Service } from '@/types/customer';

vi.mock('@/hooks/useClients');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTab(clientId = '1') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ServiciosTab clientId={clientId} active={true} />
    </QueryClientProvider>
  );
}

const mockServices: Service[] = [
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

describe('ServiciosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useClientsModule.useAddService).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useAddService>);

    vi.mocked(useClientsModule.useUpdateService).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useUpdateService>);

    vi.mocked(useClientsModule.useDeleteService).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useDeleteService>);
  });

  it('renders services table with mock data', () => {
    vi.mocked(useClientsModule.useClientServices).mockReturnValue({
      data: mockServices,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientServices>);

    renderTab();

    expect(screen.getByText('Plan 50Mbps')).toBeInTheDocument();
    expect(screen.getByText('Plan HD')).toBeInTheDocument();
    expect(screen.getByText('internet')).toBeInTheDocument();
    expect(screen.getByText('tv')).toBeInTheDocument();
  });

  it('"Agregar servicio" button is present', () => {
    vi.mocked(useClientsModule.useClientServices).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientServices>);

    renderTab();
    expect(screen.getByRole('button', { name: 'Agregar servicio' })).toBeInTheDocument();
  });

  it('clicking "Agregar servicio" shows the add form', async () => {
    vi.mocked(useClientsModule.useClientServices).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientServices>);

    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));

    expect(screen.getByText('Agregar servicio', { selector: 'h3' })).toBeInTheDocument();
  });

  it('"Eliminar" button is present per row', () => {
    vi.mocked(useClientsModule.useClientServices).mockReturnValue({
      data: mockServices,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientServices>);

    renderTab();

    const deleteButtons = screen.getAllByRole('button', { name: 'Eliminar' });
    expect(deleteButtons).toHaveLength(mockServices.length);
  });

  it('form fields for Tipo and Plan are visible after clicking add', async () => {
    vi.mocked(useClientsModule.useClientServices).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientServices>);

    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Agregar servicio' }));

    expect(screen.getByRole('combobox', { name: /tipo/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /plan/i })).toBeInTheDocument();
  });
});
