/**
 * Tests for SessionsBody — the Sesiones tab backed by the real Session API.
 * Mocks useSessions hooks and useConfirm.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SessionPage } from '@/types/session';

const revokeMutate = vi.fn();
const revokeAllMutate = vi.fn();

vi.mock('@/hooks/useSessions', () => ({
  useActiveSessions: vi.fn(),
  useRevokeSession: vi.fn(() => ({ mutate: revokeMutate, isPending: false })),
  useRevokeAllSessions: vi.fn(() => ({ mutate: revokeAllMutate, isPending: false })),
  useSessionHistory: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
  SESSIONS_QUERY_KEY: ['admin', 'sessions'],
  SESSION_HISTORY_QUERY_KEY: ['admin', 'sessions', 'history'],
}));

import { useActiveSessions } from '@/hooks/useSessions';
import { useConfirm } from '@/context/ConfirmContext';
import { SessionsBody } from '@/pages/system/admin/SessionsBody';

function makePage(overrides: Partial<SessionPage> = {}): SessionPage {
  return {
    items: [
      {
        id: 's-1',
        rbacUserId: 'u1',
        actorLogin: 'carlos',
        ip: '192.168.1.20',
        userAgent: 'Chrome 124',
        loginAt: '2026-05-01T10:00:00Z',
        lastSeenAt: '2026-05-01T11:30:00Z',
        revokedAt: null,
        createdAt: '2026-05-01T10:00:00Z',
      },
      {
        id: 's-2',
        rbacUserId: 'u2',
        actorLogin: 'maria',
        ip: null,
        userAgent: null,
        loginAt: '2026-04-30T09:00:00Z',
        lastSeenAt: '2026-04-30T09:45:00Z',
        revokedAt: null,
        createdAt: '2026-04-30T09:00:00Z',
      },
    ],
    total: 2,
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

function mockHook(page: SessionPage, opts: { isLoading?: boolean } = {}) {
  vi.mocked(useActiveSessions).mockReturnValue({
    data: opts.isLoading ? undefined : page,
    isLoading: Boolean(opts.isLoading),
    isError: false,
    isFetching: false,
  } as unknown as ReturnType<typeof useActiveSessions>);
}

describe('SessionsBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // restore the default auto-confirm (true) — cleared by clearAllMocks
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('renders rows from the active sessions', () => {
    mockHook(makePage());
    render(<SessionsBody />);

    expect(screen.getByText('carlos')).toBeInTheDocument();
    expect(screen.getByText('maria')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.20')).toBeInTheDocument();
    expect(screen.getByText('Chrome 124')).toBeInTheDocument();
  });

  it('renders a dash for null ip and userAgent', () => {
    mockHook(makePage());
    render(<SessionsBody />);

    // maria's row has null ip + userAgent → both render as '—'
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows column headers', () => {
    mockHook(makePage());
    render(<SessionsBody />);

    expect(screen.getAllByRole('columnheader', { name: /actor/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /ip/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /navegador/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /inicio/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('columnheader', { name: /última actividad/i })).toBeInTheDocument();
  });

  it('"Forzar logout" triggers confirm and calls revoke on confirm', async () => {
    const user = userEvent.setup();
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    mockHook(makePage());
    render(<SessionsBody />);

    const buttons = screen.getAllByRole('button', { name: /forzar logout/i });
    await user.click(buttons[0]);

    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger' })
    );
    expect(revokeMutate).toHaveBeenCalledWith('s-1');
  });

  it('does NOT revoke when the confirm is cancelled', async () => {
    const user = userEvent.setup();
    const confirmFn = vi.fn().mockResolvedValue(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    mockHook(makePage());
    render(<SessionsBody />);

    const buttons = screen.getAllByRole('button', { name: /forzar logout/i });
    await user.click(buttons[0]);

    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(revokeMutate).not.toHaveBeenCalled();
  });

  it('shows empty state when there are no sessions', () => {
    mockHook(makePage({ items: [], total: 0 }));
    render(<SessionsBody />);

    expect(screen.getByText(/no hay sesiones activas/i)).toBeInTheDocument();
  });

  it('pagination next button advances the page query', async () => {
    const user = userEvent.setup();
    // total 60, pageSize 25 → 3 pages
    mockHook(makePage({ total: 60, pageSize: 25, page: 1 }));
    render(<SessionsBody />);

    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(useActiveSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })
    );
  });
});
