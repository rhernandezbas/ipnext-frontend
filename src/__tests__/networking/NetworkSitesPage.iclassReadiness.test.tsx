/**
 * IClass Readiness badge in NetworkSitesPage
 *
 * SCEN-FE-NSR-01: row with empty address AND city shows "Faltan datos IClass" badge
 * SCEN-FE-NSR-02: row with only empty city shows badge
 * SCEN-FE-NSR-03: row with both address+city filled → no badge
 * SCEN-FE-NSR-04: filter toggle "Solo incompletos" hides complete rows
 * SCEN-FE-NSR-05: badge title lists the specific missing fields
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as NetworkSitesPage } from '@/pages/networking/NetworkSitesPage';
import * as useNetworkSitesModule from '@/hooks/useNetworkSites';
import type { NetworkSite } from '@/types/networkSite';

vi.mock('@/hooks/useNetworkSites');
vi.mock('@/hooks/useUispSites', () => ({
  useUispSites: vi.fn().mockReturnValue({ data: { sites: [] }, isLoading: false }),
}));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeSite(over: Partial<NetworkSite> = {}): NetworkSite {
  return {
    id: 's1',
    name: 'Nodo Central',
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 0,
    clientCount: 0,
    uplink: '',
    parentSiteId: null,
    description: '',
    iclassNodeCode: null,
    uispSiteId: null,
    uisp: null,
    ...over,
  };
}

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
    </QueryClientProvider>
  );
}

describe('NetworkSitesPage — IClass Readiness badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // SCEN-FE-NSR-01
  it('SCEN-FE-NSR-01: row missing both address and city shows badge', () => {
    setupMocks([makeSite({ id: 's1', address: '', city: '' })]);
    renderPage();
    expect(screen.getByTestId('iclass-readiness-s1')).toBeInTheDocument();
    expect(screen.getByTestId('iclass-readiness-s1')).toHaveTextContent(/faltan datos iclass/i);
  });

  // SCEN-FE-NSR-02
  it('SCEN-FE-NSR-02: row missing only city shows badge', () => {
    setupMocks([makeSite({ id: 's1', address: 'Ruta 5 Km 93', city: '' })]);
    renderPage();
    expect(screen.getByTestId('iclass-readiness-s1')).toBeInTheDocument();
  });

  // SCEN-FE-NSR-03
  it('SCEN-FE-NSR-03: row with both filled → no badge', () => {
    setupMocks([makeSite({ id: 's1', address: 'Ruta 5 Km 93', city: 'Altamira' })]);
    renderPage();
    expect(screen.queryByTestId('iclass-readiness-s1')).not.toBeInTheDocument();
  });

  // SCEN-FE-NSR-04
  it('SCEN-FE-NSR-04: "Solo incompletos" filter hides complete rows', () => {
    setupMocks([
      makeSite({ id: 's1', name: 'Nodo Incompleto', address: '', city: '' }),
      makeSite({ id: 's2', name: 'Nodo Completo', address: 'Av. 1234', city: 'CABA' }),
    ]);
    renderPage();

    // Both should be visible initially
    expect(screen.getByText('Nodo Incompleto')).toBeInTheDocument();
    expect(screen.getByText('Nodo Completo')).toBeInTheDocument();

    // Toggle filter
    fireEvent.click(screen.getByRole('checkbox', { name: /solo incompletos/i }));

    // Only incomplete row visible
    expect(screen.getByText('Nodo Incompleto')).toBeInTheDocument();
    expect(screen.queryByText('Nodo Completo')).not.toBeInTheDocument();
  });

  // SCEN-FE-NSR-05
  it('SCEN-FE-NSR-05: badge title lists specific missing fields', () => {
    setupMocks([makeSite({ id: 's1', address: '', city: '' })]);
    renderPage();
    const badge = screen.getByTestId('iclass-readiness-s1');
    expect(badge.title).toMatch(/direcci[oó]n/i);
    expect(badge.title).toMatch(/ciudad/i);
  });
});
