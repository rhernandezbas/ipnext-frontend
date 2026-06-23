import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RadiusLogsPage from '@/pages/radius/RadiusLogsPage';
import * as useRadiusEventsModule from '@/hooks/useRadiusEvents';
import type { PaginatedRadiusEvents } from '@/types/networkAudit';

vi.mock('@/hooks/useRadiusEvents');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const MOCK_DATA: PaginatedRadiusEvents = {
  data: [
    {
      id: 'evt-1',
      username: 'user1@isp.com',
      nasId: 'nas-1',
      nasIpAddress: '192.168.1.1',
      nasName: 'NAS-Central',
      framedIp: '10.0.0.1',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      vlanId: 100,
      startedAt: '2026-06-22T10:00:00Z',
      stoppedAt: null,
      sessionTimeSeconds: null,
      inOctets: '1048576',
      outOctets: '524288',
      eventType: 'start',
      status: 'online',
      online: true,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasNext: false,
};

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <RadiusLogsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RadiusLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Logs RADIUS" heading', () => {
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);

    renderPage();
    expect(screen.getByText('Logs RADIUS')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);

    renderPage();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('renders username in table when data is present', () => {
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);

    renderPage();
    expect(screen.getByText('user1@isp.com')).toBeInTheDocument();
  });

  it('shows empty state when data is empty', () => {
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: { ...MOCK_DATA, data: [], total: 0 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);

    renderPage();
    expect(screen.getByText('No hay eventos RADIUS')).toBeInTheDocument();
  });

  it('shows error state when request fails', () => {
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);

    renderPage();
    expect(screen.getByText('Error al cargar los eventos')).toBeInTheDocument();
  });

  it('does NOT render any "Desconectar" mutation buttons', () => {
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);

    renderPage();
    expect(screen.queryByRole('button', { name: /desconectar/i })).not.toBeInTheDocument();
  });

  it('renders filter controls: username input, eventType select, and Limpiar button', () => {
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);

    renderPage();
    expect(screen.getByRole('textbox', { name: /filtrar por username/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filtrar por tipo de evento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });
});
