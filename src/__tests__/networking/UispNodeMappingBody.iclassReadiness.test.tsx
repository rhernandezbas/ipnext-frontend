/**
 * IClass Readiness badge in UispNodeMappingBody
 *
 * SCEN-FE-NMR-01: row with empty address/city shows "Faltan datos IClass" badge next to name
 * SCEN-FE-NMR-02: row with both filled → no badge
 */
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: vi.fn(),
  usePatchNetworkSite: vi.fn(),
}));
vi.mock('@/hooks/useUispSites', () => ({
  useUispSites: vi.fn(),
}));
vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: vi.fn(),
  useSyncIClassNodes: vi.fn(),
}));

import { useNetworkSites, usePatchNetworkSite } from '@/hooks/useNetworkSites';
import { useUispSites } from '@/hooks/useUispSites';
import { useIClassNodes, useSyncIClassNodes } from '@/hooks/useIClassNodes';
import { UispNodeMappingBody } from '@/components/networking/UispNodeMappingBody';
import type { NetworkSite } from '@/types/networkSite';

function makeSite(over: Partial<NetworkSite> = {}): NetworkSite {
  const siteNumber = 1;
  return {
    id: 's1',
    siteNumber,
    fixedCode: `NODO ${siteNumber}`,
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

const idleUpdate = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

function setupMocks(sites: NetworkSite[]) {
  vi.mocked(useNetworkSites).mockReturnValue({
    data: sites,
    isLoading: false,
  } as ReturnType<typeof useNetworkSites>);

  vi.mocked(useUispSites).mockReturnValue({
    data: { sites: [] },
    isLoading: false,
  } as ReturnType<typeof useUispSites>);

  vi.mocked(useIClassNodes).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useIClassNodes>);

  vi.mocked(useSyncIClassNodes).mockReturnValue({
    ...idleUpdate,
    isPending: false,
  } as never);
}

describe('UispNodeMappingBody — IClass Readiness badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePatchNetworkSite).mockReturnValue(idleUpdate as never);
  });

  // SCEN-FE-NMR-01
  it('SCEN-FE-NMR-01: row with empty address and city shows badge next to name', () => {
    setupMocks([makeSite({ id: 's1', name: 'Nodo Incompleto', address: '', city: '' })]);
    render(<UispNodeMappingBody />);
    expect(screen.getByTestId('iclass-readiness-s1')).toBeInTheDocument();
    expect(screen.getByTestId('iclass-readiness-s1')).toHaveTextContent(/faltan datos iclass/i);
  });

  // SCEN-FE-NMR-02
  it('SCEN-FE-NMR-02: row with both address+city filled → no badge', () => {
    setupMocks([makeSite({ id: 's1', name: 'Nodo Completo', address: 'Av. 1234', city: 'CABA' })]);
    render(<UispNodeMappingBody />);
    expect(screen.queryByTestId('iclass-readiness-s1')).not.toBeInTheDocument();
  });
});
