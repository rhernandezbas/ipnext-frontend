/**
 * Tests for useSessionHistory — mocks the api layer.
 * Separate from useSessions.test.ts to avoid modifying existing mock shape.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SessionHistoryResponse } from '@/api/sessions.api';

vi.mock('@/api/sessions.api', () => ({
  sessionsApi: {
    list: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    getHistory: vi.fn(),
  },
}));

import { sessionsApi } from '@/api/sessions.api';
import { useSessionHistory, SESSION_HISTORY_QUERY_KEY } from '@/hooks/useSessions';

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

function createWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('useSessionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls sessionsApi.getHistory with default params (page=1, pageSize=20)', async () => {
    vi.mocked(sessionsApi.getHistory).mockResolvedValue(makeHistoryResponse());

    const qc = makeQC();
    const { result } = renderHook(() => useSessionHistory(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sessionsApi.getHistory).toHaveBeenCalledWith(1, 20);
  });

  it('calls sessionsApi.getHistory with explicit params', async () => {
    vi.mocked(sessionsApi.getHistory).mockResolvedValue(makeHistoryResponse({ page: 2, pageSize: 10 }));

    const qc = makeQC();
    const { result } = renderHook(() => useSessionHistory(2, 10), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sessionsApi.getHistory).toHaveBeenCalledWith(2, 10);
  });

  it('returns the full response object in result.current.data', async () => {
    const response = makeHistoryResponse({ total: 25, page: 1, pageSize: 20 });
    vi.mocked(sessionsApi.getHistory).mockResolvedValue(response);

    const qc = makeQC();
    const { result } = renderHook(() => useSessionHistory(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });

  it('isLoading is true before the query resolves', () => {
    vi.mocked(sessionsApi.getHistory).mockImplementation(
      () => new Promise(() => { /* never resolves */ })
    );

    const qc = makeQC();
    const { result } = renderHook(() => useSessionHistory(), { wrapper: createWrapper(qc) });

    expect(result.current.isLoading).toBe(true);
  });

  it('SESSION_HISTORY_QUERY_KEY is exported and has correct shape', () => {
    expect(SESSION_HISTORY_QUERY_KEY).toEqual(['admin', 'sessions', 'history']);
  });
});
