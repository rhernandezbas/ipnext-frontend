import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RadiusSessionsPage from '@/pages/radius/RadiusSessionsPage';
import * as useRadiusModule from '@/hooks/useRadiusSessions';
import type { RadiusSession } from '@/types/radiusSessions';

vi.mock('@/hooks/useRadiusSessions');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockSessions: RadiusSession[] = [
  {
    id: 'session-1',
    sessionId: 'ACCT0000000001',
    clientId: 'client-1',
    clientName: 'Cliente 1',
    nasId: 'nas-1',
    nasName: 'NAS Central',
    ipAddress: '10.0.1.101',
    macAddress: 'AA:BB:CC:DD:01:FF',
    startedAt: '2026-04-28T05:00:00Z',
    duration: 7200,
    downloadBytes: 104857600,
    uploadBytes: 10485760,
    downloadMbps: 12.5,
    uploadMbps: 2.3,
    status: 'active',
    username: 'user1@ipnext.com.ar',
  },
  {
    id: 'session-2',
    sessionId: 'ACCT0000000002',
    clientId: 'client-2',
    clientName: 'Cliente 2',
    nasId: 'nas-2',
    nasName: 'NAS Norte',
    ipAddress: '10.0.2.102',
    macAddress: 'AA:BB:CC:DD:02:FF',
    startedAt: '2026-04-28T04:00:00Z',
    duration: 10800,
    downloadBytes: 52428800,
    uploadBytes: 5242880,
    downloadMbps: 0,
    uploadMbps: 0,
    status: 'idle',
    username: 'user2@ipnext.com.ar',
  },
];

const mockRefetch = vi.fn();
const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <RadiusSessionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RadiusSessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useRadiusModule.useRadiusSessions).mockReturnValue({
      data: mockSessions,
      isLoading: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useRadiusModule.useRadiusSessions>);

    vi.mocked(useRadiusModule.useDisconnectSession).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useRadiusModule.useDisconnectSession>);
  });

  it('renders "Sesiones RADIUS" heading', () => {
    renderPage();
    expect(screen.getByText('Sesiones RADIUS activas')).toBeInTheDocument();
  });

  it('summary cards render', () => {
    renderPage();
    expect(screen.getByText('Total sesiones')).toBeInTheDocument();
    expect(screen.getByText('Sesiones idle')).toBeInTheDocument();
    expect(screen.getByText('Descarga total (Mbps)')).toBeInTheDocument();
  });

  it('table shows session data (username, IP)', () => {
    renderPage();
    expect(screen.getByText('user1@ipnext.com.ar')).toBeInTheDocument();
    expect(screen.getByText('10.0.1.101')).toBeInTheDocument();
  });

  it('"Actualizar" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
  });

  it('NAS filter exists', () => {
    renderPage();
    expect(screen.getByLabelText('Filtrar por NAS')).toBeInTheDocument();
  });

  it('each row has "Desconectar" action', () => {
    renderPage();
    const disconnectButtons = screen.getAllByRole('button', { name: 'Desconectar' });
    expect(disconnectButtons.length).toBe(2);
  });
});
