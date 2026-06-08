import axiosClient from './axios-client';

/** A single pending service order side-effect item with linked task info. */
export interface ClosurePendingItem {
  iclassId: string;
  scheduledTaskId: string | null;
  commentPosted: boolean;
  inventoryBuilt: boolean;
  auditDone: boolean;
  auditAttempts: number;
  task: { id: string; sequenceNumber: number; title: string } | null;
}

/** Response from GET /closure/reprocess/pending-list (200). */
export interface ClosurePendingList {
  items: ClosurePendingItem[];
  total: number;
}

/**
 * Response union from POST /closure/backfill (202).
 * queued:true  — run was dispatched in the background.
 * queued:false — a run is already in flight.
 * (503 is surfaced as a thrown error by axios; handled separately in the UI.)
 */
export type BackfillTriggerResult =
  | { queued: true }
  | { queued: false; reason: 'already-running' };

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

/** Response/body for GET and PUT /closure/config (intervals in milliseconds). */
export interface ClosureConfig {
  closureIntervalMs: number;
  autocompleteIntervalMs: number;
}

/** A single task currently stuck in the `registered_in_iclass` stage. */
export interface InFlightTask {
  id: string;
  sequenceNumber: number;
  title: string;
  customerName: string | null;
  iclassOrderCode: string | null;
}

/** Response from GET /closure/in-flight (200). */
export interface InFlightTaskList {
  items: InFlightTask[];
}

/**
 * Per-task reconcile counts from POST /closure/reconcile/:taskId (200).
 * mirrored===0 && transitioned===0 means no recent closure was found for the SO.
 */
export interface ReconcileCounts {
  mirrored: number;
  transitioned: number;
  skippedNotClosed: number;
  skippedNotOurs: number;
  skippedUnchanged: number;
  failed: number;
}

export const iclassClosureApi = {
  backfill: () =>
    axiosClient.post<BackfillTriggerResult>('/admin/iclass/closure/backfill').then(r => r.data),
  reprocess: () =>
    axiosClient.post<ClosureReprocessQueued>('/admin/iclass/closure/reprocess').then(r => r.data),
  pendingCount: () =>
    axiosClient.get<ClosurePendingCount>('/admin/iclass/closure/reprocess/pending-count').then(r => r.data),
  pendingList: () =>
    axiosClient.get<ClosurePendingList>('/admin/iclass/closure/reprocess/pending-list').then(r => r.data),
  getConfig: () =>
    axiosClient.get<ClosureConfig>('/admin/iclass/closure/config').then(r => r.data),
  updateConfig: (patch: Partial<ClosureConfig>) =>
    axiosClient.put<ClosureConfig>('/admin/iclass/closure/config', patch).then(r => r.data),
  inFlightList: () =>
    axiosClient.get<InFlightTaskList>('/admin/iclass/closure/in-flight').then(r => r.data),
  reconcileTask: (taskId: string) =>
    axiosClient
      .post<ReconcileCounts>(`/admin/iclass/closure/reconcile/${taskId}`)
      .then(r => r.data),
};
