/**
 * useCorrectSuggestionType — B4 invalidation tests.
 * Strict TDD: written BEFORE the hook implementation.
 *
 * Mirrors the useDeviceTypes.test.ts pattern for hook testing.
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
}));

import * as apiModule from '@/api/serviceInventory.api';
import { useCorrectSuggestionType } from '@/hooks/useServiceInventory';
import type { ServiceInstalledItem } from '@/types/serviceInventory';

const mockApi = apiModule as unknown as {
  correctSuggestionType: ReturnType<typeof vi.fn>;
};

function makeItem(over: Partial<ServiceInstalledItem> = {}): ServiceInstalledItem {
  return {
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
    ...over,
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

describe('useCorrectSuggestionType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('onSuccess invalidates ["task-inventory-suggestions", taskId]', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    mockApi.correctSuggestionType.mockResolvedValue(makeItem({ type: 'ANTENA' }));

    const { result } = renderHook(
      () => useCorrectSuggestionType('task-1'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ suggestionId: 'sug-1', type: 'ANTENA' });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['task-inventory-suggestions', 'task-1'] }),
      );
    });
  });

  it('onSuccess invalidates ["service-inventory", contractId] when contractId provided', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    mockApi.correctSuggestionType.mockResolvedValue(makeItem({ type: 'ANTENA' }));

    const { result } = renderHook(
      () => useCorrectSuggestionType('task-1', 'contract-42'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ suggestionId: 'sug-1', type: 'ANTENA' });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['service-inventory', 'contract-42'] }),
      );
    });
  });

  it('onSuccess invalidates ["service-inventory"] broadly when no contractId', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    mockApi.correctSuggestionType.mockResolvedValue(makeItem({ type: 'ANTENA' }));

    const { result } = renderHook(
      () => useCorrectSuggestionType('task-1'),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ suggestionId: 'sug-1', type: 'ANTENA' });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['service-inventory'] }),
      );
    });
  });
});
