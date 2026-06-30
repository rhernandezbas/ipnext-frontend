import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as GestionRedPage } from '@/pages/networking/GestionRedPage';
import * as useNasModule from '@/hooks/useNas';
import * as useNetworkModule from '@/hooks/useNetwork';
import * as useRadiusSessionsModule from '@/hooks/useRadiusSessions';
import type { NasServer } from '@/types/nas';
import type { IpNetwork, IpPool, IpAssignment, Ipv6Network, PaginatedAssignments } from '@/types/network';
import type { RadiusSession } from '@/types/radiusSessions';

vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useNetwork');
vi.mock('@/hooks/useRadiusSessions');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockNasServers: NasServer[] = [
  {
    id: '1',
    name: 'MikroTik central',
    type: 'mikrotik_api',
    ipAddress: '192.168.1.1',
    radiusSecret: '••••••••',
    nasIpAddress: '192.168.1.1',
    apiPort: 8728,
    apiLogin: 'admin',
    apiPassword: '••••••••',
    status: 'active',
    lastSeen: '2026-04-28T08:00:00Z',
    clientCount: 234,
    description: 'Router central',
  },
  {
    id: '2',
    name: 'Ubiquiti zona norte',
    type: 'ubiquiti',
    ipAddress: '192.168.2.1',
    radiusSecret: '••••••••',
    nasIpAddress: '192.168.2.1',
    apiPort: null,
    apiLogin: null,
    apiPassword: null,
    status: 'inactive',
    lastSeen: null,
    clientCount: 89,
    description: 'Ubiquiti zona norte',
  },
];

const mockNetworks: IpNetwork[] = [
  {
    id: '1',
    network: '192.168.1.0/24',
    gateway: '192.168.1.1',
    dns1: '8.8.8.8',
    dns2: '8.8.4.4',
    description: 'Red clientes',
    partnerId: null,
    type: 'dhcp',
    totalIps: 254,
    usedIps: 50,
    freeIps: 204,
  },
];

const mockPools: IpPool[] = [
  {
    id: '1',
    name: 'residencial-dinamico',
    networkId: '1',
    rangeStart: '192.168.1.10',
    rangeEnd: '192.168.1.200',
    type: 'dynamic',
    assignedCount: 50,
    totalCount: 191,
    nasId: '1',
  },
];

// Paginated shape — new contract
const mockPaginatedEmpty: PaginatedAssignments = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 25,
};

const mockAssignmentsWithData: IpAssignment[] = [
  {
    id: 'asgn-1',
    ip: '100.64.10.1',
    username: 'juan.perez',
    contractId: 'contract-abc',
    profile: '20M',
    nasId: 'nas-1',
    status: 'enabled',
    createdAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'asgn-2',
    ip: '100.64.10.2',
    username: 'maria.gomez',
    contractId: 'contract-xyz',
    profile: null,
    nasId: 'nas-1',
    status: 'disabled',
    createdAt: '2026-06-02T00:00:00Z',
  },
];

const mockPaginatedWithData: PaginatedAssignments = {
  data: mockAssignmentsWithData,
  total: 2,
  page: 1,
  pageSize: 25,
};

const mockIpv6Networks: Ipv6Network[] = [
  {
    id: '1',
    network: '2001:db8::/32',
    description: 'Bloque IPv6 principal',
    delegationPrefix: 48,
    type: 'static',
    usedPrefixes: 12,
    totalPrefixes: 65536,
    status: 'active',
  },
];

