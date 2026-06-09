import axiosClient from './axios-client';
import type { ReturnSuggestion, ConfirmReturnInput } from '@/types/returns';

/**
 * Pending equipment returns API (EPIC #38, Wave 4).
 *
 * Closure stages suggestions; the operator reviews them here. The list endpoint
 * is read-only (`inventory.read`); confirm/discard mutate stock (`inventory.write`).
 *
 *   GET  /api/inventory/returns/pending
 *   POST /api/inventory/returns/:id/confirm   body { resolution, linkedAssetId? }
 *   POST /api/inventory/returns/:id/discard
 */

/** List the suggestions awaiting review (`pending` + `needs_review`). */
export const getPendingReturns = (): Promise<ReturnSuggestion[]> =>
  axiosClient.get<ReturnSuggestion[]>('/inventory/returns/pending').then(r => r.data);

/** Confirm a suggestion. Fires the RETURN ledger movement for return/link. */
export const confirmReturn = (id: string, input: ConfirmReturnInput): Promise<void> =>
  axiosClient.post(`/inventory/returns/${id}/confirm`, input).then(() => undefined);

/** Discard a suggestion. No stock change. */
export const discardReturn = (id: string): Promise<void> =>
  axiosClient.post(`/inventory/returns/${id}/discard`).then(() => undefined);
