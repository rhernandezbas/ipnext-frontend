/**
 * TDD — useGigaredActivationHistory (tv-activation-history #5 FE).
 * Tests that the hook calls getActivationHistory with the correct filters
 * and returns the list of TvActivationEvent.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/gigared.api', () => ({
  gigaredApi: {
    getActivationHistory: vi.fn(),
  },
}));

import { gigaredApi } from '@/api/gigared.api';
import { useGigaredActivationHistory } from '@/hooks/useGigared';
import type { TvActivationEvent } from '@/types/gigared';

const events: TvActivationEvent[] = [
  {
    id: 'ev-1',
    clientId: 'cust-abc',
    customerName: 'Ana García',
    cic: '0000000001',
    eventType: 'alta',
    actorId: 'op-1',
    actorName: 'Operador Uno',
    internalId: 'cust-abc',
    seq: 0,
    contractId: 'ct-9',
    createdAt: '2026-06-13T10:30:00.000Z',
  },
  {
    id: 'ev-2',
    clientId: 'cust-def',
    customerName: 'Beto López',
    cic: '0000000002',
    eventType: 'baja',
    actorId: 'op-2',
    actorName: 'Operador Dos',
    internalId: null,
    seq: undefined,
    contractId: undefined,
    createdAt: '2026-06-12T09:00:00.000Z',
  },
];

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGigaredActivationHistory', () => {
  it('calls getActivationHistory with empty filters by default', async () => {
    vi.mocked(gigaredApi.getActivationHistory).mockResolvedValue(events);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGigaredActivationHistory({}), { wrapper });

    // Wait for the query to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(gigaredApi.getActivationHistory).toHaveBeenCalledWith({});
  });

  it('calls getActivationHistory with actorId filter', async () => {
    vi.mocked(gigaredApi.getActivationHistory).mockResolvedValue([events[0]]);
    const { wrapper } = makeWrapper();
    renderHook(() => useGigaredActivationHistory({ actorId: 'op-1' }), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(gigaredApi.getActivationHistory).toHaveBeenCalledWith({ actorId: 'op-1' });
  });

  it('calls getActivationHistory with from/to date filters', async () => {
    vi.mocked(gigaredApi.getActivationHistory).mockResolvedValue(events);
    const { wrapper } = makeWrapper();
    renderHook(
      () => useGigaredActivationHistory({ from: '2026-06-01', to: '2026-06-13' }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(gigaredApi.getActivationHistory).toHaveBeenCalledWith({
      from: '2026-06-01',
      to: '2026-06-13',
    });
  });

  it('calls getActivationHistory with customerId filter', async () => {
    vi.mocked(gigaredApi.getActivationHistory).mockResolvedValue([events[0]]);
    const { wrapper } = makeWrapper();
    renderHook(
      () => useGigaredActivationHistory({ customerId: 'cust-abc' }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(gigaredApi.getActivationHistory).toHaveBeenCalledWith({ customerId: 'cust-abc' });
  });

  it('returns the event list from the api', async () => {
    vi.mocked(gigaredApi.getActivationHistory).mockResolvedValue(events);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGigaredActivationHistory({}), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.data).toEqual(events);
  });

  it('exposes isLoading=true before data arrives', async () => {
    // Never resolves — hook starts in loading state
    vi.mocked(gigaredApi.getActivationHistory).mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGigaredActivationHistory({}), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('exposes isError=true when api rejects', async () => {
    vi.mocked(gigaredApi.getActivationHistory).mockRejectedValue(new Error('network error'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGigaredActivationHistory({}), { wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isError).toBe(true);
  });
});