// ── RADIUS sessions (tab "Sesiones activas") ─────────────────────────────────
function mockRadiusSessions(sessions: RadiusSession[]) {
  vi.mocked(useRadiusSessionsModule.useRadiusSessions).mockReturnValue({
    data: sessions,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRadiusSessionsModule.useRadiusSessions>);
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <GestionRedPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GestionRedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNasModule.useNasServers).mockReturnValue({
      data: mockNasServers,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNasModule.useNasServers>);

    vi.mocked(useNasModule.useCreateNasServer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useCreateNasServer>);

    vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useUpdateNasServer>);

    vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useDeleteNasServer>);

    vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue({
      data: mockNetworks,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpNetworks>);

    vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpNetwork>);

    vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpNetwork>);

    vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpPool>);

    vi.mocked(useNetworkModule.useIpPools).mockReturnValue({
      data: mockPools,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpPools>);

    vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpPool>);

    // Now returns PaginatedAssignments (new shape)
    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedEmpty,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue({
      data: mockIpv6Networks,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpv6Networks>);

    vi.mocked(useNetworkModule.useCreateIpv6Network).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpv6Network>);

    mockRadiusSessions([]);
  });

  it('renders "Gestión de red" heading', () => {
    renderPage();
    expect(screen.getByText(/gestión de red/i)).toBeInTheDocument();
  });

  it('renders "Dispositivos NAS" tab', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /dispositivos nas/i })).toBeInTheDocument();
  });

  it('renders "Redes IP" tab', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /redes ip/i })).toBeInTheDocument();
  });

  it('renders "Pools IP" tab', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /pools ip/i })).toBeInTheDocument();
  });

  it('NAS table shows device names from mock', () => {
    renderPage();
    expect(screen.getByText('MikroTik central')).toBeInTheDocument();
    expect(screen.getByText('Ubiquiti zona norte')).toBeInTheDocument();
  });

  it('"Agregar NAS" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /agregar nas/i })).toBeInTheDocument();
  });

  it('summary cards show counts', () => {
    renderPage();
    expect(screen.getByText('Total NAS')).toBeInTheDocument();
    expect(screen.getByText('Activos')).toBeInTheDocument();
    expect(screen.getByText('Inactivos')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    // 2 NAS servers total — count now appears in both the KPI value and the
    // tab badge (prototype redesign), so assert it's rendered at least once.
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('switching to "Redes IP" tab shows network table', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /redes ip/i }));

    expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
  });

  it('"IPv6" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /ipv6/i })).toBeInTheDocument();
  });

  it('switching to IPv6 tab shows network table', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /ipv6/i }));

    expect(screen.getByText('2001:db8::/32')).toBeInTheDocument();
  });
});

// ── Asignaciones tab — server-side paginated shape ───────────────────────────
describe('Asignaciones tab — server-side paginated shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNasModule.useNasServers).mockReturnValue({
      data: mockNasServers,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNasModule.useNasServers>);

    vi.mocked(useNasModule.useCreateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useCreateNasServer>);
    vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useUpdateNasServer>);
    vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useDeleteNasServer>);

    vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue({
      data: mockNetworks, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpNetworks>);
    vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpNetwork>);
    vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpNetwork>);
    vi.mocked(useNetworkModule.useIpPools).mockReturnValue({
      data: mockPools, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpPools>);
    vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpPool>);
    vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpPool>);
    vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue({
      data: mockIpv6Networks, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpv6Networks>);
    vi.mocked(useNetworkModule.useCreateIpv6Network).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpv6Network>);

    mockRadiusSessions([]);
  });

  it('shows IP and username from paginated data, does NOT show "No se encontraron asignaciones"', async () => {
    const user = userEvent.setup();

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedWithData,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    expect(screen.getByText('100.64.10.1')).toBeInTheDocument();
    expect(screen.getByText('juan.perez')).toBeInTheDocument();
    expect(screen.queryByText('No se encontraron asignaciones.')).not.toBeInTheDocument();
  });

  it('shows profile when present and "—" when null', async () => {
    const user = userEvent.setup();

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedWithData,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    expect(screen.getByText('20M')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows "No se encontraron asignaciones." when paginated data is empty', async () => {
    const user = userEvent.setup();

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedEmpty,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    expect(screen.getByText('No se encontraron asignaciones.')).toBeInTheDocument();
  });

  it('shows skeleton row while isFetching', async () => {
    const user = userEvent.setup();

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    // skeleton rows must exist (aria-busy on the wrapper or skeleton cells)
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state with "Reintentar" button on isError', async () => {
    const user = userEvent.setup();
    const mockRefetch = vi.fn();

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/no se pudo cargar/i);

    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    await user.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('clicking next page triggers useIpAssignments with page=2', async () => {
    // We need enough total to show pagination (totalPages > 1)
    const page1: PaginatedAssignments = {
      data: mockAssignmentsWithData,
      total: 30, // 30 > pageSize=25, so totalPages=2
      page: 1,
      pageSize: 25,
    };

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: page1,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    // Click next page (›)
    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    // After clicking next, useIpAssignments should have been called with page=2
    // The mock will be called again by React re-render; we check the LAST call args
    await waitFor(() => {
      const calls = vi.mocked(useNetworkModule.useIpAssignments).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toMatchObject({ page: 2 });
    });
  });

  it('selecting a router filter calls useIpAssignments with nasId', async () => {
    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedWithData,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    // Select the first NAS (id='1')
    const routerSelect = screen.getByRole('combobox', { name: /router/i });
    await user.selectOptions(routerSelect, '1');

    await waitFor(() => {
      const calls = vi.mocked(useNetworkModule.useIpAssignments).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toMatchObject({ nasId: '1', page: 1 });
    });
  });

  it('uses total from server for the counter', async () => {
    const user = userEvent.setup();

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: { data: mockAssignmentsWithData, total: 999, page: 1, pageSize: 25 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);

    renderPage();
    await user.click(screen.getByRole('button', { name: /asignaciones/i }));

    expect(screen.getByText(/999 asignaciones/i)).toBeInTheDocument();
  });
});

