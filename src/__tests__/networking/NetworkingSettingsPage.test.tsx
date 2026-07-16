/**
 * NetworkingSettingsPage tests
 *
 * Covers:
 *  1. Page renders heading + breadcrumb
 *  2. UispSyncCard renders when user has uisp.read
 *  3. Fallback renders when user lacks uisp.read
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useUispSyncStatus', () => ({
  useUispSyncStatus: vi.fn(),
  useTriggerUispSync: vi.fn(),
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));
vi.mock('@/hooks/useUispSites', () => ({
  useUispSites: vi.fn(),
}));
vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: vi.fn(),
  usePatchNetworkSite: vi.fn(),
}));
vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: vi.fn(),
  useSyncIClassNodes: vi.fn(),
}));

import { useUispSyncStatus, useTriggerUispSync } from '@/hooks/useUispSyncStatus';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useUispSites } from '@/hooks/useUispSites';
import { useNetworkSites, usePatchNetworkSite } from '@/hooks/useNetworkSites';
import { useIClassNodes, useSyncIClassNodes } from '@/hooks/useIClassNodes';
import NetworkingSettingsPage from '@/pages/networking/NetworkingSettingsPage';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

function setupHooks(permissions: string[] = ['uisp.read']) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some(perm => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useUispSyncStatus).mockReturnValue({
    data: { configured: true, lastRunAt: null, sites: 0, devices: 0, missing: 0, lastError: null },
    isLoading: false,
  } as ReturnType<typeof useUispSyncStatus>);

  vi.mocked(useTriggerUispSync).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined,
  } as unknown as ReturnType<typeof useTriggerUispSync>);

  vi.mocked(useFeatureFlag).mockReturnValue({
    data: { key: 'uisp-sync', enabled: false },
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  vi.mocked(useUispSites).mockReturnValue(mockQuery({
    data: { sites: [] },
    isLoading: false,
    isError: false,
  }));

  vi.mocked(useNetworkSites).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(usePatchNetworkSite).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
    reset: vi.fn(),
  } as never);

  vi.mocked(useIClassNodes).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
  }));

  vi.mocked(useSyncIClassNodes).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ synced: 0, created: 0, updated: 0, reactivated: 0, deactivated: 0 }),
    isPending: false,
    isError: false,
    reset: vi.fn(),
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NetworkingSettingsPage />
    </MemoryRouter>,
  );
}

describe('NetworkingSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders breadcrumb and page title', () => {
    setupHooks();
    renderPage();
    expect(screen.getByText(/gestión de red/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /configuración/i })).toBeInTheDocument();
  });

  it('renders UISP section heading', () => {
    setupHooks();
    renderPage();
    // The page's own h2 is exactly "UISP"; the card's title also contains UISP but is longer
    expect(screen.getAllByRole('heading', { name: /uisp/i }).length).toBeGreaterThan(0);
  });

  it('renders UispSyncCard content when user has uisp.read', () => {
    setupHooks(['uisp.read']);
    renderPage();
    // The card renders "Sincronización UISP" heading in its status section
    expect(screen.getByText(/sincronización uisp/i)).toBeInTheDocument();
  });

  it('renders fallback when user lacks uisp.read', () => {
    setupHooks([]);
    renderPage();
    // UISP sync card + mapping body + nodes list — all three Can sections fallback
    const fallbacks = screen.getAllByText(/no tenés permiso/i);
    expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/sincronización uisp/i)).not.toBeInTheDocument();
  });

  it('renders Nodos UISP (espejo) section heading when user has uisp.read', () => {
    setupHooks(['uisp.read']);
    renderPage();
    expect(screen.getByRole('heading', { name: /nodos uisp \(espejo\)/i })).toBeInTheDocument();
  });

  it('renders UispNodesList table within nodes section when user has uisp.read', () => {
    setupHooks(['uisp.read']);
    // Override syncStatus so lastRunAt != null (avoids NeverSyncedEmptyState)
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: { configured: true, lastRunAt: '2026-06-10T10:00:00.000Z', sites: 1, devices: 3, missing: 0, lastError: null },
      isLoading: false,
    } as ReturnType<typeof useUispSyncStatus>);
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: [{ uispId: 'site-1', name: 'Nodo Alpha', status: 'active', deviceCount: 3, outageCount: 0, lastSyncAt: null, missingSince: null }] },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useUispSites>);
    renderPage();
    // Table header columns rendered
    expect(screen.getAllByRole('columnheader', { name: /nombre/i }).length).toBeGreaterThanOrEqual(1);
    // Site row rendered
    expect(screen.getByText('Nodo Alpha')).toBeInTheDocument();
  });

  it('renders fallback in nodes section when user lacks uisp.read', () => {
    setupHooks([]);
    renderPage();
    // Three Can sections (UISP card + mapping + nodes list) show the no-permission fallback
    const fallbacks = screen.getAllByText(/no tenés permiso/i);
    expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    // Table should not be present
    expect(screen.queryByRole('columnheader', { name: /nombre/i })).not.toBeInTheDocument();
  });

  // ── RadiusAccountingCard section ────────────────────────────────────────

  it('renders RADIUS section heading', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(screen.getByRole('heading', { name: /^radius$/i })).toBeInTheDocument();
  });

  it('renders RadiusAccountingCard when user has admin.flags', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(screen.getByRole('heading', { name: /ingesta de auditoría radius/i })).toBeInTheDocument();
  });

  it('renders RadiusAuthIngestCard when user has admin.flags', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(screen.getByRole('heading', { name: /ingesta de errores de auth radius/i })).toBeInTheDocument();
  });

  it('renders both RADIUS cards (accounting + auth ingest) when user has admin.flags', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(screen.getByRole('heading', { name: /ingesta de auditoría radius/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ingesta de errores de auth radius/i })).toBeInTheDocument();
  });

  it('renders RADIUS section fallback when user lacks admin.flags', () => {
    setupHooks(['uisp.read']);
    renderPage();
    // The RADIUS Can section renders the no-permission fallback
    const fallbacks = screen.getAllByText(/no tenés permiso/i);
    expect(fallbacks.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('heading', { name: /ingesta de auditoría radius/i })).not.toBeInTheDocument();
  });

  // ── PppoeAutoMoveCard section (pppoe-move-nas W2) ───────────────────────

  it('renders PPPoE section heading', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(screen.getByRole('heading', { name: /^pppoe$/i })).toBeInTheDocument();
  });

  it('renders PppoeAutoMoveCard when user has admin.flags', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(
      screen.getByRole('heading', { name: /auto-move de pppoe \(vigilante de nas\)/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render PppoeAutoMoveCard when user lacks admin.flags', () => {
    setupHooks(['uisp.read']);
    renderPage();
    expect(
      screen.queryByRole('heading', { name: /auto-move de pppoe/i }),
    ).not.toBeInTheDocument();
  });

  // ── ContractNetworkAutoAssignCard section (contract-node-ap-auto-assign Fase B) ─

  it('renders Auto-asignación nodo/AP section heading', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(screen.getByRole('heading', { name: /^auto-asignación nodo\/ap$/i })).toBeInTheDocument();
  });

  it('renders ContractNetworkAutoAssignCard when user has admin.flags', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(
      screen.getByRole('heading', { name: /auto-asignación de nodo\/access point/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render ContractNetworkAutoAssignCard when user lacks admin.flags', () => {
    setupHooks(['uisp.read']);
    renderPage();
    expect(
      screen.queryByRole('heading', { name: /auto-asignación de nodo\/access point/i }),
    ).not.toBeInTheDocument();
  });

  // ── RadiusAutoCureCard section (radius-auto-cure flag) ──────────────────

  it('renders RadiusAutoCureCard when user has admin.flags', () => {
    setupHooks(['uisp.read', 'admin.flags']);
    renderPage();
    expect(
      screen.getByRole('heading', { name: /auto-cure de sesiones radius/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render RadiusAutoCureCard when user lacks admin.flags', () => {
    setupHooks(['uisp.read']);
    renderPage();
    expect(
      screen.queryByRole('heading', { name: /auto-cure de sesiones radius/i }),
    ).not.toBeInTheDocument();
  });
});
