import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { GigaredAccount } from '@/types/gigared';

vi.mock('@/api/gigared.api', () => ({
  gigaredApi: {
    linkCic: vi.fn(),
    cancelTv: vi.fn(),
    registerAccount: vi.fn(),
    addService: vi.fn(),
    removeService: vi.fn(),
    setOtt: vi.fn(),
  },
}));

import { gigaredApi } from '@/api/gigared.api';
import {
  useLinkCic,
  useCancelTv,
  useRegisterAccount,
  useAddTvService,
  useRemoveTvService,
  useSetOtt,
  accountKey,
  SUMMARY_KEY,
  ALL_ACCOUNTS_ROOT,
} from '@/hooks/useGigared';

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

  // #61 fix wave — the TV page now reads ['gigared','all-accounts',status]. Linking
  // sets internalId (the name link) and reconciles status, so the all-accounts list
  // must be invalidated or the page shows stale rows for up to 5 min.
  it('invalidates the all-accounts root on success (#61 fix wave)', async () => {
    vi.mocked(gigaredApi.linkCic).mockResolvedValue({ account, local: 'synced' });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useLinkCic('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ cic: '0000000001', contractId: 'ct-9' });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ALL_ACCOUNTS_ROOT });
  });
});

// #47k — dar de baja TV: removes all packs, frees the partner cupo, disables OTT
// and inactivates the local TV item. On success it must refresh the account, the
// partner summary (cupo changed) and the customer ContractsTab (chip drops).
describe('useCancelTv', () => {
  it('passes { contractId } through to the api', async () => {
    vi.mocked(gigaredApi.cancelTv).mockResolvedValue({
      removed: ['s1'],
      failed: [],
      ottDisabled: true,
      local: 'synced',
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelTv('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9' });
    });

    expect(gigaredApi.cancelTv).toHaveBeenCalledWith('cust-1', { contractId: 'ct-9' });
  });

  it('invalidates account + summary + client-contracts on success', async () => {
    vi.mocked(gigaredApi.cancelTv).mockResolvedValue({
      removed: ['s1'],
      failed: [],
      ottDisabled: true,
      local: 'synced',
    });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCancelTv('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9' });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: accountKey('cust-1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: SUMMARY_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'cust-1'] });
  });

  it('invalidates the all-accounts root on success (#61 fix wave)', async () => {
    vi.mocked(gigaredApi.cancelTv).mockResolvedValue({
      removed: ['s1'], failed: [], ottDisabled: true, local: 'synced',
    });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCancelTv('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9' });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ALL_ACCOUNTS_ROOT });
  });
});

// #61 fix wave — every gigared mutation that changes what the TV list renders
// (internalId/status via register, services via add/remove, OTT column via setOtt)
// must invalidate ['gigared','all-accounts'] so the page does not show stale rows.
describe('#61 fix wave — all-accounts invalidation across mutations', () => {
  it('useRegisterAccount invalidates the all-accounts root', async () => {
    vi.mocked(gigaredApi.registerAccount).mockResolvedValue({ account });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRegisterAccount('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ cic: '0000000001' } as never);
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ALL_ACCOUNTS_ROOT });
  });

  it('useAddTvService invalidates the all-accounts root', async () => {
    vi.mocked(gigaredApi.addService).mockResolvedValue({} as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useAddTvService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ serviceId: 's1', contractId: 'ct-9' } as never);
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ALL_ACCOUNTS_ROOT });
  });

  it('useRemoveTvService invalidates the all-accounts root', async () => {
    vi.mocked(gigaredApi.removeService).mockResolvedValue({} as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRemoveTvService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ serviceId: 's1', contractId: 'ct-9' });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ALL_ACCOUNTS_ROOT });
  });

  it('useSetOtt invalidates the all-accounts root', async () => {
    vi.mocked(gigaredApi.setOtt).mockResolvedValue({} as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSetOtt('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ enabled: true } as never);
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ALL_ACCOUNTS_ROOT });
  });
});
