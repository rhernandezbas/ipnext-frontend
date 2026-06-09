import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingDeductions, confirmDeduction, discardDeduction } from '@/api/deductions.api';
import type { ConfirmDeductionInput } from '@/types/deductions';

export const PENDING_DEDUCTIONS_QUERY_KEY = ['inventory', 'deductions', 'pending'] as const;

/**
 * Pending material deductions (EPIC #38, Wave 6). Read-only list of suggestions
 * staged when a technician's material consumption is recorded.
 *
 * `pending`      = technician had sufficient stock at staging time → one-click deduct.
 * `needs_review` = insufficient stock → operator picks a resolution (issue-first /
 *                  depot / discard).
 */
export function useDeductionsPending() {
  return useQuery({
    queryKey: PENDING_DEDUCTIONS_QUERY_KEY,
    queryFn: getPendingDeductions,
    staleTime: 30_000,
  });
}

/**
 * Confirm a deduction suggestion.
 * - `deduct`      → CONSUME from tecnico stock (only for `pending`)
 * - `issue-first` → TRANSFER from depot + CONSUME in one tx (for `needs_review`)
 * - `depot`       → CONSUME directly from depot (for `needs_review`)
 * On 409 (DEDUCTION_ALREADY_CONFIRMED) we still invalidate so the list refreshes.
 */
export function useConfirmDeduction() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: PENDING_DEDUCTIONS_QUERY_KEY });
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmDeductionInput }) =>
      confirmDeduction(id, input),
    onSuccess: invalidate,
    onError: invalidate,
  });
}

/** Discard a suggestion (no stock change). The row leaves the pending list. */
export function useDiscardDeduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => discardDeduction(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: PENDING_DEDUCTIONS_QUERY_KEY }),
  });
}
