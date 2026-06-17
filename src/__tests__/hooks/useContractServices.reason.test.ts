/**
 * #127 — useRemoveContractService must thread `reason` through to the API call.
 */
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
import { useRemoveContractService } from '@/hooks/useContractServices';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => vi.clearAllMocks());

describe('useRemoveContractService — #127 reason threading', () => {
  it('passes reason through to contractServicesApi.remove', async () => {
    vi.mocked(contractServicesApi.remove).mockResolvedValue({} as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveContractService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        contractId: 'ct-9',
        id: 'cs-1',
        reason: 'Motivo de prueba',
      });
    });

    expect(contractServicesApi.remove).toHaveBeenCalledWith('ct-9', 'cs-1', 'Motivo de prueba');
  });

  it('passes undefined reason when reason is not provided', async () => {
    vi.mocked(contractServicesApi.remove).mockResolvedValue({} as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveContractService('cust-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ contractId: 'ct-9', id: 'cs-1' });
    });

    expect(contractServicesApi.remove).toHaveBeenCalledWith('ct-9', 'cs-1', undefined);
  });
});
