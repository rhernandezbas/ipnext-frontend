import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as GestionRedPage } from '@/pages/networking/GestionRedPage';
import * as useNasModule from '@/hooks/useNas';
import * as useNetworkModule from '@/hooks/useNetwork';
import type { NasServer } from '@/types/nas';
import type { IpNetwork, IpPool, IpAssignment, Ipv6Network, PaginatedAssignments } from '@/types/network';

vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useNetwork');

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
