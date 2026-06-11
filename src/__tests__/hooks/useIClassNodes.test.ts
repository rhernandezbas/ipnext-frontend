import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/iclassNodes.api', () => ({
  getIClassNodes: vi.fn(),
  syncIClassNodes: vi.fn(),
}));

import { getIClassNodes, syncIClassNodes } from '@/api/iclassNodes.api';
import { useIClassNodes, useSyncIClassNodes } from '@/hooks/useIClassNodes';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe('useIClassNodes', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
    vi.mocked(getIClassNodes).mockResolvedValue([]);
  });

  // M1: the mapping table needs the FULL catalog (incl. inactive nodes) so a code
  // matching a deactivated node can render "(inactivo en IClass)" instead of the
  // misleading "(sin validar)". Eligibility (active+selectable) is filtered in the
  // component, not at the fetch. So the hook fetches with no filter.
  it('fetches the full node catalog (no filter)', async () => {
    const { result } = renderHook(() => useIClassNodes(), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getIClassNodes).toHaveBeenCalledWith();
  });

  it('returns the catalog as data', async () => {
    vi.mocked(getIClassNodes).mockResolvedValue([
      { id: 'n1', nodeId: 1, code: 'Mercedes', description: 'Mercedes', active: true, selectable: true, lastSyncedAt: '2026-06-01T12:00:00Z' },
    ]);
    const { result } = renderHook(() => useIClassNodes(), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].code).toBe('Mercedes');
  });
});

describe('useSyncIClassNodes', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls api.sync and returns the counts', async () => {
    vi.mocked(syncIClassNodes).mockResolvedValue({
      synced: 36, created: 36, updated: 0, reactivated: 0, deactivated: 0,
    });
    const { result } = renderHook(() => useSyncIClassNodes(), { wrapper: createWrapper(qc) });
    const summary = await act(() => result.current.mutateAsync());
    expect(syncIClassNodes).toHaveBeenCalled();
    expect(summary).toEqual({ synced: 36, created: 36, updated: 0, reactivated: 0, deactivated: 0 });
  });

  it('invalidates the iclass-nodes query on success', async () => {
    vi.mocked(syncIClassNodes).mockResolvedValue({
      synced: 0, created: 0, updated: 0, reactivated: 0, deactivated: 0,
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSyncIClassNodes(), { wrapper: createWrapper(qc) });
    await act(() => result.current.mutateAsync());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['iclass-nodes'] });
  });
});
