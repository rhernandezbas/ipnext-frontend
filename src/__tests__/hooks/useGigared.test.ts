import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { GigaredAccount } from '@/types/gigared';

vi.mock('@/api/gigared.api', () => ({
  gigaredApi: {
    linkCic: vi.fn(),
  },
}));

import { gigaredApi } from '@/api/gigared.api';
import { useLinkCic, accountKey, SUMMARY_KEY } from '@/hooks/useGigared';

const account: GigaredAccount = {
  cic: '0000000001',
  gigaredId: 'g-1',
  email: 'a@b.com',
  firstName: 'Ana',
  lastName: 'García',
  registrationDate: '2026-01-01T00:00:00Z',
  services: [],
  internalId: 'cust-1',
  ott: null,
};

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

describe('useLinkCic', () => {
  it('passes { cic, contractId } through to the api', async () => {
    vi.mocked(gigaredApi.linkCic).mockResolvedValue({ account });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useLinkCic('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ cic: '0000000001', contractId: 'ct-9' });
    });

    expect(gigaredApi.linkCic).toHaveBeenCalledWith('cust-1', {
      cic: '0000000001',
      contractId: 'ct-9',
    });
  });

  // #47f — the link now reconciles the local 'TV' item onto the owner contract,
  // so the customer ContractsTab (['client-contracts', customerId]) must refresh
  // for the TV chip to appear — same invalidation the add/remove use.
  it('invalidates account + summary + client-contracts on success', async () => {
    vi.mocked(gigaredApi.linkCic).mockResolvedValue({ account, local: 'synced' });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useLinkCic('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ cic: '0000000001', contractId: 'ct-9' });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: accountKey('cust-1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: SUMMARY_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'cust-1'] });
  });
});
