import axiosClient from './axios-client';
import type { DeductionSuggestion, ConfirmDeductionInput } from '@/types/deductions';

/**
 * Material deduction suggestions API (EPIC #38, Wave 6).
 *
 * Consumption recording stages suggestions; the operator reviews them here.
 * The list endpoint is read-only (`inventory.read`); confirm/discard mutate
 * stock (`inventory.write`).
 *
 *   GET  /api/inventory/deductions/pending
 *   POST /api/inventory/deductions/:id/confirm   body { resolution }
 *   POST /api/inventory/deductions/:id/discard
 */

/** List the suggestions awaiting review (`pending` + `needs_review`). */
export const getPendingDeductions = (): Promise<DeductionSuggestion[]> =>
  axiosClient.get<DeductionSuggestion[]>('/inventory/deductions/pending').then(r => r.data);

/** Confirm a suggestion. `deduct` fires CONSUME from tecnico stock; `issue-first`
 *  transfers from depot then consumes; `depot` consumes from depot directly. */
export const confirmDeduction = (id: string, input: ConfirmDeductionInput): Promise<void> =>
  axiosClient.post(`/inventory/deductions/${id}/confirm`, input).then(() => undefined);

/** Discard a suggestion. No stock change. */
export const discardDeduction = (id: string): Promise<void> =>
  axiosClient.post(`/inventory/deductions/${id}/discard`).then(() => undefined);
