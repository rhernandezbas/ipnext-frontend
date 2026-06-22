/**
 * useRetireInstalledItem — TDD suite
 *
 * Covers:
 * 1. calls retireInstalledItem with the contract/item/input
 * 2. invalidates the contract inventory query on success
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { ServiceInstalledItem } from '@/types/serviceInventory';

vi.mock('@/api/serviceInventory.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/serviceInventory.api')>();
  return { ...actual, retireInstalledItem: vi.fn() };
});

import { retireInstalledItem } from '@/api/serviceInventory.api';
import { useRetireInstalledItem } from '@/hooks/useServiceInventory';

const removed: ServiceInstalledItem = {
  id: 'item-1',
  serviceId: 'ctr-1',
  type: 'ANTENA',
  serialNumber: null,
  mac: null,
  model: null,
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: null,
  confirmedAt: null,
  status: 'removed',
  notes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRetireInstalledItem', () => {
  it('calls retireInstalledItem with the contract id, item id and input', async () => {
    vi.mocked(retireInstalledItem).mockResolvedValue(removed);
    const qc = makeClient();

    const { result } = renderHook(() => useRetireInstalledItem('ctr-1'), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ itemId: 'item-1', input: { disposition: 'TECNICO', technicianId: 'tech-9', note: 'ok' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(retireInstalledItem).toHaveBeenCalledWith('ctr-1', 'item-1', {
      disposition: 'TECNICO',
      technicianId: 'tech-9',
      note: 'ok',
    });
  });

  it('invalidates the contract inventory query on success', async () => {
    vi.mocked(retireInstalledItem).mockResolvedValue(removed);
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRetireInstalledItem('ctr-1'), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ itemId: 'item-1', input: { disposition: 'DEPOSITO' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['service-inventory', 'ctr-1'] });
  });
});
