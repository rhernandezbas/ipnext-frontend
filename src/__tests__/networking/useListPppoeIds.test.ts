/**
 * TDD — useListPppoeIds hook (pppoe-bulk-select-filter v2, task 3.2).
 * On-demand fetch of filtered ids (imperative `mutateAsync`, NOT useQuery
 * cacheado) — feeds the "Seleccionar los N del filtro" button. It's a READ:
 * no cache invalidation on success.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useListPppoeIds } from '@/hooks/usePppoe';

vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    listIds: vi.fn().mockResolvedValue({ ids: ['id-1', 'id-2'], total: 2 }),
  },
}));

import { pppoeApi } from '@/api/pppoe.api';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useListPppoeIds', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(qc, 'invalidateQueries');
    vi.clearAllMocks();
  });

  it('llama a pppoeApi.listIds con el filtro vigente', async () => {
    const { result } = renderHook(() => useListPppoeIds(), { wrapper: makeWrapper(qc) });

    await result.current.mutateAsync({ nasId: 'nas-1', includeUnassigned: true });

    expect(pppoeApi.listIds).toHaveBeenCalledWith({ nasId: 'nas-1', includeUnassigned: true });
  });

  it('devuelve { ids, total } del resultado', async () => {
    const { result } = renderHook(() => useListPppoeIds(), { wrapper: makeWrapper(qc) });

    const data = await result.current.mutateAsync({ search: 'juan' });

    expect(data).toEqual({ ids: ['id-1', 'id-2'], total: 2 });
  });

  it('expone isPending mientras la promesa está en vuelo', async () => {
    let resolvePromise!: (v: { ids: string[]; total: number }) => void;
    vi.mocked(pppoeApi.listIds).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useListPppoeIds(), { wrapper: makeWrapper(qc) });
    expect(result.current.isPending).toBe(false);

    const promise = result.current.mutateAsync({ status: 'active' });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise({ ids: [], total: 0 });
    await promise;
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('NO invalida ninguna query en éxito (es una lectura on-demand)', async () => {
    const { result } = renderHook(() => useListPppoeIds(), { wrapper: makeWrapper(qc) });
    await result.current.mutateAsync({ nasId: 'nas-1' });
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it('propaga el rechazo (isError) cuando pppoeApi.listIds falla (ej. 400 FILTER_REQUIRED)', async () => {
    vi.mocked(pppoeApi.listIds).mockRejectedValueOnce({
      response: { status: 400, data: { code: 'FILTER_REQUIRED' } },
    });

    const { result } = renderHook(() => useListPppoeIds(), { wrapper: makeWrapper(qc) });

    await expect(result.current.mutateAsync({})).rejects.toBeTruthy();
  });
});
