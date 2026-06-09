/**
 * useClientInstalledItems — B1 hook tests (EPIC #38 W2).
 * Strict TDD: written BEFORE the implementation.
 *
 * GC-7 convention: a 404 from the BE (route not yet deployed) must degrade to
 * an empty list, NOT an error — the tab shows its empty state gracefully.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/serviceInventory.api', () => ({
  listClientEquipment: vi.fn(),
}));

import * as apiModule from '@/api/serviceInventory.api';
import { useClientInstalledItems } from '@/hooks/useServiceInventory';
import type { ClientInstalledItem } from '@/types/serviceInventory';

const mockApi = apiModule as unknown as {
  listClientEquipment: ReturnType<typeof vi.fn>;
};

function makeItem(over: Partial<ClientInstalledItem> = {}): ClientInstalledItem {
  return {
    id: 'cii-1',
    type: 'ONU',
    serialNumber: 'SN-001',
    mac: null,
    model: null,
    status: 'active',
    source: 'MANUAL',
    confirmedAt: null,
    assetId: null,
    contractId: 'contract-1',
    contractPlan: 'Plan 50MB',
    contractType: 'fiber',
    ...over,
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  };
}

describe('useClientInstalledItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the items on a 200 response', async () => {
    const { wrapper } = makeWrapper();
    const items = [makeItem(), makeItem({ id: 'cii-2', contractId: 'contract-2' })];
    mockApi.listClientEquipment.mockResolvedValue(items);

    const { result } = renderHook(() => useClientInstalledItems('client-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.listClientEquipment).toHaveBeenCalledWith('client-1');
    expect(result.current.data).toEqual(items);
  });

  it('returns [] (not an error) when the API responds 404 — GC-7', async () => {
    const { wrapper } = makeWrapper();
    mockApi.listClientEquipment.mockRejectedValue({ response: { status: 404 } });

    const { result } = renderHook(() => useClientInstalledItems('client-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it('propagates non-404 errors', async () => {
    const { wrapper } = makeWrapper();
    mockApi.listClientEquipment.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderHook(() => useClientInstalledItems('client-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not run the query when clientId is undefined', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useClientInstalledItems(undefined), { wrapper });
    expect(mockApi.listClientEquipment).not.toHaveBeenCalled();
  });
});