// ── NasTypeBadge — displayType override logic ────────────────────────────────
describe('NasTypeBadge — displayType override', () => {
  // Helper: wirear todos los hooks necesarios con defaults vacíos
  function setupHooks(overrideNasServers: NasServer[]) {
    vi.mocked(useNasModule.useNasServers).mockReturnValue({
      data: overrideNasServers,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNasModule.useNasServers>);

    vi.mocked(useNasModule.useCreateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useCreateNasServer>);
    vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useUpdateNasServer>);
    vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useDeleteNasServer>);

    vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue({
      data: [], isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpNetworks>);
    vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpNetwork>);
    vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpNetwork>);
    vi.mocked(useNetworkModule.useIpPools).mockReturnValue({
      data: [], isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpPools>);
    vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpPool>);
    vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpPool>);
    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedEmpty,
      isLoading: false, isFetching: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);
    vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue({
      data: [], isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpv6Networks>);
    vi.mocked(useNetworkModule.useCreateIpv6Network).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpv6Network>);

    mockRadiusSessions([]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra displayType cuando es un override real (distinto del type crudo)', () => {
    // BE manda "BRAS RADIUS" para radius_orchestrator → override real
    const nasConOverride: NasServer = {
      id: 'bras-1',
      name: 'NE8000 BRAS Sur',
      type: 'radius_orchestrator',
      displayType: 'BRAS RADIUS',
      ipAddress: '10.0.0.1',
      radiusSecret: 'secret',
      nasIpAddress: '10.0.0.1',
      apiPort: null,
      apiLogin: null,
      apiPassword: null,
      status: 'active',
      lastSeen: null,
      clientCount: 0,
      description: '',
    };

    setupHooks([nasConOverride]);
    renderPage();

    // El badge debe mostrar el override "BRAS RADIUS"
    expect(screen.getByText('BRAS RADIUS')).toBeInTheDocument();
    // No debe mostrar el label lindo del type (MikroTik RADIUS)
    expect(screen.queryByText('MikroTik RADIUS')).not.toBeInTheDocument();
  });

  it('muestra el label lindo cuando displayType === type crudo (el BE no hizo override)', () => {
    // BE manda "mikrotik_api" como displayType (sin override), el FE debe mostrar "MikroTik API"
    const nasConCrudo: NasServer = {
      id: 'mk-1',
      name: 'MikroTik API router',
      type: 'mikrotik_api',
      displayType: 'mikrotik_api', // BE envía el type crudo → no es override
      ipAddress: '10.0.1.1',
      radiusSecret: 'secret',
      nasIpAddress: '10.0.1.1',
      apiPort: 8728,
      apiLogin: 'admin',
      apiPassword: null,
      status: 'active',
      lastSeen: null,
      clientCount: 0,
      description: '',
    };

    setupHooks([nasConCrudo]);
    renderPage();

    // Debe mostrar el label lindo del mapa NAS_TYPE_LABELS
    expect(screen.getByText('MikroTik API')).toBeInTheDocument();
    // No debe mostrar el string crudo
    expect(screen.queryByText('mikrotik_api')).not.toBeInTheDocument();
  });
});

