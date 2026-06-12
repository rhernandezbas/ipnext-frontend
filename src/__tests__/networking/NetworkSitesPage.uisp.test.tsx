/**
 * NetworkSitesPage — UISP columns tests (uisp-networksite-autoimport)
 *
 * SCEN-FE-NS-01: linked site shows UISP status badge
 * SCEN-FE-NS-02: linked site shows device count
 * SCEN-FE-NS-03: linked site with missingSince shows "no visto" badge
 * SCEN-FE-NS-04: unlinked site shows "—" in UISP columns
 * SCEN-FE-NS-05: linked site shows "Ver nodo UISP" link → /admin/networking/nodes/:uispId
 * SCEN-FE-NS-06: empty list → no crash, standard empty state
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as NetworkSitesPage } from '@/pages/networking/NetworkSitesPage';
import * as useNetworkSitesModule from '@/hooks/useNetworkSites';
import type { NetworkSite } from '@/types/networkSite';

vi.mock('@/hooks/useNetworkSites');

// The page uses useUispSites for the EditSiteModal — mock it out to prevent unresolved queries
vi.mock('@/hooks/useUispSites', () => ({
  useUispSites: () => ({ data: { sites: [] }, isLoading: false }),
}));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const NOW_ISO = '2026-06-10T00:00:00.000Z';

const linkedSite: NetworkSite = {
  id: '1',
  siteNumber: 1,
  fixedCode: 'NODO 1',
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
  iclassNodeCode: null,
  uispSiteId: 'uisp-abc',
  uisp: {
    status: 'active',
    deviceCount: 7,
    outageCount: 0,
    lastSyncAt: NOW_ISO,
    missingSince: null,
  },
};

const missingSite: NetworkSite = {
  id: '2',
  siteNumber: 2,
  fixedCode: 'NODO 2',
  name: 'POP Norte',
  address: 'Av. Cabildo 2500',
  city: 'Buenos Aires',
  coordinates: null,
  type: 'pop',
  status: 'active',
  deviceCount: 8,
  clientCount: 220,
  uplink: '1 Gbps fibra',
  parentSiteId: null,
  description: 'POP norte',
  iclassNodeCode: null,
  uispSiteId: 'uisp-xyz',
  uisp: {
    status: 'active',
    deviceCount: 3,
    outageCount: 1,
    lastSyncAt: NOW_ISO,
    missingSince: '2026-05-01T00:00:00.000Z',
  },
};

const unlinkedSite: NetworkSite = {
  id: '3',
  siteNumber: 3,
  fixedCode: 'NODO 3',
  name: 'Torre Sur',
  address: 'Autopista km 12',
  city: 'Ezeiza',
  coordinates: null,
  type: 'tower',
  status: 'maintenance',
  deviceCount: 4,
  clientCount: 85,
  uplink: '500 Mbps radio',
  parentSiteId: null,
  description: 'Torre sur',
  iclassNodeCode: null,
  uispSiteId: null,
  uisp: null,
};

function setupMocks(sites: NetworkSite[]) {
  vi.mocked(useNetworkSitesModule.useNetworkSites).mockReturnValue({
    data: sites,
    isLoading: false,
  } as ReturnType<typeof useNetworkSitesModule.useNetworkSites>);

  vi.mocked(useNetworkSitesModule.useCreateNetworkSite).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useNetworkSitesModule.useCreateNetworkSite>);

  vi.mocked(useNetworkSitesModule.useUpdateNetworkSite).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useNetworkSitesModule.useUpdateNetworkSite>);

  vi.mocked(useNetworkSitesModule.useDeleteNetworkSite).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useNetworkSitesModule.useDeleteNetworkSite>);
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <NetworkSitesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NetworkSitesPage — UISP columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // SCEN-FE-NS-01: linked site shows UISP status badge
  it('SCEN-FE-NS-01: linked site shows UISP status', () => {
    setupMocks([linkedSite]);
    renderPage();
    // Should show the UISP status label somewhere in the row
    expect(screen.getByTestId('uisp-status-1')).toBeInTheDocument();
  });

  // SCEN-FE-NS-02: linked site shows device count from uisp block
  it('SCEN-FE-NS-02: linked site shows UISP device count (7)', () => {
    setupMocks([linkedSite]);
    renderPage();
    expect(screen.getByTestId('uisp-devices-1')).toHaveTextContent('7');
  });

  // SCEN-FE-NS-03: missingSince → "no visto" badge
  it('SCEN-FE-NS-03: site with missingSince shows "no visto" badge', () => {
    setupMocks([missingSite]);
    renderPage();
    expect(screen.getByTestId('uisp-missing-2')).toBeInTheDocument();
  });

  // SCEN-FE-NS-04: unlinked → "—" in all UISP columns (status, devices, link)
  it('SCEN-FE-NS-04: unlinked site shows "—" for UISP status, devices, and link cell', () => {
    setupMocks([unlinkedSite]);
    renderPage();
    expect(screen.getByTestId('uisp-status-3')).toHaveTextContent('—');
    expect(screen.getByTestId('uisp-devices-3')).toHaveTextContent('—');
    // FIX-4: link cell renders "—" instead of null when uispSiteId is not set
    expect(screen.getByTestId('uisp-link-3')).toHaveTextContent('—');
  });

  // SCEN-FE-NS-05: linked site → link "Ver nodo UISP"
  it('SCEN-FE-NS-05: linked site has "Ver nodo UISP" link → correct path', () => {
    setupMocks([linkedSite]);
    renderPage();
    const link = screen.getByRole('link', { name: /ver nodo uisp/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/admin/networking/nodes/uisp-abc');
  });

  // SCEN-FE-NS-06: empty list → no crash
  it('SCEN-FE-NS-06: empty list renders without crash', () => {
    setupMocks([]);
    renderPage();
    expect(screen.getByRole('heading', { name: /sitios de red/i })).toBeInTheDocument();
  });
});
