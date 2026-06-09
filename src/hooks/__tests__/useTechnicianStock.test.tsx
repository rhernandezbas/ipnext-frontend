import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { TechnicianStockDTO } from '@/types/technician';

vi.mock('@/api/technician.api', () => ({
  getTechnicianStock: vi.fn(),
  issueStockToTechnician: vi.fn(),
}));

import { getTechnicianStock, issueStockToTechnician } from '@/api/technician.api';
import {
  useTechnicianStock,
  useIssueStock,
  TECHNICIAN_STOCK_QUERY_KEY,
} from '@/hooks/useTechnicianStock';
import { DEPOT_STOCK_QUERY_KEY } from '@/hooks/useDepotStock';

const populated: TechnicianStockDTO = {
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
    { id: 'm1', materialCatalogId: 'mc1', name: 'cable', label: 'Cable UTP', unit: 'm', qty: 20 },
  ],
  locationId: 'loc-tecnico',
};

const empty: TechnicianStockDTO = { assets: [], materials: [], locationId: null };

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

describe('useTechnicianStock', () => {
  it('exposes the technician stock once it resolves', async () => {
    vi.mocked(getTechnicianStock).mockResolvedValue(populated);
    const qc = makeClient();

    const { result } = renderHook(() => useTechnicianStock('tech-1'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(populated);
    expect(getTechnicianStock).toHaveBeenCalledWith('tech-1');
  });

  it('returns the empty shape without error when the technician has no stock', async () => {
    vi.mocked(getTechnicianStock).mockResolvedValue(empty);
    const qc = makeClient();

    const { result } = renderHook(() => useTechnicianStock('tech-1'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.assets).toEqual([]);
    expect(result.current.data?.locationId).toBeNull();
  });
});

describe('useIssueStock', () => {
  it('calls the issue API and invalidates both technician and depot stock on success', async () => {
    vi.mocked(issueStockToTechnician).mockResolvedValue(undefined);
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useIssueStock('tech-1'), {
      wrapper: makeWrapper(qc),
    });

    const items = [{ assetId: 'a1' }];
    result.current.mutate({ items });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(issueStockToTechnician).toHaveBeenCalledWith('tech-1', { items });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: TECHNICIAN_STOCK_QUERY_KEY('tech-1'),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DEPOT_STOCK_QUERY_KEY });
  });
});
