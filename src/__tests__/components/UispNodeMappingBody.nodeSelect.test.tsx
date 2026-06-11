/**
 * UispNodeMappingBody — Código IClass as a validated catalog <select> (#45)
 *
 * REQ-NCAT-5: the "Código IClass" column is a <select> over active && selectable
 * catalog nodes; the change sends { iclassNodeId } (or null) and invalidates
 * ['network-sites']. Legacy free-text codes with no catalog match render a
 * disabled "{code} (sin validar)" option, selected. A "Sincronizar desde IClass"
 * button triggers the sync and surfaces the resulting counts.
 *
 * SCEN-NS-01: renders a select (not a free-text input) for the IClass code column
 * SCEN-NS-02: select lists the active+selectable catalog nodes
 * SCEN-NS-03: a matched legacy code preselects its catalog node by uuid
 * SCEN-NS-04: an unmatched legacy code shows a disabled "(sin validar)" option, selected
 * SCEN-NS-05: choosing a node → PATCH { iclassNodeId: <uuid> }
 * SCEN-NS-06: choosing "— Sin asignar —" → PATCH { iclassNodeId: null }
 * SCEN-NS-07: "Sincronizar desde IClass" button calls sync
 * SCEN-NS-08: sync button is disabled while the sync is in flight
 * SCEN-NS-09: after a successful sync the result counts are shown
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
import type { IClassNode } from '@/types/iclassNode';

// ── Factories ────────────────────────────────────────────────────────────────

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

function makeNode(over: Partial<IClassNode> = {}): IClassNode {
  return {
    id: 'n-merc',
    nodeId: 35270699,
    code: 'Mercedes',
    description: 'Mercedes',
    active: true,
    selectable: true,
    lastSyncedAt: '2026-06-01T12:00:00Z',
    ...over,
  };
}

const idlePatch = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

const idleSync = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({ synced: 0, created: 0, updated: 0, reactivated: 0, deactivated: 0 }),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

function setupMocks(
  sites: NetworkSite[],
  nodes: IClassNode[],
  opts: {
    patchAsync?: ReturnType<typeof vi.fn>;
    sync?: Partial<typeof idleSync>;
  } = {},
) {
  vi.mocked(useNetworkSites).mockReturnValue({
    data: sites,
    isLoading: false,
  } as ReturnType<typeof useNetworkSites>);

  vi.mocked(useUispSites).mockReturnValue({
    data: { sites: [] },
    isLoading: false,
  } as ReturnType<typeof useUispSites>);

  vi.mocked(useIClassNodes).mockReturnValue({
    data: nodes,
    isLoading: false,
  } as ReturnType<typeof useIClassNodes>);

  vi.mocked(usePatchNetworkSite).mockReturnValue({
    ...idlePatch,
    mutateAsync: opts.patchAsync ?? vi.fn().mockResolvedValue({}),
  } as never);

  vi.mocked(useSyncIClassNodes).mockReturnValue({
    ...idleSync,
    ...opts.sync,
  } as never);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNodeSelect(siteId = 's1') {
  return screen.getByTestId(`iclass-node-select-${siteId}`) as HTMLSelectElement;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UispNodeMappingBody — IClass node select (#45)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // SCEN-NS-01
  it('SCEN-NS-01: renders a select for the IClass code column', () => {
    setupMocks([makeSite({ id: 's1', iclassNodeCode: null })], [makeNode()]);
    render(<UispNodeMappingBody />);
    expect(getNodeSelect()).toBeInTheDocument();
    // The legacy free-text input is gone
    expect(screen.queryByTestId('iclass-code-input-s1')).not.toBeInTheDocument();
  });

  // SCEN-NS-02
  it('SCEN-NS-02: lists the active+selectable catalog nodes as options', () => {
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: null })],
      [
        makeNode({ id: 'n1', code: 'Mercedes' }),
        makeNode({ id: 'n2', code: 'Chivilcoy' }),
      ],
    );
    render(<UispNodeMappingBody />);
    const select = getNodeSelect();
    expect(select).toContainHTML('Mercedes');
    expect(select).toContainHTML('Chivilcoy');
  });

  // SCEN-NS-03
  it('SCEN-NS-03: matched legacy code preselects its catalog node by uuid', () => {
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: 'Mercedes' })],
      [makeNode({ id: 'n-merc', code: 'Mercedes' })],
    );
    render(<UispNodeMappingBody />);
    expect(getNodeSelect().value).toBe('n-merc');
  });

  // SCEN-NS-04
  it('SCEN-NS-04: unmatched legacy code shows a disabled "(sin validar)" option, selected', () => {
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: 'NODO-42' })],
      [makeNode({ id: 'n-merc', code: 'Mercedes' })],
    );
    render(<UispNodeMappingBody />);
    const select = getNodeSelect();
    expect(screen.getByText('NODO-42 (sin validar)')).toBeInTheDocument();
    const legacyOption = screen.getByText('NODO-42 (sin validar)') as HTMLOptionElement;
    expect(legacyOption.disabled).toBe(true);
    expect(select.value).toBe(legacyOption.value);
  });

  // M1: a code matching an INACTIVE catalog node was previously shown as "(sin validar)"
  // — misleading, because the code WAS valid; the sync just deactivated the node.
  // Now the full catalog reaches the component, so an inactive match renders a disabled
  // "(inactivo en IClass)" option (distinct from the truly-unknown "(sin validar)").
  it('M1: code matching an inactive node shows a disabled "(inactivo en IClass)" option, selected', () => {
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: 'Dolores' })],
      [
        makeNode({ id: 'n-merc', code: 'Mercedes', active: true, selectable: true }),
        // Dolores exists in the catalog but was deactivated by a later sync.
        makeNode({ id: 'n-dol', code: 'Dolores', active: false, selectable: true }),
      ],
    );
    render(<UispNodeMappingBody />);
    const select = getNodeSelect();
    const inactiveOption = screen.getByText('Dolores (inactivo en IClass)') as HTMLOptionElement;
    expect(inactiveOption).toBeInTheDocument();
    expect(inactiveOption.disabled).toBe(true);
    expect(select.value).toBe(inactiveOption.value);
    // It must NOT be offered as an eligible (active+selectable) option to pick.
    expect(screen.queryByText('Dolores (sin validar)')).not.toBeInTheDocument();
  });

  // M1 companion: a non-selectable (grouping) node match is also "(inactivo en IClass)"
  // in the sense of not eligible — but the primary distinction we assert here is that
  // a code with NO catalog match at all still falls back to "(sin validar)" as before.
  it('M1: code with no catalog match still shows "(sin validar)" (unchanged)', () => {
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: 'GHOST-99' })],
      [makeNode({ id: 'n-merc', code: 'Mercedes', active: true, selectable: true })],
    );
    render(<UispNodeMappingBody />);
    const select = getNodeSelect();
    const legacyOption = screen.getByText('GHOST-99 (sin validar)') as HTMLOptionElement;
    expect(legacyOption.disabled).toBe(true);
    expect(select.value).toBe(legacyOption.value);
  });

  // M1: inactive nodes must NOT appear as eligible options in the dropdown.
  it('M1: an inactive catalog node is not offered as an eligible option', () => {
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: null })],
      [
        makeNode({ id: 'n-merc', code: 'Mercedes', active: true, selectable: true }),
        makeNode({ id: 'n-old', code: 'OldNode', active: false, selectable: true }),
      ],
    );
    render(<UispNodeMappingBody />);
    const select = getNodeSelect();
    const options = Array.from(select.querySelectorAll('option'));
    const eligible = options.filter(o => !o.disabled && o.value !== '');
    expect(eligible.map(o => o.textContent)).toEqual(['Mercedes']);
  });

  // SCEN-NS-05
  it('SCEN-NS-05: choosing a node → PATCH { iclassNodeId: <uuid> }', async () => {
    const patchAsync = vi.fn().mockResolvedValue({});
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: null })],
      [makeNode({ id: 'n-chiv', code: 'Chivilcoy' })],
      { patchAsync },
    );
    render(<UispNodeMappingBody />);
    fireEvent.change(getNodeSelect(), { target: { value: 'n-chiv' } });
    await waitFor(() => {
      expect(patchAsync).toHaveBeenCalledWith({ id: 's1', data: { iclassNodeId: 'n-chiv' } });
    });
  });

  // SCEN-NS-06
  it('SCEN-NS-06: choosing "— Sin asignar —" → PATCH { iclassNodeId: null }', async () => {
    const patchAsync = vi.fn().mockResolvedValue({});
    setupMocks(
      [makeSite({ id: 's1', iclassNodeCode: 'Mercedes' })],
      [makeNode({ id: 'n-merc', code: 'Mercedes' })],
      { patchAsync },
    );
    render(<UispNodeMappingBody />);
    fireEvent.change(getNodeSelect(), { target: { value: '' } });
    await waitFor(() => {
      expect(patchAsync).toHaveBeenCalledWith({ id: 's1', data: { iclassNodeId: null } });
    });
  });

  // SCEN-NS-07
  it('SCEN-NS-07: "Sincronizar desde IClass" button triggers the sync', async () => {
    const syncAsync = vi.fn().mockResolvedValue({ synced: 36, created: 36, updated: 0, reactivated: 0, deactivated: 0 });
    setupMocks([makeSite({ id: 's1' })], [makeNode()], { sync: { mutateAsync: syncAsync } });
    render(<UispNodeMappingBody />);
    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde iclass/i }));
    await waitFor(() => expect(syncAsync).toHaveBeenCalled());
  });

  // SCEN-NS-08
  it('SCEN-NS-08: sync button is disabled while the sync is in flight', () => {
    setupMocks([makeSite({ id: 's1' })], [makeNode()], { sync: { isPending: true } });
    render(<UispNodeMappingBody />);
    expect(screen.getByRole('button', { name: /sincroniz/i })).toBeDisabled();
  });

  // SCEN-NS-09
  it('SCEN-NS-09: after a successful sync, the result counts are shown', async () => {
    const syncAsync = vi.fn().mockResolvedValue({ synced: 36, created: 30, updated: 6, reactivated: 0, deactivated: 0 });
    setupMocks([makeSite({ id: 's1' })], [makeNode()], { sync: { mutateAsync: syncAsync } });
    render(<UispNodeMappingBody />);
    fireEvent.click(screen.getByRole('button', { name: /sincronizar desde iclass/i }));
    await waitFor(() => {
      expect(screen.getByText(/30 nuevos/)).toBeInTheDocument();
      expect(screen.getByText(/6 actualizados/)).toBeInTheDocument();
    });
  });
});