// ── Sesiones activas tab — 6º tab (RADIUS live sessions) ─────────────────────
describe('GestionRedPage — tab "Sesiones activas"', () => {
  // Wire every non-session hook with safe defaults so only sessions vary.
  function setupBaseHooks() {
    vi.mocked(useNasModule.useNasServers).mockReturnValue({
      data: mockNasServers, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNasModule.useNasServers>);
    vi.mocked(useNasModule.useCreateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useCreateNasServer>);
    vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useUpdateNasServer>);
    vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useDeleteNasServer>);
    vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue({
      data: mockNetworks, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpNetworks>);
    vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpNetwork>);
    vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpNetwork>);
    vi.mocked(useNetworkModule.useIpPools).mockReturnValue({
      data: mockPools, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpPools>);
    vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpPool>);
    vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpPool>);
    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedEmpty, isLoading: false, isFetching: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);
    vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue({
      data: mockIpv6Networks, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpv6Networks>);
    vi.mocked(useNetworkModule.useCreateIpv6Network).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpv6Network>);
  }

  const baseSession: RadiusSession = {
    id: 's-1',
    sessionId: 'sess-1',
    contractId: 'contract-1',
    clientId: 'client-1',
    customerName: 'Juan Pérez',
    clientName: 'Juan Pérez (legacy)',
    nasId: 'nas-1',
    nasName: 'NE8000 Sur',
    ipAddress: '100.64.0.10',
    macAddress: 'AA:BB:CC:DD:EE:01',
    startedAt: '2026-06-22T10:00:00Z',
    duration: 3600,
    downloadBytes: 1000,
    uploadBytes: 500,
    downloadMbps: 25.4,
    uploadMbps: 5.1,
    status: 'active',
    username: 'juan.perez@isp',
  };

  // Same NAS as base — grouping must collapse both under "NE8000 Sur".
  const sameNasSession: RadiusSession = {
    ...baseSession,
    id: 's-2',
    sessionId: 'sess-2',
    contractId: null, // ← orphan: warning must appear ONLY here
    clientId: null,
    customerName: null,
    clientName: 'Sin nombre',
    ipAddress: '100.64.0.11',
    macAddress: 'AA:BB:CC:DD:EE:02',
    downloadMbps: 10.0,
    uploadMbps: 2.0,
    status: 'idle',
    username: 'orphan@isp',
  };

  // Different NAS — must create a second group header.
  const otherNasSession: RadiusSession = {
    ...baseSession,
    id: 's-3',
    sessionId: 'sess-3',
    nasId: 'nas-2',
    nasName: 'MikroTik RDA1',
    contractId: 'contract-3',
    clientId: 'client-3',
    customerName: 'María Gómez',
    ipAddress: '100.64.1.10',
    macAddress: 'AA:BB:CC:DD:EE:03',
    username: 'maria.gomez@isp',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupBaseHooks();
  });

  async function openSesiones() {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /sesiones activas/i }));
    return user;
  }

  it('renders the "Sesiones activas" tab button', () => {
    mockRadiusSessions([]);
    renderPage();
    expect(screen.getByRole('button', { name: /sesiones activas/i })).toBeInTheDocument();
  });

  it('groups sessions by nasName (one group header per NAS)', async () => {
    mockRadiusSessions([baseSession, sameNasSession, otherNasSession]);
    await openSesiones();

    // Two distinct NAS → two group headers.
    expect(screen.getByText('NE8000 Sur')).toBeInTheDocument();
    expect(screen.getByText('MikroTik RDA1')).toBeInTheDocument();
  });

  it('round-trips session data (customerName, username, IP, MAC, mbps)', async () => {
    mockRadiusSessions([baseSession]);
    await openSesiones();

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('juan.perez@isp')).toBeInTheDocument();
    expect(screen.getByText('100.64.0.10')).toBeInTheDocument();
    expect(screen.getByText('AA:BB:CC:DD:EE:01')).toBeInTheDocument();
    expect(screen.getByText('25.4')).toBeInTheDocument();
    expect(screen.getByText('5.1')).toBeInTheDocument();
  });

  it('shows the "sin contrato" warning ONLY on the row with contractId=null', async () => {
    mockRadiusSessions([baseSession, sameNasSession]);
    await openSesiones();

    const warnings = screen.getAllByLabelText(/sin contrato asociado/i);
    // Exactly one orphan row → exactly one warning indicator.
    expect(warnings).toHaveLength(1);
  });

  it('links to the customer when clientId is present', async () => {
    mockRadiusSessions([baseSession]);
    await openSesiones();

    const link = screen.getByRole('link', { name: /juan pérez/i });
    expect(link).toHaveAttribute('href', '/admin/customers/view/client-1');
  });

  it('does NOT render a customer link when clientId is null', async () => {
    mockRadiusSessions([sameNasSession]);
    await openSesiones();

    // Orphan row has no clientId → plain text, no link.
    expect(screen.queryByRole('link', { name: /sin nombre/i })).not.toBeInTheDocument();
  });

  it('shows empty state when there are no sessions', async () => {
    mockRadiusSessions([]);
    await openSesiones();
    expect(screen.getByText('No hay sesiones activas.')).toBeInTheDocument();
  });

  it('shows loading skeleton (role="status") while isLoading', async () => {
    vi.mocked(useRadiusSessionsModule.useRadiusSessions).mockReturnValue({
      data: undefined, isLoading: true, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRadiusSessionsModule.useRadiusSessions>);
    await openSesiones();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error panel with "Reintentar" that calls refetch', async () => {
    const refetch = vi.fn();
    vi.mocked(useRadiusSessionsModule.useRadiusSessions).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch,
    } as unknown as ReturnType<typeof useRadiusSessionsModule.useRadiusSessions>);
    const user = await openSesiones();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/no se pudo cargar/i);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

