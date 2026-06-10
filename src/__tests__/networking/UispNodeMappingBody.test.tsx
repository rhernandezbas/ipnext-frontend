/**
 * UispNodeMappingBody — catálogo de mapeo NetworkSite ↔ nodo UISP
 *
 * SCEN-FE-NM-01: preselects existing uispSiteId
 * SCEN-FE-NM-02: unlinked site shows "— Sin vincular —" as selected option
 * SCEN-FE-NM-03: select → PATCH with exact body {uispSiteId: string}
 * SCEN-FE-NM-04: select "Sin vincular" → PATCH with {uispSiteId: null}
 * SCEN-FE-NM-05: saving indicator while mutation in flight
 * SCEN-FE-NM-06: saved indicator after success
 * SCEN-FE-NM-07: 422 UISP_SITE_NOT_FOUND → error indicator on that row
 * SCEN-FE-NM-08: client-side search filters rows
 * SCEN-FE-NM-09: empty state when no network sites
 * SCEN-FE-NM-10: shows iclassNodeCode (read-only) or "—" when null
 * SCEN-FE-NM-11: shows uisp.status badge or "—" when uisp is null
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

import { useNetworkSites, usePatchNetworkSite } from '@/hooks/useNetworkSites';
import { useUispSites } from '@/hooks/useUispSites';
import { UispNodeMappingBody } from '@/components/networking/UispNodeMappingBody';
import type { NetworkSite } from '@/types/networkSite';
import type { UispSiteRow } from '@/types/uisp';

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

function makeUispSite(over: Partial<UispSiteRow> = {}): UispSiteRow {
  return {
    uispId: 'u1',
    name: 'Site Alpha',
    status: 'active',
    deviceCount: 3,
    outageCount: 0,
    lastSyncAt: null,
    missingSince: null,
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

function setupMocks(
  sites: NetworkSite[],
  uispSites: UispSiteRow[] = [],
  opts: { sitesLoading?: boolean } = {},
) {
  vi.mocked(useNetworkSites).mockReturnValue({
    data: opts.sitesLoading ? undefined : sites,
    isLoading: opts.sitesLoading ?? false,
  } as ReturnType<typeof useNetworkSites>);

  vi.mocked(useUispSites).mockReturnValue({
    data: { sites: uispSites },
    isLoading: false,
  } as ReturnType<typeof useUispSites>);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UispNodeMappingBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePatchNetworkSite).mockReturnValue(idleUpdate as never);
  });

  // SCEN-FE-NM-01
  it('SCEN-FE-NM-01: preselects existing uispSiteId', () => {
    const uispSites = [makeUispSite({ uispId: 'u1', name: 'Site Alpha' })];
    const sites = [makeSite({ id: 's1', uispSiteId: 'u1' })];
    setupMocks(sites, uispSites);
    render(<UispNodeMappingBody />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('u1');
  });

  // SCEN-FE-NM-02
  it('SCEN-FE-NM-02: unlinked site shows "— Sin vincular —" as selected option', () => {
    const sites = [makeSite({ id: 's1', uispSiteId: null })];
    setupMocks(sites, [makeUispSite()]);
    render(<UispNodeMappingBody />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  // SCEN-FE-NM-03
  it('SCEN-FE-NM-03: select → PATCH with {uispSiteId: string}', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(usePatchNetworkSite).mockReturnValue({ ...idleUpdate, mutateAsync } as never);

    const uispSites = [
      makeUispSite({ uispId: 'u1', name: 'Site Alpha' }),
      makeUispSite({ uispId: 'u2', name: 'Site Beta' }),
    ];
    const sites = [makeSite({ id: 's1', uispSiteId: null })];
    setupMocks(sites, uispSites);
    render(<UispNodeMappingBody />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u2' } });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 's1', data: { uispSiteId: 'u2' } });
    });
  });

  // SCEN-FE-NM-04
  it('SCEN-FE-NM-04: select "Sin vincular" → PATCH with {uispSiteId: null}', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(usePatchNetworkSite).mockReturnValue({ ...idleUpdate, mutateAsync } as never);

    const uispSites = [makeUispSite({ uispId: 'u1' })];
    const sites = [makeSite({ id: 's1', uispSiteId: 'u1' })];
    setupMocks(sites, uispSites);
    render(<UispNodeMappingBody />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 's1', data: { uispSiteId: null } });
    });
  });

  // SCEN-FE-NM-05
  it('SCEN-FE-NM-05: saving indicator while mutation is in flight', async () => {
    let resolve!: (v: unknown) => void;
    const mutateAsync = vi.fn(() => new Promise(res => { resolve = res; }));
    vi.mocked(usePatchNetworkSite).mockReturnValue({ ...idleUpdate, mutateAsync } as never);

    const sites = [makeSite({ id: 's1' })];
    setupMocks(sites, [makeUispSite({ uispId: 'u1' })]);
    render(<UispNodeMappingBody />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u1' } });

    await waitFor(() => expect(screen.getByLabelText(/guardando/i)).toBeInTheDocument());
    resolve({});
  });

  // SCEN-FE-NM-06
  it('SCEN-FE-NM-06: saved indicator shown after success', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(usePatchNetworkSite).mockReturnValue({ ...idleUpdate, mutateAsync } as never);

    const sites = [makeSite({ id: 's1' })];
    setupMocks(sites, [makeUispSite({ uispId: 'u1' })]);
    render(<UispNodeMappingBody />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u1' } });

    await waitFor(() => expect(screen.getByLabelText(/guardado/i)).toBeInTheDocument());
  });

  // SCEN-FE-NM-07
  it('SCEN-FE-NM-07: 422 UISP_SITE_NOT_FOUND → error indicator on that row', async () => {
    const err = Object.assign(new Error('UISP_SITE_NOT_FOUND'), {
      response: { status: 422, data: { code: 'UISP_SITE_NOT_FOUND', message: 'Site not found in mirror' } },
    });
    const mutateAsync = vi.fn().mockRejectedValue(err);
    vi.mocked(usePatchNetworkSite).mockReturnValue({ ...idleUpdate, mutateAsync } as never);

    const sites = [makeSite({ id: 's1' })];
    setupMocks(sites, [makeUispSite({ uispId: 'u1' })]);
    render(<UispNodeMappingBody />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'u1' } });

    await waitFor(() => expect(screen.getByLabelText(/error/i)).toBeInTheDocument());
  });

  // SCEN-FE-NM-08
  it('SCEN-FE-NM-08: client-side search filters rows by name', () => {
    const sites = [
      makeSite({ id: 's1', name: 'Nodo Central', uispSiteId: null }),
      makeSite({ id: 's2', name: 'POP Norte', uispSiteId: null }),
    ];
    setupMocks(sites, []);
    render(<UispNodeMappingBody />);

    expect(screen.getByText('Nodo Central')).toBeInTheDocument();
    expect(screen.getByText('POP Norte')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'central' } });

    expect(screen.getByText('Nodo Central')).toBeInTheDocument();
    expect(screen.queryByText('POP Norte')).not.toBeInTheDocument();
  });

  // SCEN-FE-NM-09
  it('SCEN-FE-NM-09: empty state when no network sites', () => {
    setupMocks([], []);
    render(<UispNodeMappingBody />);
    expect(screen.getByText(/no hay network sites/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  // SCEN-FE-NM-10
  it('SCEN-FE-NM-10: shows iclassNodeCode or "—" when null', () => {
    const sites = [
      makeSite({ id: 's1', name: 'A', iclassNodeCode: 'NODO-01' }),
      makeSite({ id: 's2', name: 'B', iclassNodeCode: null }),
    ];
    setupMocks(sites, []);
    render(<UispNodeMappingBody />);

    expect(screen.getByText('NODO-01')).toBeInTheDocument();
    // s2 has null code → shows "—"
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThan(0);
  });

  // SCEN-FE-NM-11
  it('SCEN-FE-NM-11: shows uisp.status badge or "—" for unlinked sites', () => {
    const sites = [
      makeSite({ id: 's1', name: 'A', uispSiteId: 'u1', uisp: { status: 'active', deviceCount: 5, outageCount: 0, lastSyncAt: '', missingSince: null } }),
      makeSite({ id: 's2', name: 'B', uispSiteId: null, uisp: null }),
    ];
    setupMocks(sites, [makeUispSite({ uispId: 'u1' })]);
    render(<UispNodeMappingBody />);

    // s1 shows the UISP status badge text
    expect(screen.getByTestId('uisp-node-status-s1')).toBeInTheDocument();
    // s2 shows "—"
    expect(screen.getByTestId('uisp-node-status-s2')).toHaveTextContent('—');
  });
});
