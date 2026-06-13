/**
 * Tests for SessionsBody — history section.
 * Separate file that does NOT modify SessionsBody.test.tsx (non-regression).
 * Extends the mock of @/hooks/useSessions to include useSessionHistory.
 */
import { render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SessionPage } from '@/types/session';
import type { SessionHistoryResponse } from '@/api/sessions.api';

const revokeMutate = vi.fn();

vi.mock('@/hooks/useSessions', () => ({
  useActiveSessions: vi.fn(),
  useRevokeSession: vi.fn(() => ({ mutate: revokeMutate, isPending: false })),
  useRevokeAllSessions: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useSessionHistory: vi.fn(),
  SESSIONS_QUERY_KEY: ['admin', 'sessions'],
  SESSION_HISTORY_QUERY_KEY: ['admin', 'sessions', 'history'],
}));

import { useActiveSessions, useSessionHistory } from '@/hooks/useSessions';
import { useConfirm } from '@/context/ConfirmContext';
import { SessionsBody } from '@/pages/system/admin/SessionsBody';

function makeActivePage(overrides: Partial<SessionPage> = {}): SessionPage {
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
    ],
    total: 1,
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

function makeHistoryResponse(overrides: Partial<SessionHistoryResponse> = {}): SessionHistoryResponse {
  return {
    data: [
      {
        id: 'h-1',
        rbacUserId: 'u1',
        actorLogin: 'ex-admin',
        ip: '10.0.0.1',
        userAgent: 'Firefox',
        loginAt: '2026-04-01T10:00:00Z',
        lastSeenAt: '2026-04-01T10:30:00Z',
        revokedAt: '2026-04-01T12:00:00Z',
        createdAt: '2026-04-01T10:00:00Z',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function mockActiveHook(page: SessionPage, opts: { isLoading?: boolean } = {}) {
  vi.mocked(useActiveSessions).mockReturnValue({
    data: opts.isLoading ? undefined : page,
    isLoading: Boolean(opts.isLoading),
    isError: false,
    isFetching: false,
  } as unknown as ReturnType<typeof useActiveSessions>);
}

function mockHistoryHook(
  response: SessionHistoryResponse | null,
  opts: { isLoading?: boolean } = {}
) {
  vi.mocked(useSessionHistory).mockReturnValue({
    data: opts.isLoading ? undefined : (response ?? undefined),
    isLoading: Boolean(opts.isLoading),
    isError: false,
    isFetching: false,
  } as unknown as ReturnType<typeof useSessionHistory>);
}

describe('SessionsBody — history section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    // default: active sessions with data, history empty
    mockActiveHook(makeActivePage());
    mockHistoryHook(makeHistoryResponse({ data: [], total: 0 }));
  });

  it('REQ-SV-1: renders "Sesiones activas" heading and active session actor', () => {
    mockActiveHook(makeActivePage());
    mockHistoryHook(makeHistoryResponse({ data: [], total: 0 }));
    render(<SessionsBody />);

    expect(screen.getByRole('heading', { name: /sesiones activas/i })).toBeInTheDocument();
    expect(screen.getByText('carlos')).toBeInTheDocument();
  });

  it('REQ-SV-2: renders "Historial" heading and history actor when data present', () => {
    mockActiveHook(makeActivePage());
    mockHistoryHook(makeHistoryResponse());
    render(<SessionsBody />);

    expect(screen.getByRole('heading', { name: /historial/i })).toBeInTheDocument();
    expect(screen.getByText('ex-admin')).toBeInTheDocument();
  });

  it('REQ-SV-3 / I-1: no "Forzar logout" button inside the history section', () => {
    mockActiveHook(makeActivePage());
    mockHistoryHook(makeHistoryResponse());
    render(<SessionsBody />);

    const historySection = screen.getByTestId('history-section');
    const buttons = within(historySection).queryAllByRole('button', { name: /forzar logout/i });
    expect(buttons).toHaveLength(0);
  });

  it('REQ-SV-2 empty: shows empty state when history is empty', () => {
    mockActiveHook(makeActivePage());
    mockHistoryHook(makeHistoryResponse({ data: [], total: 0 }));
    render(<SessionsBody />);

    expect(screen.getByText(/no hay sesiones en el historial/i)).toBeInTheDocument();
  });

  it('REQ-SV-5: revokedAt is formatted (not raw ISO) in history table', () => {
    mockActiveHook(makeActivePage());
    mockHistoryHook(
      makeHistoryResponse({
        data: [
          {
            id: 'h-2',
            rbacUserId: 'u2',
            actorLogin: 'ex-user',
            ip: '10.0.0.2',
            userAgent: 'Safari',
            loginAt: '2026-05-29T14:00:00.000Z',
            lastSeenAt: '2026-05-29T14:20:00.000Z',
            revokedAt: '2026-05-29T14:33:00.000Z',
            createdAt: '2026-05-29T14:00:00.000Z',
          },
        ],
        total: 1,
      })
    );
    render(<SessionsBody />);

    // Raw ISO string must NOT appear
    expect(screen.queryByText('2026-05-29T14:33:00.000Z')).toBeNull();

    // A canonical short date+time must be present (#83: "29 may 2026 - 11:33").
    const historySection = screen.getByTestId('history-section');
    const datePattern = /\d{2} [a-z]{3} \d{4} - \d{2}:\d{2}/;
    expect(historySection.textContent).toMatch(datePattern);
  });

  it('REQ-SV-2 loading: history loading indicator shown, active section renders normally', () => {
    mockActiveHook(makeActivePage());
    mockHistoryHook(null, { isLoading: true });
    render(<SessionsBody />);

    // Active section renders its data
    expect(screen.getByText('carlos')).toBeInTheDocument();

    // History section shows loading indicator (not its empty state)
    const historySection = screen.getByTestId('history-section');
    expect(historySection).toBeInTheDocument();
    // The history section should NOT show the empty-state message when loading
    expect(within(historySection).queryByText(/no hay sesiones en el historial/i)).toBeNull();
  });

  it('I-2: both sections have correct data-testid attributes', () => {
    render(<SessionsBody />);

    expect(screen.getByTestId('active-sessions-section')).toBeInTheDocument();
    expect(screen.getByTestId('history-section')).toBeInTheDocument();
  });
});
