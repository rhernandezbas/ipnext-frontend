import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientesOnlinePage from '@/pages/clientes/ClientesOnlinePage';
import * as useClientsModule from '@/hooks/useClients';

vi.mock('@/hooks/useClients');

const mockSessions: useClientsModule.OnlineSession[] = [
  { id: 1, clientId: 1, clientName: 'Alice García', ip: '192.168.1.101', mac: 'AA:BB:CC:DD:EE:01', connectedSince: '2026-04-28T08:00:00Z', downloadMbps: 12.4, uploadMbps: 2.1 },
  { id: 2, clientId: 2, clientName: 'Carlos López', ip: '192.168.1.102', mac: 'AA:BB:CC:DD:EE:02', connectedSince: '2026-04-28T09:30:00Z', downloadMbps: 5.2, uploadMbps: 0.8 },
  { id: 3, clientId: 3, clientName: 'María Rodríguez', ip: '192.168.1.103', mac: 'AA:BB:CC:DD:EE:03', connectedSince: '2026-04-28T07:15:00Z', downloadMbps: 38.7, uploadMbps: 4.3 },
];

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('ClientesOnlinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useClientsModule.useOnlineSessions).mockReturnValue({
      data: mockSessions,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useOnlineSessions>);

    vi.mocked(useClientsModule.useDisconnectSession).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useDisconnectSession>);
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <ClientesOnlinePage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it('renders "Clientes Online" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Clientes Online' })).toBeInTheDocument();
  });

  it('renders summary cards with Total online, Descargando, Tráfico total', () => {
    renderPage();
    expect(screen.getByText('Total online')).toBeInTheDocument();
    expect(screen.getByText('Descargando')).toBeInTheDocument();
    expect(screen.getByText('Tráfico total')).toBeInTheDocument();
  });

  it('renders table with session columns IP, MAC', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: 'IP' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'MAC' })).toBeInTheDocument();
  });

  it('renders table with Cliente and Conectado desde columns', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: 'Cliente' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Conectado desde' })).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useClientsModule.useOnlineSessions).mockReturnValue({
      data: [],
      isLoading: true,
    } as ReturnType<typeof useClientsModule.useOnlineSessions>);
    renderPage();
    expect(screen.getByText('Cargando sesiones...')).toBeInTheDocument();
  });

  it('search input filters results by client name', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByPlaceholderText(/buscar/i);
    // verify we start with data rows
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);

    await user.type(input, 'zzznomatch');
    // After filtering, no data rows — empty message row appears
    expect(screen.getByText('No hay clientes online.')).toBeInTheDocument();
  });

  it('search input filters results by IP', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByPlaceholderText(/buscar/i);
    await user.type(input, '192.168.1.1');
    const dataRows = screen.getAllByRole('row');
    // at least header + 1 matched row
    expect(dataRows.length).toBeGreaterThanOrEqual(2);
  });

  it('"Desconectar" button is present in each row', () => {
    renderPage();
    const buttons = screen.getAllByRole('button', { name: 'Desconectar' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls disconnect.mutate with session id when Desconectar is clicked', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    vi.mocked(useClientsModule.useDisconnectSession).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useDisconnectSession>);

    renderPage();
    const buttons = screen.getAllByRole('button', { name: 'Desconectar' });
    await user.click(buttons[0]);
    expect(mockMutate).toHaveBeenCalledWith(mockSessions[0].id);
  });
});
