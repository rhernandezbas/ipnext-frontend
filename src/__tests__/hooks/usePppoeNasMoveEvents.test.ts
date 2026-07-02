/**
 * Tests — pppoe-move-nas Wave 1 FE: usePppoeNasMoveEvents (TanStack Query).
 * Mockea el api layer y verifica passthrough de filtros + datos (patrón useAuditEvents).
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PaginatedPppoeNasMoveEvents } from '@/types/pppoeNasMove';

vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    listNasMoveEvents: vi.fn(),
  },
}));

import { pppoeApi } from '@/api/pppoe.api';
import { usePppoeNasMoveEvents } from '@/hooks/usePppoeNasMoveEvents';

function makePage(overrides: Partial<PaginatedPppoeNasMoveEvents> = {}): PaginatedPppoeNasMoveEvents {
  return {
    items: [
      {
        id: 'mv-1',
        username: 'cliente01',
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
    ...overrides,
  };
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('usePppoeNasMoveEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve la página del api (wire contract items/total/page/limit)', async () => {
    const page = makePage();
    vi.mocked(pppoeApi.listNasMoveEvents).mockResolvedValue(page);

    const { result } = renderHook(() => usePppoeNasMoveEvents({ page: 1, limit: 50 }), {
      wrapper: createWrapper(makeQC()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(page);
  });

  it('pasa los filtros outcome/trigger/username/page/limit al api', async () => {
    vi.mocked(pppoeApi.listNasMoveEvents).mockResolvedValue(makePage({ items: [], total: 0 }));

    const params = {
      page: 2,
      limit: 50,
      outcome: 'failed_no_free_ip' as const,
      trigger: 'auto' as const,
      username: 'juan',
    };
    const { result } = renderHook(() => usePppoeNasMoveEvents(params), {
      wrapper: createWrapper(makeQC()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pppoeApi.listNasMoveEvents).toHaveBeenCalledWith(params);
  });
});
