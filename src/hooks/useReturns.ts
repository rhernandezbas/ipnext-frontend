import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingReturns, confirmReturn, discardReturn, getReturnsByTask } from '@/api/returns.api';
import type { ConfirmReturnInput } from '@/types/returns';

export const PENDING_RETURNS_QUERY_KEY = ['inventory', 'returns', 'pending'] as const;

/**
 * Pending equipment returns (EPIC #38, Wave 4). Read-only list of suggestions
 * staged by a RETIRO closure, awaiting operator review.
 *
 * The backend returns a bare array (empty when nothing is pending), so the happy
 * path already covers the empty state, which is the production default.
 */
export function usePendingReturns() {
  return useQuery({
    queryKey: PENDING_RETURNS_QUERY_KEY,
    queryFn: getPendingReturns,
    staleTime: 30_000,
  });
}

/**
 * Confirm a return suggestion. `return`/`link` fire the RETURN ledger movement;
 * `create` is born at the depot; `discard` is a no-op on stock. On success the
 * row leaves the pending list, so we invalidate it.
 */
export function useConfirmReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmReturnInput }) =>
      confirmReturn(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: PENDING_RETURNS_QUERY_KEY }),
  });
}

/**
 * Returns staged for a specific task (all statuses).
 *
 * GET /api/inventory/returns/by-task/:taskId
 * Used by the Inventory tab of the task detail page to surface a status pill.
 * Only fetched when `enabled` is true — the caller gates this on the presence
 * of an iclassOrderCode (the task went through closure and might have returns).
 */
export function useReturnsByTask(taskId: string, enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'returns', 'by-task', taskId] as const,
    queryFn: () => getReturnsByTask(taskId),
    staleTime: 30_000,
    enabled: !!taskId && enabled,
  });
}

/** Discard a suggestion (no stock change). The row leaves the pending list. */
export function useDiscardReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => discardReturn(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: PENDING_RETURNS_QUERY_KEY }),
  });
}
