/**
 * UISP ↔ NetworkSite connector FE tests
 *
 * TDD: written BEFORE implementing the production changes.
 *
 * Covers:
 * - SCEN-FE-NS-01: EditSiteModal renders the UISP site select with options
 * - SCEN-FE-NS-02: "— Sin vincular —" option present; submit sends uispSiteId: null
 * - SCEN-FE-NS-03: Selecting a UISP site sends uispSiteId in update payload
 * - SCEN-FE-NS-04: 422 UISP_SITE_NOT_FOUND → clear error message shown
 * - SCEN-FE-NS-05: NodeDetailPage shows linkedNetworkSite chip when present
 * - SCEN-FE-NS-06: NodeDetailPage does NOT show chip when linkedNetworkSite is null
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ── Mock all hooks ───────────────────────────────────────────────────────────
vi.mock('@/hooks/useNetworkSites');
vi.mock('@/hooks/useUispSites', () => ({ useUispSites: vi.fn() }));
vi.mock('@/hooks/useUispSiteDetail', () => ({ useUispSiteDetail: vi.fn() }));
vi.mock('@/hooks/useUispSyncStatus', () => ({
  useUispSyncStatus: vi.fn(),
  useTriggerUispSync: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(false),
}));

import * as useNetworkSitesModule from '@/hooks/useNetworkSites';
import { useUispSites } from '@/hooks/useUispSites';
import { useUispSiteDetail } from '@/hooks/useUispSiteDetail';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import type { NetworkSite } from '@/types/networkSite';
import type { UispSiteRow, UispSiteDetail } from '@/types/uisp';

// ── Test factories ────────────────────────────────────────────────────────────

function makeNetworkSite(overrides: Partial<NetworkSite> = {}): NetworkSite {
  return {
    id: 'ns-1',
    name: 'Nodo Central',
    address: 'Av. Test 1',
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
    siteNumber: 1,
    fixedCode: 'NODO-1',
    ...overrides,
  };
}

function makeUispSiteRow(overrides: Partial<UispSiteRow> = {}): UispSiteRow {
  return {
    uispId: 'uisp-abc',
    name: 'Torre Norte UISP',
    status: 'active',
    deviceCount: 5,
    outageCount: 0,
    lastSyncAt: '2026-06-20T10:00:00Z',
    missingSince: null,
    ...overrides,
  };
}

function makeUispSiteDetail(overrides: Partial<UispSiteDetail> = {}): UispSiteDetail {
  return {
    uispId: 'uisp-abc',
    name: 'Torre Norte UISP',
    status: 'active',
    parentUispId: null,
    latitude: -34.6,
    longitude: -58.4,
    contact: null,
    deviceCount: 5,
    outageCount: 0,
    lastSyncAt: '2026-06-20T10:00:00Z',
    missingSince: null,
    linkedNetworkSite: null,
    ...overrides,
  };
}

function mockPermsAllow() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false,
    can: () => true,
  } as never);
  vi.mocked(useCan).mockReturnValue(true);
}

function mockUispSites(sites: UispSiteRow[] = [makeUispSiteRow()]) {
  vi.mocked(useUispSites).mockReturnValue({
    data: { sites },
    isLoading: false,
    isError: false,
  } as never);
}

// ── Import pages ─────────────────────────────────────────────────────────────
import { default as NetworkSitesPage } from '@/pages/networking/NetworkSitesPage';
import { default as NodeDetailPage } from '@/pages/networking/NodeDetailPage';

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupNetworkSitesPage(updateMutateMock: Mock, sites: NetworkSite[] = [makeNetworkSite()]) {
  vi.mocked(useNetworkSitesModule.useNetworkSites).mockReturnValue({
    data: sites,
    isLoading: false,
  } as ReturnType<typeof useNetworkSitesModule.useNetworkSites>);

  vi.mocked(useNetworkSitesModule.useCreateNetworkSite).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useNetworkSitesModule.useCreateNetworkSite>);

  vi.mocked(useNetworkSitesModule.useUpdateNetworkSite).mockReturnValue({
    mutate: updateMutateMock,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useNetworkSitesModule.useUpdateNetworkSite>);

  vi.mocked(useNetworkSitesModule.useDeleteNetworkSite).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useNetworkSitesModule.useDeleteNetworkSite>);
}

function renderAndOpenEdit(site: NetworkSite = makeNetworkSite()) {
  render(
    <MemoryRouter>
      <NetworkSitesPage />
    </MemoryRouter>,
  );
  // DataTable wraps actions in a KebabMenu — click the "Acciones" trigger first
  const kebab = screen.getAllByRole('button', { name: /acciones/i })[0];
  fireEvent.click(kebab);
  // Then click "Editar" in the opened menu
  const editBtn = screen.getByRole('menuitem', { name: /editar/i });
  fireEvent.click(editBtn);
  return site;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-NS-01: EditSiteModal renders UISP site select
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-NS-01 — EditSiteModal has UISP site select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermsAllow();
    mockUispSites([makeUispSiteRow({ uispId: 'uisp-abc', name: 'Torre Norte UISP' })]);
  });

  it('renders the "Nodo UISP" label and select in the edit modal', () => {
    const updateMock = vi.fn();
    setupNetworkSitesPage(updateMock);
    renderAndOpenEdit();

    // Should see a label for UISP site selector
    expect(screen.getByLabelText(/nodo uisp/i)).toBeInTheDocument();
  });

  it('renders UISP site options including "— Sin vincular —"', () => {
    const updateMock = vi.fn();
    setupNetworkSitesPage(updateMock);
    renderAndOpenEdit();

    const select = screen.getByLabelText(/nodo uisp/i) as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.text);
    expect(options).toContain('— Sin vincular —');
    expect(options.some(o => o.includes('Torre Norte UISP'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-NS-02: "— Sin vincular —" sends uispSiteId: null
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-NS-02 — Selecting "Sin vincular" sends uispSiteId: null', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermsAllow();
    mockUispSites([makeUispSiteRow()]);
  });

  it('submitting with "Sin vincular" selected sends uispSiteId: null in payload', () => {
    const updateMock = vi.fn();
    // Site already linked
    setupNetworkSitesPage(updateMock, [makeNetworkSite({ uispSiteId: 'uisp-abc' })]);
    renderAndOpenEdit(makeNetworkSite({ uispSiteId: 'uisp-abc' }));

    // Select "Sin vincular"
    const select = screen.getByLabelText(/nodo uisp/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateMock).toHaveBeenCalledTimes(1);
    const call = updateMock.mock.calls[0][0];
    expect(call.data.uispSiteId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-NS-03: Selecting a UISP site sends uispSiteId in payload
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-NS-03 — Selecting a UISP site sends uispSiteId in update payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermsAllow();
    mockUispSites([makeUispSiteRow({ uispId: 'uisp-abc', name: 'Torre Norte UISP' })]);
  });

  it('submitting with a selected UISP site sends its uispId in payload', () => {
    const updateMock = vi.fn();
    setupNetworkSitesPage(updateMock);
    renderAndOpenEdit();

    const select = screen.getByLabelText(/nodo uisp/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'uisp-abc' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateMock).toHaveBeenCalledTimes(1);
    const call = updateMock.mock.calls[0][0];
    expect(call.data.uispSiteId).toBe('uisp-abc');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-NS-04: 422 UISP_SITE_NOT_FOUND → error message shown
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-NS-04 — 422 error shows clear message in edit modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermsAllow();
    mockUispSites([makeUispSiteRow()]);
  });

  it('shows a UISP error message when update fails with UISP_SITE_NOT_FOUND', async () => {
    const updateMock = vi.fn();
    const axiosError = {
      isAxiosError: true,
      response: { status: 422, data: { code: 'UISP_SITE_NOT_FOUND', error: 'UISP site not found' } },
    };

    vi.mocked(useNetworkSitesModule.useUpdateNetworkSite).mockReturnValue({
      mutate: updateMock,
      isPending: false,
      isError: true,
      error: axiosError,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useUpdateNetworkSite>);

    vi.mocked(useNetworkSitesModule.useNetworkSites).mockReturnValue({
      data: [makeNetworkSite()],
      isLoading: false,
    } as ReturnType<typeof useNetworkSitesModule.useNetworkSites>);

    vi.mocked(useNetworkSitesModule.useCreateNetworkSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useCreateNetworkSite>);

    vi.mocked(useNetworkSitesModule.useDeleteNetworkSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useDeleteNetworkSite>);

    renderAndOpenEdit();

    // Error message should be visible somewhere on the edit form
    await waitFor(() => {
      expect(
        screen.queryByText(/nodo uisp no encontrado|uisp.*no encontrado|sitio uisp no existe|uisp.*no existe/i) ??
        screen.queryByText(/uisp_site_not_found/i)
      ).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-NS-05: NodeDetailPage shows linkedNetworkSite chip when present
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-NS-05 — NodeDetailPage shows NetworkSite chip when linked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermsAllow();
  });

  it('renders the NetworkSite chip/link when linkedNetworkSite is set', () => {
    vi.mocked(useUispSiteDetail).mockReturnValue({
      data: {
        site: makeUispSiteDetail({
          linkedNetworkSite: { id: 'ns-1', name: 'Nodo Central' },
        }),
        devices: [],
      },
      isLoading: false,
      isError: false,
    } as never);

    render(
      <MemoryRouter initialEntries={['/admin/networking/nodes/uisp-abc']}>
        <NodeDetailPage />
      </MemoryRouter>,
    );

    // Should show the NetworkSite name
    expect(screen.getByText(/nodo central/i)).toBeInTheDocument();
    // Should show a "NetworkSite" label or chip
    expect(screen.getByText(/networksite/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-NS-06: NodeDetailPage does NOT show chip when no linked site
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-NS-06 — NodeDetailPage has no chip when linkedNetworkSite is null', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermsAllow();
  });

  it('does NOT render NetworkSite chip when linkedNetworkSite is null', () => {
    vi.mocked(useUispSiteDetail).mockReturnValue({
      data: {
        site: makeUispSiteDetail({ linkedNetworkSite: null }),
        devices: [],
      },
      isLoading: false,
      isError: false,
    } as never);

    render(
      <MemoryRouter initialEntries={['/admin/networking/nodes/uisp-abc']}>
        <NodeDetailPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/networksite/i)).not.toBeInTheDocument();
  });
});
