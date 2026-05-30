/**
 * Tests for useSessions — mocks the api layer.
 * Asserts query passthrough for the list and that mutations call the api
 * and invalidate the sessions query on success.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SessionPage } from '@/types/session';

vi.mock('@/api/sessions.api', () => ({
  sessionsApi: {
    list: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
  },
}));

import { sessionsApi } from '@/api/sessions.api';
import {
  useActiveSessions,
  useRevokeSession,
  useRevokeAllSessions,
  SESSIONS_QUERY_KEY,
} from '@/hooks/useSessions';

function makePage(overrides: Partial<SessionPage> = {}): SessionPage {
  return {
    items: [
      {
        id: 's-1',
        rbacUserId: 'u1',
        actorLogin: 'admin',
        ip: '192.168.1.1',
        userAgent: 'Chrome',
        loginAt: '2026-05-01T10:00:00Z',
        lastSeenAt: '2026-05-01T11:00:00Z',
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

function createWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('useActiveSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the page data from the api', async () => {
    const page = makePage();
    vi.mocked(sessionsApi.list).mockResolvedValue(page);

    const qc = makeQC();
    const { result } = renderHook(() => useActiveSessions(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(page);
  });

  it('passes the query through to the api', async () => {
    vi.mocked(sessionsApi.list).mockResolvedValue(makePage());

    const qc = makeQC();
    const query = { rbacUserId: 'u1', page: 2, pageSize: 10 };
    const { result } = renderHook(() => useActiveSessions(query), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sessionsApi.list).toHaveBeenCalledWith(query);
  });
});

describe('useRevokeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the api revoke and invalidates the sessions query', async () => {
    vi.mocked(sessionsApi.revoke).mockResolvedValue(undefined);

    const qc = makeQC();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRevokeSession(), { wrapper: createWrapper(qc) });

    result.current.mutate('s-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sessionsApi.revoke).toHaveBeenCalledWith('s-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SESSIONS_QUERY_KEY });
  });
});

describe('useRevokeAllSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the api revokeAllForUser and invalidates the sessions query', async () => {
    vi.mocked(sessionsApi.revokeAllForUser).mockResolvedValue({ revoked: 3 });

    const qc = makeQC();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRevokeAllSessions(), { wrapper: createWrapper(qc) });

    result.current.mutate('u1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sessionsApi.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SESSIONS_QUERY_KEY });
  });
});
