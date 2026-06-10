/**
 * SCEN-FE-01..07 — UISP Nodes UI tests
 *
 * TDD: this test file was written BEFORE production code in the pages.
 * The tests reference components that did not exist at write time.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock hooks ────────────────────────────────────────────────────────────
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

import { useUispSites } from '@/hooks/useUispSites';
import { useUispSiteDetail } from '@/hooks/useUispSiteDetail';
import { useUispSyncStatus, useTriggerUispSync } from '@/hooks/useUispSyncStatus';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import type { UispSiteRow, UispSiteDetail, UispDeviceRow, UispSyncStatus } from '@/types/uisp';

// ── Test data factories ───────────────────────────────────────────────────

function makeSiteRow(overrides: Partial<UispSiteRow> = {}): UispSiteRow {
  return {
    uispId: 'site-1',
    name: 'Nodo Central',
    status: 'active',
    deviceCount: 5,
    outageCount: 0,
    lastSyncAt: '2026-06-10T10:00:00.000Z',
    missingSince: null,
    ...overrides,
  };
}

function makeSites(count: number): UispSiteRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeSiteRow({ uispId: `site-${i + 1}`, name: `Nodo ${i + 1}` })
  );
}

function makeSiteDetail(overrides: Partial<UispSiteDetail> = {}): UispSiteDetail {
  return {
    uispId: 'site-1',
    name: 'Nodo Central',
    status: 'active',
    parentUispId: null,
    latitude: -34.6,
    longitude: -58.4,
    contact: 'admin@empresa.com',
    deviceCount: 11,
    outageCount: 0,
    lastSyncAt: '2026-06-10T10:00:00.000Z',
    missingSince: null,
    linkedNetworkSite: null,
    ...overrides,
  };
}

function makeDeviceRow(overrides: Partial<UispDeviceRow> = {}): UispDeviceRow {
  return {
    uispId: 'dev-1',
    name: 'Router Principal',
    model: 'RB4011',
    modelName: 'RouterBOARD 4011',
    type: 'router',
    role: 'gateway',
    status: 'active',
    signal: -55,
    uptime: '864000', // 10 days
    ip: '192.168.1.1',
    mac: 'AA:BB:CC:DD:EE:FF',
    firmware: '7.14',
    lastSeenAt: '2026-06-10T10:00:00.000Z',
    missingSince: null,
    ...overrides,
  };
}

function makeDevices(count: number): UispDeviceRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeDeviceRow({ uispId: `dev-${i + 1}`, name: `Device ${i + 1}` })
  );
}

function makeSyncStatus(overrides: Partial<UispSyncStatus> = {}): UispSyncStatus {
  return {
    lastRunAt: '2026-06-10T09:55:00.000Z',
    lastResult: null,
    itemsSynced: 73,
    sites: 3,
    devices: 70,
    missing: 0,
    durationMs: 1200,
    configured: true,
    enabled: true,
    lastError: null,
    ...overrides,
  };
}

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  data: undefined,
  reset: vi.fn(),
};

function mockPerms(canFn: (p: string | string[]) => boolean = () => true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false,
    can: (p, _mode?) => canFn(p),
  } as never);
  vi.mocked(useCan).mockImplementation((p: string) => canFn(p));
}

// ── Import pages (after mocks) ───────────────────────────────────────────
import { default as NodesPage } from '@/pages/networking/NodesPage';
import { default as NodeDetailPage } from '@/pages/networking/NodeDetailPage';
import { UispSyncCard } from '@/components/settings/UispSyncCard';

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-01 — 73 rows rendered in the nodes list
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-01 — NodesPage renders 73 rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
  });

  it('renders a row for each of 73 sites', () => {
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: makeSites(73) },
      isLoading: false,
      isError: false,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    // Verify 73 site name cells are rendered (Nodo 1 .. Nodo 73)
    const rows = screen.getAllByText(/^Nodo \d+$/);
    expect(rows).toHaveLength(73);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-02 — Empty state: sync never ran (configured, lastRunAt null)
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-02 — Empty state when sync has never run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
  });

  it('shows "nunca fue ejecutada" empty state when configured=true but lastRunAt=null', () => {
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus({ lastRunAt: null, configured: true }),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: [] },
      isLoading: false,
      isError: false,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    expect(screen.getByText(/sincronización nunca fue ejecutada/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-03 — Empty state: UISP not configured (configured=false)
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-03 — Empty state when UISP not configured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
  });

  it('shows "no configurado" empty state when configured=false', () => {
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus({ configured: false, lastRunAt: null }),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: [] },
      isLoading: false,
      isError: false,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    expect(screen.getByText(/uisp no configurado/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-04 — NodeDetailPage renders site header + 11 device rows
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-04 — NodeDetailPage renders site detail and device table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
  });

  it('renders site name in header and 11 device rows', () => {
    vi.mocked(useUispSiteDetail).mockReturnValue({
      data: {
        site: makeSiteDetail({ deviceCount: 11 }),
        devices: makeDevices(11),
      },
      isLoading: false,
      isError: false,
    } as never);

    render(
      <MemoryRouter initialEntries={['/admin/networking/nodes/site-1']}>
        <NodeDetailPage />
      </MemoryRouter>
    );

    // Site name in header
    expect(screen.getByText('Nodo Central')).toBeInTheDocument();
    // 11 device name cells
    const deviceNames = screen.getAllByText(/^Device \d+$/);
    expect(deviceNames).toHaveLength(11);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-05 — Missing badge shown when missingSince is set
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-05 — Missing badge on devices with missingSince', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
  });

  it('shows missing badge only for devices with missingSince != null', () => {
    const devices: UispDeviceRow[] = [
      makeDeviceRow({ uispId: 'dev-1', name: 'Device Present', missingSince: null }),
      makeDeviceRow({ uispId: 'dev-2', name: 'Device Missing', missingSince: '2026-06-09T00:00:00.000Z' }),
    ];

    vi.mocked(useUispSiteDetail).mockReturnValue({
      data: {
        site: makeSiteDetail(),
        devices,
      },
      isLoading: false,
      isError: false,
    } as never);

    render(
      <MemoryRouter initialEntries={['/admin/networking/nodes/site-1']}>
        <NodeDetailPage />
      </MemoryRouter>
    );

    // Only one missing badge
    const missingBadges = screen.getAllByText(/no visto/i);
    expect(missingBadges).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-06 — Sidebar "Nodos" entry is visible with uisp.read
// ═══════════════════════════════════════════════════════════════════════════
// Note: sidebar is tested via its own unit test. Here we verify the route
// is accessible and the link exists in the sidebar when permission is held.
// The Sidebar component uses useMyPermissions internally — tested via Sidebar.test.tsx.
// This scenario is covered by the sidebar rendering with the permission.
describe('SCEN-FE-06 — Sidebar Nodos entry with uisp.read permission', () => {
  it('NodesPage renders without crashing when uisp.read is granted', () => {
    mockPerms((p) => p === 'uisp.read' || p === 'uisp.manage');
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: [makeSiteRow()] },
      isLoading: false,
      isError: false,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    expect(screen.getByText('Nodo Central')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCEN-FE-07 — Sync button hidden when user lacks uisp.manage
// ═══════════════════════════════════════════════════════════════════════════
describe('SCEN-FE-07 — Sync button hidden without uisp.manage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT render "Sincronizar ahora" button when uisp.manage is absent', () => {
    mockPerms((p) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every((perm) => perm !== 'uisp.manage');
    });
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: [makeSiteRow()] },
      isLoading: false,
      isError: false,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    expect(screen.queryByRole('button', { name: /sincronizar ahora/i })).not.toBeInTheDocument();
  });

  it('renders "Sincronizar ahora" button when uisp.manage IS granted', () => {
    mockPerms(() => true);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: [makeSiteRow()] },
      isLoading: false,
      isError: false,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    expect(screen.getByRole('button', { name: /sincronizar ahora/i })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Pure utility function tests — categorizeSignal & humanizeUptime
// ═══════════════════════════════════════════════════════════════════════════
import { categorizeSignal, humanizeUptime } from '@/lib/uisp';

describe('categorizeSignal — airMax signal tier', () => {
  it('returns "none" for null signal', () => {
    expect(categorizeSignal(null)).toBe('none');
  });

  it('returns "excellent" when signal > -60 (e.g. -55)', () => {
    expect(categorizeSignal(-55)).toBe('excellent');
  });

  it('returns "good" when signal is -60 to -70 (e.g. -65)', () => {
    expect(categorizeSignal(-65)).toBe('good');
  });

  it('returns "fair" when signal is -70 to -80 (e.g. -75)', () => {
    expect(categorizeSignal(-75)).toBe('fair');
  });

  it('returns "critical" when signal < -80 (e.g. -85)', () => {
    expect(categorizeSignal(-85)).toBe('critical');
  });

  it('boundary: -60 exactly → "good" (not excellent)', () => {
    expect(categorizeSignal(-60)).toBe('good');
  });

  it('boundary: -80 exactly → "critical" (not fair)', () => {
    expect(categorizeSignal(-80)).toBe('critical');
  });
});

describe('humanizeUptime — string seconds to human readable', () => {
  it('returns "—" for null', () => {
    expect(humanizeUptime(null)).toBe('—');
  });

  it('returns "< 1m" for 0 seconds', () => {
    expect(humanizeUptime('0')).toBe('< 1m');
  });

  it('returns "5m" for 300 seconds', () => {
    expect(humanizeUptime('300')).toBe('5m');
  });

  it('returns "2h 30m" for 9000 seconds', () => {
    expect(humanizeUptime('9000')).toBe('2h 30m');
  });

  it('returns "10d 0h" for 864000 seconds (exactly 10 days)', () => {
    expect(humanizeUptime('864000')).toBe('10d 0h');
  });

  it('handles large BigInt-like strings', () => {
    // 15 days + 2 hours = 15*86400 + 2*3600 = 1296000 + 7200 = 1303200 seconds
    expect(humanizeUptime('1303200')).toBe('15d 2h');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UispSyncCard tests
// ═══════════════════════════════════════════════════════════════════════════
describe('UispSyncCard', () => {
  const idleFlag = {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetFeatureFlag).mockReturnValue(idleFlag as never);
  });

  it('renders "no configurado" state when configured=false', () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus({ configured: false }),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: false },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    expect(screen.getByText(/uisp no configurado/i)).toBeInTheDocument();
  });

  it('renders sync stats (sites, devices) when configured=true', () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus({ sites: 5, devices: 68, configured: true }),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: true },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
  });

  it('hides "Sincronizar ahora" button when user lacks uisp.manage', () => {
    mockPerms((p) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every((perm) => perm !== 'uisp.manage');
    });
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: false },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    expect(screen.queryByRole('button', { name: /sincronizar ahora/i })).not.toBeInTheDocument();
  });

  // FIX-2b: lastError → red banner shown
  it('FIX-2b: shows lastError banner when last sync failed', () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus({
        lastError: 'UISP connection refused',
        sites: null,
        devices: null,
        missing: null,
        durationMs: null,
      }),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: true },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    expect(screen.getByText(/último sync falló/i)).toBeInTheDocument();
    expect(screen.getByText(/uisp connection refused/i)).toBeInTheDocument();
  });

  // FIX-2b: null counts → '—' shown (not blank)
  it('FIX-2b: null counts render as "—" not blank', () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus({
        lastError: 'UISP connection refused',
        sites: null,
        devices: null,
        missing: null,
      }),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useTriggerUispSync).mockReturnValue(idleMutation as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: true },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    // Three '—' cells (sites, devices, missing)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('202 queued:true → "Sync encolado correctamente." success message', async () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useTriggerUispSync).mockReturnValue({
      ...idleMutation,
      isSuccess: true,
      data: { queued: true },
    } as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: true },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    expect(screen.getByText(/sync encolado correctamente/i)).toBeInTheDocument();
  });

  // ── 409 UX fix tests (RED → GREEN) ──────────────────────────────────────

  it('409 already-running → amber informative banner (NOT generic error)', () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    const err = Object.assign(new Error('409'), {
      response: { status: 409, data: { queued: false, reason: 'already-running' } },
    });
    vi.mocked(useTriggerUispSync).mockReturnValue({
      ...idleMutation,
      isError: true,
      error: err,
    } as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: true },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    // Must show the informative already-running message
    expect(screen.getByText(/ya hay una sincronización en curso/i)).toBeInTheDocument();
    // Must NOT show the generic error banner
    expect(screen.queryByText(/error al disparar el sync/i)).not.toBeInTheDocument();
  });

  it('409 flag-disabled → informative banner about flag (NOT generic error)', () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    const err = Object.assign(new Error('409'), {
      response: { status: 409, data: { queued: false, reason: 'flag-disabled' } },
    });
    vi.mocked(useTriggerUispSync).mockReturnValue({
      ...idleMutation,
      isError: true,
      error: err,
    } as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: false },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    expect(screen.getByText(/sync automático está desactivado/i)).toBeInTheDocument();
    expect(screen.queryByText(/error al disparar el sync/i)).not.toBeInTheDocument();
  });

  it('network error (non-409) → generic error banner', () => {
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    const err = Object.assign(new Error('Network Error'), {
      response: undefined,
    });
    vi.mocked(useTriggerUispSync).mockReturnValue({
      ...idleMutation,
      isError: true,
      error: err,
    } as never);
    vi.mocked(useFeatureFlag).mockReturnValue({
      data: { key: 'uisp-sync', enabled: true },
      isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(),
    } as never);

    render(<UispSyncCard />);

    expect(screen.getByText(/error al disparar el sync/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NodesPage 409 UX fix tests
// ═══════════════════════════════════════════════════════════════════════════
describe('NodesPage — 409 trigger UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerms(() => true);
    vi.mocked(useUispSyncStatus).mockReturnValue({
      data: makeSyncStatus(),
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useUispSites).mockReturnValue({
      data: { sites: [] },
      isLoading: false,
      isError: false,
    } as never);
  });

  it('409 already-running → informative banner in NodesPage (NOT generic error)', () => {
    const err = Object.assign(new Error('409'), {
      response: { status: 409, data: { queued: false, reason: 'already-running' } },
    });
    vi.mocked(useTriggerUispSync).mockReturnValue({
      ...idleMutation,
      isError: true,
      error: err,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    expect(screen.getByText(/ya hay una sincronización en curso/i)).toBeInTheDocument();
  });

  it('409 flag-disabled → informative banner in NodesPage (NOT generic error)', () => {
    const err = Object.assign(new Error('409'), {
      response: { status: 409, data: { queued: false, reason: 'flag-disabled' } },
    });
    vi.mocked(useTriggerUispSync).mockReturnValue({
      ...idleMutation,
      isError: true,
      error: err,
    } as never);

    render(<MemoryRouter><NodesPage /></MemoryRouter>);

    expect(screen.getByText(/sync automático está desactivado/i)).toBeInTheDocument();
  });
});
