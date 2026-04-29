import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as NetworkSitesPage } from '@/pages/empresa/NetworkSitesPage';
import * as useNetworkSitesModule from '@/hooks/useNetworkSites';
import type { NetworkSite } from '@/types/networkSite';

vi.mock('@/hooks/useNetworkSites');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockSites: NetworkSite[] = [
  {
    id: '1',
    name: 'Nodo Central',
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    coordinates: { lat: -34.6037, lng: -58.3816 },
    type: 'nodo',
    status: 'active',
    deviceCount: 12,
    clientCount: 450,
    uplink: '10 Gbps fibra',
    parentSiteId: null,
    description: 'Nodo principal',
  },
  {
    id: '2',
    name: 'POP Norte',
    address: 'Av. Cabildo 2500',
    city: 'Buenos Aires',
    coordinates: null,
    type: 'pop',
    status: 'active',
    deviceCount: 8,
    clientCount: 220,
    uplink: '1 Gbps fibra',
    parentSiteId: '1',
    description: 'POP zona norte',
  },
  {
    id: '3',
    name: 'Torre Sur',
    address: 'Autopista km 12',
    city: 'Ezeiza',
    coordinates: null,
    type: 'tower',
    status: 'maintenance',
    deviceCount: 4,
    clientCount: 85,
    uplink: '500 Mbps radio',
    parentSiteId: '1',
    description: 'Torre sur',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <NetworkSitesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NetworkSitesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNetworkSitesModule.useNetworkSites).mockReturnValue({
      data: mockSites,
      isLoading: false,
    } as ReturnType<typeof useNetworkSitesModule.useNetworkSites>);

    vi.mocked(useNetworkSitesModule.useCreateNetworkSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useCreateNetworkSite>);

    vi.mocked(useNetworkSitesModule.useUpdateNetworkSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useUpdateNetworkSite>);

    vi.mocked(useNetworkSitesModule.useDeleteNetworkSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useDeleteNetworkSite>);
  });

  it('renders "Sitios de red" heading', () => {
    renderPage();
    expect(screen.getByText(/sitios de red/i)).toBeInTheDocument();
  });

  it('summary cards render', () => {
    renderPage();
    expect(screen.getByText('Total sitios')).toBeInTheDocument();
    expect(screen.getByText('Activos')).toBeInTheDocument();
    expect(screen.getByText('En mantenimiento')).toBeInTheDocument();
  });

  it('table shows site names from mock', () => {
    renderPage();
    expect(screen.getByText('Nodo Central')).toBeInTheDocument();
    expect(screen.getByText('POP Norte')).toBeInTheDocument();
    expect(screen.getByText('Torre Sur')).toBeInTheDocument();
  });

  it('type badges render', () => {
    renderPage();
    expect(screen.getByText('Nodo')).toBeInTheDocument();
    expect(screen.getByText('POP')).toBeInTheDocument();
    expect(screen.getByText('Torre')).toBeInTheDocument();
  });

  it('"Nuevo sitio" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nuevo sitio/i })).toBeInTheDocument();
  });
});
