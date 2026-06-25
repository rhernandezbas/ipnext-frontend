import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PppoeServiceListResult, InternetServiceEvent } from '@/types/internetService';

vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    list: vi.fn(),
    activationHistory: vi.fn(),
  },
}));

import { pppoeApi } from '@/api/pppoe.api';
import { useAllPppoe, useInternetActivationHistory } from '@/hooks/useInternetServices';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const listResult: PppoeServiceListResult = {
  data: [
    {
      id: 'p1',
      username: 'juan.perez',
      clientId: 'client-1',
      customerName: 'Juan Pérez',
      status: 'active',
      profile: '50M',
      nasId: 'nas-1',
      createdBy: 'operador1',
      createdAt: '2026-06-01T10:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

const events: InternetServiceEvent[] = [
  {
    id: 'e1',
    clientId: 'client-1',
    customerName: 'Juan Pérez',
    contractId: 'c1',
    // El BE graba eventType en INGLÉS (activated/deactivated/...), NO 'alta'/'baja'.
    eventType: 'activated',
    actorName: 'Operador Uno',
    reason: 'Alta nueva',
    createdAt: '2026-06-01T10:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAllPppoe', () => {
  it('fetches the paginated list and returns the wire shape', async () => {
    vi.mocked(pppoeApi.list).mockResolvedValueOnce(listResult);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllPppoe({}), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(listResult);
    expect(result.current.data?.total).toBe(1);
  });

  // ── Round-trip del filtro (lección del seam): el valor del filtro DEBE llegar al api ──
  it('round-trip: passes search/status/nasId/page/limit through to pppoeApi.list', async () => {
    vi.mocked(pppoeApi.list).mockResolvedValue(listResult);
    const { wrapper } = makeWrapper();
    const filter = { search: 'juan', status: 'active' as const, nasId: 'nas-1', page: 2, limit: 50 };
    renderHook(() => useAllPppoe(filter), { wrapper });

    await waitFor(() => expect(pppoeApi.list).toHaveBeenCalledWith(filter));
  });

  it('round-trip: a status change produces a NEW request with the new status', async () => {
    vi.mocked(pppoeApi.list).mockResolvedValue(listResult);
    const { wrapper } = makeWrapper();
    const { rerender } = renderHook(({ f }) => useAllPppoe(f), {
      wrapper,
      initialProps: { f: { status: '' as const } },
    });
    await waitFor(() => expect(pppoeApi.list).toHaveBeenCalledWith({ status: '' }));

    rerender({ f: { status: 'baja' as const } });
    await waitFor(() => expect(pppoeApi.list).toHaveBeenCalledWith({ status: 'baja' }));
  });

  it('keeps previous data across page changes (no flicker)', async () => {
    vi.mocked(pppoeApi.list).mockResolvedValue(listResult);
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ f }) => useAllPppoe(f), {
      wrapper,
      initialProps: { f: { page: 1 } },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ f: { page: 2 } });
    // placeholderData keeps the old data available while the next page loads.
    expect(result.current.data).toEqual(listResult);
  });
});

describe('useInternetActivationHistory', () => {
  it('fetches events newest-first', async () => {
    vi.mocked(pppoeApi.activationHistory).mockResolvedValueOnce(events);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useInternetActivationHistory({ clientId: 'client-1' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(events);
  });

  it('round-trip: passes the filter (clientId) through to the api', async () => {
    vi.mocked(pppoeApi.activationHistory).mockResolvedValue(events);
    const { wrapper } = makeWrapper();
    renderHook(() => useInternetActivationHistory({ clientId: 'client-1' }), { wrapper });
    await waitFor(() =>
      expect(pppoeApi.activationHistory).toHaveBeenCalledWith({ clientId: 'client-1' }),
    );
  });

  it('does not fetch while disabled (enabled=false)', async () => {
    vi.mocked(pppoeApi.activationHistory).mockResolvedValue(events);
    const { wrapper } = makeWrapper();
    renderHook(() => useInternetActivationHistory({ clientId: 'client-1' }, false), { wrapper });
    // give react-query a tick — the query must NOT run.
    await new Promise((r) => setTimeout(r, 20));
    expect(pppoeApi.activationHistory).not.toHaveBeenCalled();
  });
});
