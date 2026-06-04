import axiosClient from './axios-client';

export interface ClosureBackfillResult {
  mirrored: number;
  transitioned: number;
  skippedNotClosed: number;
  skippedNotOurs: number;
  skippedUnchanged: number;
}

export interface ClosureReprocessResult {
  /** True when the reprocess feature flag is OFF — nothing ran. */
  skipped: boolean;
  /** Mirrored SOs with at least one pending side-effect. */
  candidates: number;
  /** SOs we re-fired the pending side-effects for. */
  processed: number;
  /** Candidates skipped for having no linked local task. */
  noTask: number;
}

export const iclassClosureApi = {
  backfill: () =>
    axiosClient.post<ClosureBackfillResult>('/admin/iclass/closure/backfill').then(r => r.data),
  reprocess: () =>
    axiosClient.post<ClosureReprocessResult>('/admin/iclass/closure/reprocess').then(r => r.data),
};
