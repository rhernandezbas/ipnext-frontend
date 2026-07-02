/**
 * Tests — Task 5.3: useBulkChangePppoePlan hook
 * TDD estricto: RED → GREEN → REFACTOR
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useBulkChangePppoePlan, GLOBAL_LIST_KEY } from '@/hooks/usePppoe';

// ── mock de la API ─────────────────────────────────────────────────────────────
vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    bulkChangePlan: vi.fn().mockResolvedValue({ ok: ['id-1', 'id-2'], failed: [] }),
  },
}));

import { pppoeApi } from '@/api/pppoe.api';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useBulkChangePppoePlan', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(qc, 'invalidateQueries');
    vi.clearAllMocks();
  });

  it('llama a pppoeApi.bulkChangePlan con los ids, profile y reason', async () => {
    const { result } = renderHook(() => useBulkChangePppoePlan(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({
      ids: ['id-1', 'id-2'],
      profile: 'IP-50M',
      reason: 'promo',
    });

    expect(pppoeApi.bulkChangePlan).toHaveBeenCalledWith(
      ['id-1', 'id-2'],
      'IP-50M',
      'promo',
    );
  });

  it('invalida la query key de lista global en éxito', async () => {
    const { result } = renderHook(() => useBulkChangePppoePlan(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({
      ids: ['id-1'],
      profile: 'IP-10M',
    });

    await waitFor(() => {
      expect(qc.invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: GLOBAL_LIST_KEY }),
      );
    });
  });

  it('devuelve { ok, failed } del resultado', async () => {
    vi.mocked(pppoeApi.bulkChangePlan).mockResolvedValueOnce({
      ok: ['id-1'],
      failed: [{ id: 'id-2', username: 'u2', error: 'Router caído' }],
    });

    const { result } = renderHook(() => useBulkChangePppoePlan(), {
      wrapper: makeWrapper(qc),
    });

    const data = await result.current.mutateAsync({
      ids: ['id-1', 'id-2'],
      profile: 'IP-10M',
    });

    expect(data.ok).toEqual(['id-1']);
    expect(data.failed).toEqual([{ id: 'id-2', username: 'u2', error: 'Router caído' }]);
  });

  it('no invalida si la mutación falla', async () => {
    vi.mocked(pppoeApi.bulkChangePlan).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBulkChangePppoePlan(), {
      wrapper: makeWrapper(qc),
    });

    await expect(result.current.mutateAsync({ ids: ['id-1'], profile: 'IP-10M' })).rejects.toThrow();

    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it('funciona sin reason (opcional)', async () => {
    const { result } = renderHook(() => useBulkChangePppoePlan(), {
      wrapper: makeWrapper(qc),
    });

    await result.current.mutateAsync({ ids: ['id-1'], profile: 'IP-10M' });

    expect(pppoeApi.bulkChangePlan).toHaveBeenCalledWith(['id-1'], 'IP-10M', undefined);
  });
});
