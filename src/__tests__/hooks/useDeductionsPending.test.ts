import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DeductionSuggestion } from '@/types/deductions';

vi.mock('@/api/deductions.api', () => ({
  getPendingDeductions: vi.fn(),
  confirmDeduction: vi.fn(),
  discardDeduction: vi.fn(),
}));

import * as api from '@/api/deductions.api';
import {
  useDeductionsPending,
  useConfirmDeduction,
  useDiscardDeduction,
  PENDING_DEDUCTIONS_QUERY_KEY,
} from '@/hooks/useDeductionsPending';

const list: DeductionSuggestion[] = [
  {
    id: 'd1',
    consumptionId: 'c1',
    taskId: 't1',
    taskSeq: 42,
    taskTitle: 'Instalación fibra',
    materialId: 'm1',
    materialName: 'Cable coaxial',
    materialUnit: 'm',
    qty: 10,
    technicianId: 'tech-1',
    technicianName: 'Juan Pérez',
    status: 'pending',
    createdAt: '2026-06-01T10:00:00.000Z',
  },
];

const needsReviewItem: DeductionSuggestion = {
  id: 'd2',
  consumptionId: 'c2',
  materialId: 'm2',
  materialName: 'Conector RJ45',
  qty: 5,
  status: 'needs_review',
  createdAt: '2026-06-02T10:00:00.000Z',
};

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

describe('useDeductionsPending', () => {
  it('fetches the pending deductions list', async () => {
    vi.mocked(api.getPendingDeductions).mockResolvedValue(list);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeductionsPending(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(list);
    expect(api.getPendingDeductions).toHaveBeenCalledOnce();
  });

  it('returns empty array when no deductions pending', async () => {
    vi.mocked(api.getPendingDeductions).mockResolvedValue([]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeductionsPending(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(result.current.data).toHaveLength(0);
  });
});

describe('useConfirmDeduction', () => {
  it('confirms a pending deduction and invalidates the pending list on success', async () => {
    vi.mocked(api.confirmDeduction).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useConfirmDeduction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'd1', input: { resolution: 'deduct' } });
    });

    expect(api.confirmDeduction).toHaveBeenCalledWith('d1', { resolution: 'deduct' });
    expect(spy).toHaveBeenCalledWith({ queryKey: PENDING_DEDUCTIONS_QUERY_KEY });
  });

  it('confirms a needs_review deduction with issue-first resolution and invalidates list', async () => {
    vi.mocked(api.confirmDeduction).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useConfirmDeduction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'd2', input: { resolution: 'issue-first' } });
    });

    expect(api.confirmDeduction).toHaveBeenCalledWith('d2', { resolution: 'issue-first' });
    expect(spy).toHaveBeenCalledWith({ queryKey: PENDING_DEDUCTIONS_QUERY_KEY });
  });

  it('re-fetches pending list on 409 DEDUCTION_ALREADY_CONFIRMED error', async () => {
    const conflict = Object.assign(new Error('Conflict'), {
      response: { status: 409, data: { code: 'DEDUCTION_ALREADY_CONFIRMED' } },
    });
    vi.mocked(api.confirmDeduction).mockRejectedValue(conflict);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useConfirmDeduction(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'd1', input: { resolution: 'deduct' } });
      } catch {
        // expected to throw
      }
    });

    // On error the hook must still refetch the list so UI reflects latest state
    expect(spy).toHaveBeenCalledWith({ queryKey: PENDING_DEDUCTIONS_QUERY_KEY });
  });
});

describe('useDiscardDeduction', () => {
  it('discards and invalidates the pending list on success', async () => {
    vi.mocked(api.discardDeduction).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDiscardDeduction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(needsReviewItem.id);
    });

    expect(api.discardDeduction).toHaveBeenCalledWith('d2');
    expect(spy).toHaveBeenCalledWith({ queryKey: PENDING_DEDUCTIONS_QUERY_KEY });
  });
});
