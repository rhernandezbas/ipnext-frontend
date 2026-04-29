import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as GestionRedPage } from '@/pages/empresa/GestionRedPage';
import * as useNasModule from '@/hooks/useNas';
import * as useNetworkModule from '@/hooks/useNetwork';
import type { NasServer } from '@/types/nas';
import type { IpNetwork, IpPool, IpAssignment, Ipv6Network } from '@/types/network';

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

const mockAssignments: IpAssignment[] = [];

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
    } as ReturnType<typeof useNasModule.useNasServers>);

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

    vi.mocked(useNasModule.useRadiusConfig).mockReturnValue({
      data: {
        authPort: 1812,
        acctPort: 1813,
        coaPort: 3799,
        sessionTimeout: 86400,
        idleTimeout: 3600,
        interimUpdateInterval: 300,
        nasType: 'other',
        enableCoa: true,
        enableAccounting: true,
      },
      isLoading: false,
    } as ReturnType<typeof useNasModule.useRadiusConfig>);

    vi.mocked(useNasModule.useUpdateRadiusConfig).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNasModule.useUpdateRadiusConfig>);

    vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue({
      data: mockNetworks,
      isLoading: false,
    } as ReturnType<typeof useNetworkModule.useIpNetworks>);

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
    } as ReturnType<typeof useNetworkModule.useIpPools>);

    vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkModule.useCreateIpPool>);

    vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue({
      data: mockAssignments,
      isLoading: false,
    } as ReturnType<typeof useNetworkModule.useIpAssignments>);

    vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue({
      data: mockIpv6Networks,
      isLoading: false,
    } as ReturnType<typeof useNetworkModule.useIpv6Networks>);

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
    // 2 NAS servers total
    expect(screen.getByText('2')).toBeInTheDocument();
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
