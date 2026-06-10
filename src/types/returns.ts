/**
 * Return-suggestion DTOs (EPIC #38, Wave 4) — the "Devoluciones pendientes"
 * surface. Mirrors the backend contract of the closure-staged returns:
 *
 *   GET  /api/inventory/returns/pending        → ReturnSuggestion[]
 *   POST /api/inventory/returns/:id/confirm     → 200 / 409
 *   POST /api/inventory/returns/:id/discard     → 200
 *
 * A closing RETIRO service order stages one suggestion per detected serial.
 * `pending`      = the serial matched an installed asset → one click to return.
 * `needs_review` = no installed asset matched → operator decides (create / link
 *                  / discard).
 *
 * In production there are 0 pending returns initially, so consumers MUST tolerate
 * an empty array — the empty state is the primary UX.
 */

/** Lifecycle of a staged return. The list only ever surfaces the first two. */
export type ReturnSuggestionStatus = 'pending' | 'needs_review' | 'confirmed' | 'discarded';

/** How the operator resolves a suggestion on confirm. */
export type ReturnResolution = 'return' | 'link' | 'create' | 'discard';

/** A single staged equipment return awaiting operator review. */
export interface ReturnSuggestion {
  id: string;
  serviceOrderId: string;
  taskId?: string | null;
  serialNumber: string | null;
  mac?: string | null;
  deviceType?: string | null;
  /** The installed asset this serial matched, or null when it needs review. */
  matchedAssetId: string | null;
  status: ReturnSuggestionStatus;
  createdAt: string;
}

/** Body for POST /returns/:id/confirm. `linkedAssetId` only for `link`. */
export interface ConfirmReturnInput {
  resolution: ReturnResolution;
  linkedAssetId?: string;
}