// ── Contadores honestos: null = "no disponible", NUNCA 0 ─────────────────────
// El BE pasó assignedCount / usedIps / freeIps a `number | null`. null = el
// RADIUS/router no respondió tras reintentos. El FE NO debe pintar eso como 0
// (un pool no-disponible no es un pool vacío) → se muestra "—" (em dash) muted.
describe('GestionRedPage — contadores honestos (null = no disponible)', () => {
  function setupHooks({ networks, pools }: { networks: IpNetwork[]; pools: IpPool[] }) {
    vi.mocked(useNasModule.useNasServers).mockReturnValue({
      data: mockNasServers, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNasModule.useNasServers>);
    vi.mocked(useNasModule.useCreateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useCreateNasServer>);
    vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useUpdateNasServer>);
    vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useDeleteNasServer>);

    vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue({
      data: networks, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpNetworks>);
    vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpNetwork>);
    vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpNetwork>);
    vi.mocked(useNetworkModule.useIpPools).mockReturnValue({
      data: pools, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpPools>);
    vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpPool>);
    vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useDeleteIpPool>);
    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockPaginatedEmpty, isLoading: false, isFetching: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpAssignments>);
    vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue({
      data: mockIpv6Networks, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as ReturnType<typeof useNetworkModule.useIpv6Networks>);
    vi.mocked(useNetworkModule.useCreateIpv6Network).mockReturnValue({
      mutate: vi.fn(), isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpv6Network>);

    mockRadiusSessions([]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('red con usedIps=null muestra "—", NO "null" ni un número', async () => {
    const user = userEvent.setup();
    setupHooks({
      networks: [{ ...mockNetworks[0], usedIps: null, freeIps: null, totalIps: 254 }],
      pools: mockPools,
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: /redes ip/i }));

    const row = screen.getByText('192.168.1.0/24').closest('tr')!;
    expect(row).toHaveTextContent('— / 254');
    expect(row).not.toHaveTextContent('null');
    expect(row).not.toHaveTextContent('0 / 254');
    // a11y: el "—" de no-disponible se anuncia como "Sin dato" (no "raya")
    expect(within(row).getByLabelText('Sin dato')).toBeInTheDocument();
  });

  it('red con usedIps numérico sigue mostrando el número (camino feliz)', async () => {
    const user = userEvent.setup();
    setupHooks({ networks: mockNetworks, pools: mockPools });
    renderPage();
    await user.click(screen.getByRole('button', { name: /redes ip/i }));

    const row = screen.getByText('192.168.1.0/24').closest('tr')!;
    expect(row).toHaveTextContent('50 / 254');
  });

  it('pool con assignedCount=null: celda "—", barra "—" (NO 0%) y sin marca roja', async () => {
    const user = userEvent.setup();
    setupHooks({
      networks: mockNetworks,
      pools: [{ ...mockPools[0], assignedCount: null, totalCount: 191 }],
    });
    const { container } = renderPage();
    await user.click(screen.getByRole('button', { name: /pools ip/i }));

    const row = screen.getByText('residencial-dinamico').closest('tr')!;
    // Celda Asignadas/Total: "— / 191"
    expect(row).toHaveTextContent('— / 191');
    // La barra NO debe pintar 0% (un pool sin dato no es un pool vacío)
    expect(row).not.toHaveTextContent('0%');
    expect(row).not.toHaveTextContent('null');
    // Sin marca roja en ningún lado de la tabla de pools
    expect(container.querySelector('.redStrong')).toBeNull();
    // a11y: los dos "—" de la fila (celda contador + barra) se anuncian "Sin dato"
    expect(within(row).getAllByLabelText('Sin dato')).toHaveLength(2);
  });

  it('pool con assignedCount=undefined: la barra NO produce NaN, muestra "—"', async () => {
    const user = userEvent.setup();
    setupHooks({
      networks: mockNetworks,
      // El BE no debería mandar undefined, pero si un campo falta el FE NO debe
      // caer en NaN%. `== null` (loose) cubre null Y undefined.
      pools: [{ ...mockPools[0], assignedCount: undefined as unknown as null, totalCount: 191 }],
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: /pools ip/i }));

    const row = screen.getByText('residencial-dinamico').closest('tr')!;
    expect(row).not.toHaveTextContent('NaN');
    expect(within(row).getAllByLabelText('Sin dato').length).toBeGreaterThanOrEqual(1);
  });

  it('pool con assignedCount numérico mantiene número y barra de % (camino feliz)', async () => {
    const user = userEvent.setup();
    setupHooks({
      networks: mockNetworks,
      pools: [{ ...mockPools[0], assignedCount: 50, totalCount: 191 }],
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: /pools ip/i }));

    const row = screen.getByText('residencial-dinamico').closest('tr')!;
    expect(row).toHaveTextContent('50 / 191');
    expect(row).toHaveTextContent('26%'); // round(50/191*100)
  });

  it('KPIs: con ≥1 pool sin dato agrega SOLO sobre los pools con dato e indica datos parciales (sin NaN)', () => {
    setupHooks({
      networks: mockNetworks,
      pools: [
        { ...mockPools[0], id: 'p-ok', name: 'pool-ok', assignedCount: 50, totalCount: 100 },
        { ...mockPools[0], id: 'p-nd', name: 'pool-sin-dato', assignedCount: null, totalCount: 200 },
      ],
    });
    const { container } = renderPage();

    // Nunca NaN
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();

    const subs = [...container.querySelectorAll('.kpiSub')] as HTMLElement[];
    const occSub = subs.find(el => el.textContent?.includes('ocupación de pools'))!;
    const freeSub = subs.find(el => el.textContent?.includes('IPs libres'))!;

    // % de ocupación HONESTO: 50/100 = 50% (NO 17% que saldría sumando el null como 0)
    expect(occSub).toHaveTextContent('50%');
    expect(occSub).not.toHaveTextContent('17%');
    // IPs libres HONESTO: 100-50 = 50 (NO 250, que saldría incluyendo el pool sin dato)
    expect(freeSub).not.toHaveTextContent('250');
    // Indicador discreto de datos parciales en ambos KPIs afectados
    expect(occSub).toHaveTextContent('sin dato');
    expect(freeSub).toHaveTextContent('sin dato');
  });

  it('KPIs: con TODOS los pools sin dato muestra "—" (NO "0%"/"0") + datos parciales, sin NaN', () => {
    // Outage total del RADIUS: poolsWithData queda vacío. El agregado NO puede
    // mentir con "0% / 0 IPs libres" — tiene que espejar el "—" de las filas.
    setupHooks({
      networks: mockNetworks,
      pools: [{ ...mockPools[0], assignedCount: null, totalCount: 200 }],
    });
    const { container } = renderPage();

    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    const subs = [...container.querySelectorAll('.kpiSub')] as HTMLElement[];
    const occSub = subs.find(el => el.textContent?.includes('ocupación de pools'))!;
    const freeSub = subs.find(el => el.textContent?.includes('IPs libres'))!;

    // El 0 engañoso NO debe aparecer en ninguno de los dos KPIs
    expect(occSub).not.toHaveTextContent('0%');
    expect(freeSub).not.toHaveTextContent('0 IPs libres');
    // En su lugar, "—" anunciado como "Sin dato" (a11y) en ambos
    expect(within(occSub).getByLabelText('Sin dato')).toBeInTheDocument();
    expect(within(freeSub).getByLabelText('Sin dato')).toBeInTheDocument();
    // Y sigue indicando cuántos pools faltan
    expect(occSub).toHaveTextContent('sin dato');
    expect(freeSub).toHaveTextContent('sin dato');
  });

  it('KPIs: sin pools sin dato NO muestra el indicador "sin dato" (camino feliz)', () => {
    setupHooks({
      networks: mockNetworks,
      pools: [{ ...mockPools[0], assignedCount: 50, totalCount: 100 }],
    });
    const { container } = renderPage();
    const subs = [...container.querySelectorAll('.kpiSub')] as HTMLElement[];
    const occSub = subs.find(el => el.textContent?.includes('ocupación de pools'))!;
    expect(occSub).toHaveTextContent('50%');
    expect(occSub).not.toHaveTextContent('sin dato');
  });
});

