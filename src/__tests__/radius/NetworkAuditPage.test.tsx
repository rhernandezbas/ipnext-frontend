import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NetworkAuditPage from '@/pages/radius/NetworkAuditPage';
import * as useRadiusEventsModule from '@/hooks/useRadiusEvents';
import * as useNe8000AuditModule from '@/hooks/useNe8000Audit';
import * as useRadiusAuthFailuresModule from '@/hooks/useRadiusAuthFailures';
import * as usePppoeNasMoveEventsModule from '@/hooks/usePppoeNasMoveEvents';
import * as useRadiusSessionCuresModule from '@/hooks/useRadiusSessionCures';
import type {
  PaginatedRadiusEvents,
  PaginatedNe8000Audit,
  PaginatedRadiusAuthEvents,
} from '@/types/networkAudit';
import type { PaginatedPppoeNasMoveEvents } from '@/types/pppoeNasMove';
import type { PaginatedRadiusSessionCureEvents } from '@/types/radiusSessionCure';

vi.mock('@/hooks/useRadiusEvents');
vi.mock('@/hooks/useNe8000Audit');
vi.mock('@/hooks/useRadiusAuthFailures');
vi.mock('@/hooks/usePppoeNasMoveEvents');
vi.mock('@/hooks/useRadiusSessionCures');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const RADIUS_DATA: PaginatedRadiusEvents = {
  data: [
    {
      id: 'evt-1',
      username: 'logs.user@isp.com',
      nasId: 'nas-1',
      nasIpAddress: '192.168.1.1',
      nasName: 'NAS-Central',
      framedIp: '10.0.0.1',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      vlanId: 100,
      startedAt: '2026-06-22T10:00:00Z',
      stoppedAt: null,
      sessionTimeSeconds: null,
      inOctets: '1048576',
      outOctets: '524288',
      eventType: 'start',
      status: 'online',
      online: true,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasNext: false,
};

const NE8000_DATA: PaginatedNe8000Audit = {
  data: [
    {
      pppoeId: 'pppoe-1',
      username: 'ne8000.user@isp.com',
      profile: 'Plan 50MB',
      remoteAddress: '10.0.1.50',
      macAddress: 'FF:EE:DD:CC:BB:AA',
      status: 'enabled',
      enforcedState: 'active',
      contractId: 'contract-42',
      currentlyOnline: true,
      lastStartedAt: '2026-06-22T08:00:00Z',
      lastStoppedAt: null,
      lastFramedIp: '10.0.1.50',
      lastVlanId: 200,
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasNext: false,
};

const AUTH_DATA: PaginatedRadiusAuthEvents = {
  data: [
    {
      id: 'auth-1',
      username: 'auth.user@isp.com',
      reply: 'Access-Reject',
      authdate: '2026-06-22T07:00:00Z',
      class: null,
      reason: 'session_stuck',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasNext: false,
  countsByReason: { session_stuck: 1, user_not_found: 0, other: 0 },
};

const NAS_MOVES_DATA: PaginatedPppoeNasMoveEvents = {
  items: [
    {
      id: 'mv-1',
      username: 'moves.user@isp.com',
      fromNas: { id: 'nas-1', name: 'NAS Central' },
      toNas: { id: 'nas-2', name: 'NAS Norte' },
      fromIp: '100.64.60.25',
      toIp: '100.64.43.7',
      trigger: 'manual',
      outcome: 'moved',
      reason: null,
      actorName: 'operador1',
      createdAt: '2026-07-01T15:30:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
};

const SESSION_CURES_DATA: PaginatedRadiusSessionCureEvents = {
  data: [
    {
      id: 'cure-1',
      username: 'cures.user@isp.com',
      nasIp: '10.60.0.10',
      sessionId: 'sess-1',
      sessionStartedAt: '2026-07-16T10:00:00Z',
      sessionLastUpdate: '2026-07-16T10:35:00Z',
      signalUsed: 'persistent_rejects',
      trigger: 'auto',
      action: 'both',
      outcome: 'cured',
      reason: null,
      actorName: 'sistema',
      createdAt: '2026-07-16T11:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
  hasNext: false,
  countsByOutcome: {
    cured: 1, already_cured: 0, skipped_alive: 0, skipped_ambiguous: 0,
    skipped_no_session: 0, skipped_no_signal: 0, flagged_flapping: 0, failed: 0,
  },
};

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <NetworkAuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NetworkAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRadiusEventsModule.useRadiusEvents).mockReturnValue({
      data: RADIUS_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusEventsModule.useRadiusEvents>);
    vi.mocked(useNe8000AuditModule.useNe8000Audit).mockReturnValue({
      data: NE8000_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNe8000AuditModule.useNe8000Audit>);
    vi.mocked(useRadiusAuthFailuresModule.useRadiusAuthFailures).mockReturnValue({
      data: AUTH_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusAuthFailuresModule.useRadiusAuthFailures>);
    vi.mocked(usePppoeNasMoveEventsModule.usePppoeNasMoveEvents).mockReturnValue({
      data: NAS_MOVES_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof usePppoeNasMoveEventsModule.usePppoeNasMoveEvents>);
    vi.mocked(useRadiusSessionCuresModule.useRadiusSessionCures).mockReturnValue({
      data: SESSION_CURES_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useRadiusSessionCuresModule.useRadiusSessionCures>);
    // El auto-mock del módulo (arriba) TAMBIÉN stubea useCureSession — usado por
    // CureSessionButton dentro del tab "Errores de auth" (REQ-FE-CURE-2). Sin este
    // default, cureSession queda `undefined` y `.isPending` revienta al montar la fila
    // session_stuck del tab vecino.
    vi.mocked(useRadiusSessionCuresModule.useCureSession).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useRadiusSessionCuresModule.useCureSession>);
  });

  it('renders five internal tabs (Logs RADIUS + Auditoría NE8000 + Errores de auth + Movimientos NAS + Sesiones curadas)', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /logs radius/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auditoría ne8000/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /errores de auth/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /movimientos nas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sesiones curadas/i })).toBeInTheDocument();
  });

  it('switches to the Sesiones curadas tab and shows its content (S1.4: same route guard as its neighbors)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /sesiones curadas/i }));

    expect(screen.getByText('cures.user@isp.com')).toBeInTheDocument();
    // The other tabs' rows are not mounted while this tab is active.
    expect(screen.queryByText('logs.user@isp.com')).not.toBeInTheDocument();
    expect(screen.queryByText('auth.user@isp.com')).not.toBeInTheDocument();
  });

  it('switches to the Errores de auth tab and shows its content', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /errores de auth/i }));

    expect(screen.getByText('auth.user@isp.com')).toBeInTheDocument();
    // The other tabs' rows are not mounted while this tab is active.
    expect(screen.queryByText('logs.user@isp.com')).not.toBeInTheDocument();
    expect(screen.queryByText('ne8000.user@isp.com')).not.toBeInTheDocument();
  });

  it('switches to the Movimientos NAS tab and shows its content', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /movimientos nas/i }));

    expect(screen.getByText('moves.user@isp.com')).toBeInTheDocument();
    // The other tabs' rows are not mounted while this tab is active.
    expect(screen.queryByText('logs.user@isp.com')).not.toBeInTheDocument();
    expect(screen.queryByText('auth.user@isp.com')).not.toBeInTheDocument();
  });

  it('shows Logs RADIUS content by default', () => {
    renderPage();
    // The Logs page renders its username row.
    expect(screen.getByText('logs.user@isp.com')).toBeInTheDocument();
    // The NE8000 row is NOT mounted while the Logs tab is active.
    expect(screen.queryByText('ne8000.user@isp.com')).not.toBeInTheDocument();
  });

  it('switches to the NE8000 tab and shows audit content', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /auditoría ne8000/i }));

    expect(screen.getByText('ne8000.user@isp.com')).toBeInTheDocument();
    expect(screen.queryByText('logs.user@isp.com')).not.toBeInTheDocument();
  });

  it('marks the active tab with aria-pressed', async () => {
    const user = userEvent.setup();
    renderPage();

    const logsTab = screen.getByRole('button', { name: /logs radius/i });
    const ne8000Tab = screen.getByRole('button', { name: /auditoría ne8000/i });

    expect(logsTab).toHaveAttribute('aria-pressed', 'true');
    expect(ne8000Tab).toHaveAttribute('aria-pressed', 'false');

    await user.click(ne8000Tab);

    expect(ne8000Tab).toHaveAttribute('aria-pressed', 'true');
    expect(logsTab).toHaveAttribute('aria-pressed', 'false');
  });
});
