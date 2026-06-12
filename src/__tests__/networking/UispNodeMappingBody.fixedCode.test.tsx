/**
 * UispNodeMappingBody — fixedCode column + addressDisplay (#51)
 *
 * SCEN-FE-FC-01: renders fixedCode badge with the site's fixedCode text
 * SCEN-FE-FC-02: manual address wins over UISP coordinates (no hint rendered)
 * SCEN-FE-FC-03: empty address + coordinates → shows "{lat},{lng}" + hint "coordenadas UISP"
 * SCEN-FE-FC-04: empty address + no coordinates → shows "—", no hint
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

// ── Factory ───────────────────────────────────────────────────────────────────

function makeSite(over: Partial<NetworkSite> = {}): NetworkSite {
  const siteNumber = 7;
  return {
    id: 's7',
    siteNumber,
    fixedCode: `NODO ${siteNumber}`,
    name: 'Nodo Test',
    address: 'Calle Test 1',
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

// ── Shared mock helpers ───────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UispNodeMappingBody — fixedCode column + addressDisplay (#51)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePatchNetworkSite).mockReturnValue(idleUpdate as never);
  });

  // SCEN-FE-FC-01
  it('SCEN-FE-FC-01: renders fixedCode badge with the site fixedCode text', () => {
    setupMocks([makeSite({ id: 's7', siteNumber: 7, fixedCode: 'NODO 7' })]);
    render(<UispNodeMappingBody />);
    const badge = screen.getByTestId('fixed-code-s7');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('NODO 7');
  });

  // SCEN-FE-FC-02
  it('SCEN-FE-FC-02: manual address wins — no UISP hint rendered', () => {
    setupMocks([
      makeSite({
        id: 's7',
        address: 'Calle 1',
        coordinates: { lat: -32.9, lng: -60.6 },
      }),
    ]);
    render(<UispNodeMappingBody />);
    expect(screen.getByTestId('site-address-s7')).toHaveTextContent('Calle 1');
    expect(screen.queryByTestId('address-uisp-hint-s7')).toBeNull();
  });

  // SCEN-FE-FC-03
  it('SCEN-FE-FC-03: empty address + coordinates → shows lat,lng and hint', () => {
    setupMocks([
      makeSite({
        id: 's7',
        address: '',
        coordinates: { lat: -32.9, lng: -60.6 },
      }),
    ]);
    render(<UispNodeMappingBody />);
    expect(screen.getByTestId('site-address-s7')).toHaveTextContent('-32.9,-60.6');
    const hint = screen.getByTestId('address-uisp-hint-s7');
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent('coordenadas UISP');
  });

  // SCEN-FE-FC-04
  it('SCEN-FE-FC-04: empty address + no coordinates → shows "—", no hint', () => {
    setupMocks([
      makeSite({
        id: 's7',
        address: '',
        coordinates: null,
      }),
    ]);
    render(<UispNodeMappingBody />);
    expect(screen.getByTestId('site-address-s7')).toHaveTextContent('—');
    expect(screen.queryByTestId('address-uisp-hint-s7')).toBeNull();
  });

  // SCEN-FE-FC-05 — #51 fix wave: labels sin ambigüedad Código interno vs Localidad IClass
  it('SCEN-FE-FC-05: badge Código aclara que es identidad interna y no se envía a IClass', () => {
    setupMocks([makeSite({ id: 's7' })]);
    render(<UispNodeMappingBody />);
    expect(screen.getByTestId('fixed-code-s7')).toHaveAttribute(
      'title',
      'Identidad interna del sitio — no se envía a IClass',
    );
  });

  // SCEN-FE-FC-06
  it('SCEN-FE-FC-06: header de la columna de localidad explicita que es el código IClass', () => {
    setupMocks([makeSite({ id: 's7' })]);
    render(<UispNodeMappingBody />);
    expect(
      screen.getByRole('columnheader', { name: 'Localidad (código IClass)' }),
    ).toBeInTheDocument();
  });

  // SCEN-FE-FC-07 — aria-label del select alineado con el header visible
  it('SCEN-FE-FC-07: el select de localidad usa aria-label "Localidad (código IClass) para {name}"', () => {
    setupMocks([makeSite({ id: 's7', name: 'Nodo Test' })]);
    render(<UispNodeMappingBody />);
    expect(
      screen.getByLabelText('Localidad (código IClass) para Nodo Test'),
    ).toBeInTheDocument();
  });
});
