import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { DepotStockDTO } from '@/types/depot';

vi.mock('@/api/depot.api', () => ({
  getDepotStock: vi.fn(),
}));

import { getDepotStock } from '@/api/depot.api';
import { useDepotStock } from '@/hooks/useDepotStock';

const populated: DepotStockDTO = {
  assets: [
    {
      id: 'a1',
      serialNumber: 'SN-001',
      mac: null,
      deviceTypeId: 'dt1',
      deviceTypeName: 'ont',
      deviceTypeLabel: 'ONT',
      status: 'available',
      sourceTaskId: null,
    },
  ],
  materials: [
    { id: 'm1', materialCatalogId: 'mc1', name: 'cable', label: 'Cable UTP', unit: 'm', qty: 50 },
  ],
  depotLocationId: 'loc-depot',
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDepotStock', () => {
  it('exposes data once the depot stock resolves', async () => {
    vi.mocked(getDepotStock).mockResolvedValue(populated);

    const { result } = renderHook(() => useDepotStock(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(populated);
    expect(getDepotStock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error state when the request fails', async () => {
    vi.mocked(getDepotStock).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useDepotStock(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
