import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/api/contract-services.api', () => ({
  contractServicesApi: {
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getHistory: vi.fn(),
  },
}));

import { contractServicesApi } from '@/api/contract-services.api';
import {
  useAddContractService,
  useUpdateContractService,
  useRemoveContractService,
} from '@/hooks/useContractServices';

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

// #73 re-review — the service-line mutations change what the ServiceHistoryModal
// renders (a line added/updated/removed shows as a new/updated history row). The
// history query (['contract-service-history', contractId], staleTime 60s) must be
// invalidated alongside ['client-contracts'] or the modal shows stale rows for up
// to a minute. We invalidate the ROOT ['contract-service-history'] (every contract
// variant) — simpler and safe.
describe('useAddContractService', () => {
  it('passes contractId + payload through to the api', async () => {
    vi.mocked(contractServicesApi.add).mockResolvedValue({} as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAddContractService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9', payload: { serviceCatalogId: 'sc-1' } });
    });

    expect(contractServicesApi.add).toHaveBeenCalledWith('ct-9', { serviceCatalogId: 'sc-1' });
  });

  it('invalidates client-contracts AND the service-history root on success', async () => {
    vi.mocked(contractServicesApi.add).mockResolvedValue({} as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useAddContractService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9', payload: { serviceCatalogId: 'sc-1' } });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'cust-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-service-history'] });
  });
});

describe('useUpdateContractService', () => {
  it('invalidates client-contracts AND the service-history root on success', async () => {
    vi.mocked(contractServicesApi.update).mockResolvedValue({} as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateContractService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9', id: 'cs-1', payload: { status: 'inactive' } });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'cust-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-service-history'] });
  });
});

describe('useRemoveContractService', () => {
  it('invalidates client-contracts AND the service-history root on success', async () => {
    vi.mocked(contractServicesApi.remove).mockResolvedValue({} as never);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useRemoveContractService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9', id: 'cs-1' });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'cust-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contract-service-history'] });
  });
});
