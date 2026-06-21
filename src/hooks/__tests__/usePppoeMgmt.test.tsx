import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  useContractPppoe,
  useCreatePppoe,
  useDeactivatePppoe,
} from '../usePppoe';
import type { PppoeServiceDto } from '@/types/pppoe';

vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    preview: vi.fn(),
    startBulk: vi.fn(),
    getBatch: vi.fn(),
    enforce: vi.fn(),
    listByContract: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
    deactivate: vi.fn(),
  },
}));

import { pppoeApi } from '@/api/pppoe.api';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PPPOE_DTO: PppoeServiceDto = {
  id: 'pppoe-1',
  username: 'cliente01',
  profile: 'IP-5M',
  remoteAddress: '10.0.0.1',
  status: 'active',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'contract-1',
  createdAt: '2026-06-17T00:00:00.000Z',
};

beforeEach(() => vi.clearAllMocks());

describe('useContractPppoe', () => {
  it('fetchea la lista de PPPoE del contrato con el contractId correcto', async () => {
    vi.mocked(pppoeApi.listByContract).mockResolvedValue([PPPOE_DTO]);

    const { result } = renderHook(() => useContractPppoe('contract-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([PPPOE_DTO]);
    expect(pppoeApi.listByContract).toHaveBeenCalledWith('contract-1');
  });

  it('NO fetchea cuando contractId está vacío', async () => {
    const { result } = renderHook(() => useContractPppoe(''), { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe('idle');
    expect(pppoeApi.listByContract).not.toHaveBeenCalled();
  });
});

describe('useCreatePppoe', () => {
  it('llama a pppoeApi.create con contractId correcto y retorna el DTO', async () => {
    vi.mocked(pppoeApi.create).mockResolvedValue(PPPOE_DTO);

    const { result } = renderHook(() => useCreatePppoe('contract-1', 'client-42'), { wrapper });

    await act(async () => {
      const out = await result.current.mutateAsync({
        username: 'cliente01',
        password: 'secret',
        nasId: 'nas-1',
      });
      expect(out).toEqual(PPPOE_DTO);
    });

    expect(pppoeApi.create).toHaveBeenCalledWith('contract-1', {
      username: 'cliente01',
      password: 'secret',
      nasId: 'nas-1',
    });
  });

  it('invalida cache ["contract-pppoe", contractId] y ["client-contracts", clientId] al tener éxito', async () => {
    vi.mocked(pppoeApi.create).mockResolvedValue(PPPOE_DTO);

    // Use a real QC to spy on invalidation
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const testWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreatePppoe('contract-1', 'client-42'), {
      wrapper: testWrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        username: 'cliente01',
        password: 'secret',
        nasId: 'nas-1',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contract-pppoe', 'contract-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'client-42'] });
  });
});

describe('useDeactivatePppoe', () => {
  it('llama a pppoeApi.deactivate con el id y reason correctos', async () => {
    vi.mocked(pppoeApi.deactivate).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeactivatePppoe('contract-1', 'client-42'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1', reason: 'Cliente solicitó baja' });
    });

    expect(pppoeApi.deactivate).toHaveBeenCalledWith('pppoe-1', 'Cliente solicitó baja');
  });

  it('invalida cache ["contract-pppoe", contractId] y ["client-contracts", clientId] al tener éxito', async () => {
    vi.mocked(pppoeApi.deactivate).mockResolvedValue(undefined);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const testWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeactivatePppoe('contract-1', 'client-42'), {
      wrapper: testWrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pppoe-1' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contract-pppoe', 'contract-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['client-contracts', 'client-42'] });
  });

  it('propaga el error 502 (router caído) como error para que el caller lo maneje', async () => {
    const err = Object.assign(new Error('bad gateway'), { response: { status: 502 } });
    vi.mocked(pppoeApi.deactivate).mockRejectedValue(err);

    const { result } = renderHook(() => useDeactivatePppoe('contract-1', 'client-42'), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'pppoe-1' }),
    ).rejects.toMatchObject({ response: { status: 502 } });
  });
});
