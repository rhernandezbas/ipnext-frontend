/**
 * Tests for useAddDepotAsset and useLoadDepotMaterial (EPIC #38 depot stock entry).
 * RED → GREEN: these tests were written before implementation.
 */
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import React from 'react';

vi.mock('@/api/depotEntry.api', () => ({
  depotEntryApi: {
    addAsset: vi.fn(),
    loadMaterial: vi.fn(),
  },
}));

vi.mock('@/hooks/useDepotStock', () => ({
  DEPOT_STOCK_QUERY_KEY: ['inventory', 'depot'],
  useDepotStock: vi.fn(),
}));

import { depotEntryApi } from '@/api/depotEntry.api';
import { useAddDepotAsset, useLoadDepotMaterial } from '@/hooks/useDepotEntry';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => vi.clearAllMocks());

describe('useAddDepotAsset', () => {
  it('calls depotEntryApi.addAsset with the exact payload', async () => {
    const response = { id: 'ast-1', deviceTypeId: 'dt-1', deviceTypeName: 'ONT', serialNumber: 'SN-001', mac: null, status: 'available' };
    vi.mocked(depotEntryApi.addAsset).mockResolvedValueOnce(response);

    const { result } = renderHook(() => useAddDepotAsset(), { wrapper });

    await act(async () => {
      result.current.mutate({ deviceTypeId: 'dt-1', serialNumber: 'SN-001' });
      await vi.waitFor(() => result.current.isSuccess);
    });

    expect(depotEntryApi.addAsset).toHaveBeenCalledWith({
      deviceTypeId: 'dt-1',
      serialNumber: 'SN-001',
    });
    expect(result.current.data).toEqual(response);
  });

  it('exposes the mutation error when the API rejects', async () => {
    vi.mocked(depotEntryApi.addAsset).mockRejectedValueOnce(new Error('409'));

    const { result } = renderHook(() => useAddDepotAsset(), { wrapper });

    await act(async () => {
      result.current.mutate({ deviceTypeId: 'dt-1', serialNumber: 'SN-001' });
      await vi.waitFor(() => result.current.isError);
    });

    expect(result.current.isError).toBe(true);
  });
});

describe('useLoadDepotMaterial', () => {
  it('calls depotEntryApi.loadMaterial with the exact payload', async () => {
    const response = { ok: true, materialCatalogId: 'mc-1', newQty: 150 };
    vi.mocked(depotEntryApi.loadMaterial).mockResolvedValueOnce(response);

    const { result } = renderHook(() => useLoadDepotMaterial(), { wrapper });

    await act(async () => {
      result.current.mutate({ materialCatalogId: 'mc-1', qty: 50 });
      await vi.waitFor(() => result.current.isSuccess);
    });

    expect(depotEntryApi.loadMaterial).toHaveBeenCalledWith({
      materialCatalogId: 'mc-1',
      qty: 50,
    });
    expect(result.current.data).toEqual(response);
  });

  it('exposes the mutation error when the API rejects', async () => {
    vi.mocked(depotEntryApi.loadMaterial).mockRejectedValueOnce(new Error('400'));

    const { result } = renderHook(() => useLoadDepotMaterial(), { wrapper });

    await act(async () => {
      result.current.mutate({ materialCatalogId: 'mc-1', qty: -5 });
      await vi.waitFor(() => result.current.isError);
    });

    expect(result.current.isError).toBe(true);
  });
});
