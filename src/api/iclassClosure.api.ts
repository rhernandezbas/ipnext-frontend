import axiosClient from './axios-client';

export interface ClosureBackfillResult {
  mirrored: number;
  transitioned: number;
  skippedNotClosed: number;
  skippedNotOurs: number;
  skippedUnchanged: number;
}

/**
 * Response union from POST /closure/reprocess (202).
 * queued:true  — run was dispatched in the background.
 * queued:false — pre-check failed; reason explains why.
 */
export interface ClosureReprocessQueued {
  queued: boolean;
  reason?: 'already-running' | 'flag-disabled' | 'unavailable';
}

/** Response from GET /closure/reprocess/pending-count (200). */
export interface ClosurePendingCount {
  pending: number;
}

export const iclassClosureApi = {
  backfill: () =>
    axiosClient.post<ClosureBackfillResult>('/admin/iclass/closure/backfill').then(r => r.data),
  reprocess: () =>
    axiosClient.post<ClosureReprocessQueued>('/admin/iclass/closure/reprocess').then(r => r.data),
  pendingCount: () =>
    axiosClient.get<ClosurePendingCount>('/admin/iclass/closure/reprocess/pending-count').then(r => r.data),
};
