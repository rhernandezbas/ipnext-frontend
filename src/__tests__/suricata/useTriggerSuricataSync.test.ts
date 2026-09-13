import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * suricata-tickets-mirror (fix wave, 2026-09-13) — "Sincronizar ahora": el
 * botón invalida lista + KPIs en éxito para reflejar el resultado sin
 * esperar el tick automático (15 min).
 */
vi.mock('@/pages/suricata/api/suricataClient', () => ({
  triggerSuricataSync: vi.fn(),
}));

import { triggerSuricataSync } from '@/pages/suricata/api/suricataClient';
import { useTriggerSuricataSync } from '@/pages/suricata/hooks/useSuricataTickets';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

describe('useTriggerSuricataSync', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls the sync endpoint and invalidates the tickets + kpis queries on success', async () => {
    vi.mocked(triggerSuricataSync).mockResolvedValue({ outcome: 'ok', ticketsUpserted: 21 });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useTriggerSuricataSync(), { wrapper: createWrapper(qc) });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(triggerSuricataSync).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ outcome: 'ok', ticketsUpserted: 21 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['suricata-tickets'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['suricata-kpis'] });
  });

  it('surfaces a rejected request as isError instead of throwing', async () => {
    vi.mocked(triggerSuricataSync).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useTriggerSuricataSync(), { wrapper: createWrapper(qc) });
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
