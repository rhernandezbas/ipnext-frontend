import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/iclassSoTypes.api', () => ({
  iclassSoTypesApi: {
    list: vi.fn(),
    sync: vi.fn(),
  },
}));

import { iclassSoTypesApi } from '@/api/iclassSoTypes.api';
import { useIClassSoTypes, useSyncIClassSoTypes } from '@/hooks/useIClassSoTypes';

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

describe('useIClassSoTypes', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
    vi.mocked(iclassSoTypesApi.list).mockResolvedValue([]);
  });

  it('calls api.list with no filter when active is undefined', async () => {
    const { result } = renderHook(() => useIClassSoTypes(), {
      wrapper: createWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(iclassSoTypesApi.list).toHaveBeenCalledWith(undefined);
  });

  it('calls api.list(true) when active is true', async () => {
    const { result } = renderHook(() => useIClassSoTypes(true), {
      wrapper: createWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(iclassSoTypesApi.list).toHaveBeenCalledWith(true);
  });

  it('returns the list as data', async () => {
    vi.mocked(iclassSoTypesApi.list).mockResolvedValue([
      {
        id: '1',
        code: 'INSTALACION FIBRA',
        description: 'PADRON',
        active: true,
        lastSyncedAt: '2026-05-28T12:00:00Z',
        createdAt: '2026-05-28T12:00:00Z',
        updatedAt: '2026-05-28T12:00:00Z',
      },
    ]);

    const { result } = renderHook(() => useIClassSoTypes(true), {
      wrapper: createWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].code).toBe('INSTALACION FIBRA');
  });
});

describe('useSyncIClassSoTypes', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls api.sync and returns the summary', async () => {
    vi.mocked(iclassSoTypesApi.sync).mockResolvedValue({
      synced: 26,
      created: 1,
      updated: 25,
      reactivated: 0,
      deactivated: 0,
    });

    const { result } = renderHook(() => useSyncIClassSoTypes(), {
      wrapper: createWrapper(qc),
    });

    const summary = await act(() => result.current.mutateAsync());
    expect(iclassSoTypesApi.sync).toHaveBeenCalled();
    expect(summary).toEqual({
      synced: 26,
      created: 1,
      updated: 25,
      reactivated: 0,
      deactivated: 0,
    });
  });

  it('invalidates iclassSoTypes queries on success', async () => {
    vi.mocked(iclassSoTypesApi.sync).mockResolvedValue({
      synced: 0,
      created: 0,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
    });

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSyncIClassSoTypes(), {
      wrapper: createWrapper(qc),
    });

    await act(() => result.current.mutateAsync());

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['iclassSoTypes'],
    });
  });
});