// ── F6: badge "0" del tab PPPoE no se renderiza ──────────────────────────────
describe('GestionRedPage — F6: badge 0 del tab PPPoE oculto', () => {
  it('el tab PPPoE no muestra badge "0" (tabCounts.pppoe está hardcodeado a 0)', () => {
    // useMyPermissions globalmente mockeado con can: () => true → PPPoE tab visible
    renderPage();
    const pppoeTab = screen.getByRole('button', { name: /pppoe/i });
    // Antes del fix: la span tabCount con "0" se renderizan.
    // Después del fix: la span no se renderiza cuando el count es 0.
    const zeroSpan = within(pppoeTab).queryByText('0');
    expect(zeroSpan).toBeNull();
  });

  it('tabs con count > 0 siguen mostrando el badge (no rompas los demás)', () => {
    renderPage();
    // NAS Central tab tiene 2 dispositivos → debe seguir mostrando el badge "2"
    const nasTab = screen.getByRole('button', { name: /dispositivos nas/i });
    // El badge "2" puede aparecer tanto en el tab como en el KPI — nos alcanza con uno
    const allTwos = screen.getAllByText('2');
    expect(allTwos.length).toBeGreaterThan(0);
    // y que el tab NAS tenga el badge
    expect(within(nasTab).getByText('2')).toBeInTheDocument();
  });
});
