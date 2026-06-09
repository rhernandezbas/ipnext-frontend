import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReturnSuggestion } from '@/types/returns';

vi.mock('@/api/returns.api', () => ({
  getPendingReturns: vi.fn(),
  confirmReturn: vi.fn(),
  discardReturn: vi.fn(),
}));

import * as api from '@/api/returns.api';
import {
  usePendingReturns,
  useConfirmReturn,
  useDiscardReturn,
  PENDING_RETURNS_QUERY_KEY,
} from '@/hooks/useReturns';

const list: ReturnSuggestion[] = [
  {
    id: 'r1',
    serviceOrderId: 'so-1',
    serialNumber: 'SN-001',
    matchedAssetId: 'asset-1',
    status: 'pending',
    createdAt: '2026-06-01T10:00:00.000Z',
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

describe('usePendingReturns', () => {
  it('fetches the pending returns list', async () => {
    vi.mocked(api.getPendingReturns).mockResolvedValue(list);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => usePendingReturns(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(list);
    expect(api.getPendingReturns).toHaveBeenCalledOnce();
  });
});

describe('useConfirmReturn', () => {
  it('confirms and invalidates the pending list on success', async () => {
    vi.mocked(api.confirmReturn).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useConfirmReturn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'r1', input: { resolution: 'return' } });
    });

    expect(api.confirmReturn).toHaveBeenCalledWith('r1', { resolution: 'return' });
    expect(spy).toHaveBeenCalledWith({ queryKey: PENDING_RETURNS_QUERY_KEY });
  });
});

describe('useDiscardReturn', () => {
  it('discards and invalidates the pending list on success', async () => {
    vi.mocked(api.discardReturn).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDiscardReturn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('r1');
    });

    expect(api.discardReturn).toHaveBeenCalledWith('r1');
    expect(spy).toHaveBeenCalledWith({ queryKey: PENDING_RETURNS_QUERY_KEY });
  });
});
