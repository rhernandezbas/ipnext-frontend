/**
 * Material-deduction-suggestion DTOs (EPIC #38, Wave 6) — the "Descuentos pendientes"
 * surface. Mirrors the backend contract for material deduction suggestions staged
 * automatically when a technician's material consumption is recorded.
 *
 *   GET  /api/inventory/deductions/pending          → DeductionSuggestion[]
 *   POST /api/inventory/deductions/:id/confirm       → 200 / 409
 *   POST /api/inventory/deductions/:id/discard       → 200
 *
 * `pending`      = technician has sufficient stock → `deduct` resolution fires CONSUME.
 * `needs_review` = stock was insufficient at staging time → operator picks
 *                  `issue-first` (transfer + consume) | `depot` (consume from depot)
 *                  | `discard` (no movement).
 *
 * On 409 the BE returns code `DEDUCTION_ALREADY_CONFIRMED`.
 */

/** Lifecycle of a staged deduction. The list only ever surfaces the first two. */
export type DeductionSuggestionStatus = 'pending' | 'needs_review' | 'confirmed' | 'discarded';

/** How the operator resolves a suggestion on confirm. */
export type DeductionResolution = 'deduct' | 'issue-first' | 'depot' | 'discard';

/** A single staged material deduction awaiting operator review. */
export interface DeductionSuggestion {
  id: string;
  consumptionId: string;
  taskId?: string | null;
  taskSeq?: number | null;
  taskTitle?: string | null;
  materialId: string;
  materialName: string;
  materialUnit?: string | null;
  qty: number;
  technicianId?: string | null;
  technicianName?: string | null;
  status: DeductionSuggestionStatus;
  createdAt: string;
}

/** Body for POST /deductions/:id/confirm. */
export interface ConfirmDeductionInput {
  resolution: DeductionResolution;
}

/** 409 error body returned when a deduction is already confirmed. */
export interface DeductionAlreadyConfirmedError {
  code: 'DEDUCTION_ALREADY_CONFIRMED';
  message: string;
}
