/**
 * useConfirmSuggestion — B5 resolution param tests.
 * Strict TDD: written BEFORE the implementation.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock the API module ──────────────────────────────────────────────────────
vi.mock('@/api/serviceInventory.api', () => ({
  listServiceInstalledItems: vi.fn(),
  addInstalledItem: vi.fn(),
  updateInstalledItem: vi.fn(),
  deleteInstalledItem: vi.fn(),
  listTaskInventorySuggestions: vi.fn(),
  confirmInventorySuggestion: vi.fn(),
  discardInventorySuggestion: vi.fn(),
  correctSuggestionType: vi.fn(),
  replaceInventorySuggestion: vi.fn(),
}));

import * as apiModule from '@/api/serviceInventory.api';
import { useConfirmSuggestion } from '@/hooks/useServiceInventory';
import type { ConfirmSuggestionResult, ServiceInstalledItem } from '@/types/serviceInventory';

const mockApi = apiModule as unknown as {
  confirmInventorySuggestion: ReturnType<typeof vi.fn>;
};

function makeDeviceResult(): ConfirmSuggestionResult {
  return {
    kind: 'DEVICE',
    item: {
      id: 'item-1',
      serviceId: 'contract-1',
      type: 'ONU',
      serialNumber: null,
      mac: null,
      model: null,
      source: 'MANUAL',
      sourceTaskId: null,
      addedByUserId: null,
      addedByUserName: null,
      confirmedAt: null,
      status: 'active',
      notes: null,
      createdAt: '2026-06-01T00:00:00.000Z',
    } as ServiceInstalledItem,
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  };
}

describe('useConfirmSuggestion — resolution param (B5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes resolution:"add" to the API when provided', async () => {
    const { wrapper } = makeWrapper();
    mockApi.confirmInventorySuggestion.mockResolvedValue(makeDeviceResult());

    const { result } = renderHook(
      () => useConfirmSuggestion('task-1'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ suggestionId: 'sug-1', resolution: 'add' });
    });

    expect(mockApi.confirmInventorySuggestion).toHaveBeenCalledWith('task-1', 'sug-1', undefined, 'add');
  });

  it('passes resolution:"link_existing" to the API when provided', async () => {
    const { wrapper } = makeWrapper();
    mockApi.confirmInventorySuggestion.mockResolvedValue(makeDeviceResult());

    const { result } = renderHook(
      () => useConfirmSuggestion('task-1'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ suggestionId: 'sug-1', resolution: 'link_existing' });
    });

    expect(mockApi.confirmInventorySuggestion).toHaveBeenCalledWith('task-1', 'sug-1', undefined, 'link_existing');
  });

  it('works without resolution (backward compat — undefined)', async () => {
    const { wrapper } = makeWrapper();
    mockApi.confirmInventorySuggestion.mockResolvedValue(makeDeviceResult());

    const { result } = renderHook(
      () => useConfirmSuggestion('task-1'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ suggestionId: 'sug-1' });
    });

    expect(mockApi.confirmInventorySuggestion).toHaveBeenCalledWith('task-1', 'sug-1', undefined, undefined);
  });

  it('onSuccess with resolution invalidates suggestions + items keys', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    mockApi.confirmInventorySuggestion.mockResolvedValue(makeDeviceResult());

    const { result } = renderHook(
      () => useConfirmSuggestion('task-1', 'contract-42'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ suggestionId: 'sug-1', resolution: 'link_existing' });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['task-inventory-suggestions', 'task-1'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['service-inventory', 'contract-42'] }),
      );
    });
  });
});
