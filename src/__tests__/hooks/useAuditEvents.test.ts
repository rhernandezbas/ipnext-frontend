/**
 * Tests for useAuditEvents — mocks the api layer, asserts query passthrough + data.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AuditEventPage } from '@/types/audit';

vi.mock('@/api/auditEvents.api', () => ({
  auditEventsApi: {
    list: vi.fn(),
  },
}));

import { auditEventsApi } from '@/api/auditEvents.api';
import { useAuditEvents } from '@/hooks/useAuditEvents';

function makePage(overrides: Partial<AuditEventPage> = {}): AuditEventPage {
  return {
    items: [
      {
        id: 'ae-1',
        actorId: 'u1',
        actorLogin: 'admin',
        method: 'POST',
        path: '/api/clients',
        action: 'create',
        entityType: 'Client',
        entityId: '1001',
        beforeJson: null,
        afterJson: { name: 'Acme' },
        statusCode: 201,
        errorMessage: null,
        ip: '192.168.1.1',
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

describe('useAuditEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the page data from the api', async () => {
    const page = makePage();
    vi.mocked(auditEventsApi.list).mockResolvedValue(page);

    const qc = makeQC();
    const { result } = renderHook(() => useAuditEvents(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(page);
  });

  it('passes the query through to the api', async () => {
    vi.mocked(auditEventsApi.list).mockResolvedValue(makePage());

    const qc = makeQC();
    const query = { method: 'DELETE', entityType: 'Client', page: 2, pageSize: 10 };
    const { result } = renderHook(() => useAuditEvents(query), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auditEventsApi.list).toHaveBeenCalledWith(query);
  });
});
