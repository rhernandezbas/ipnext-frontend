import { useMutation, useQuery } from '@tanstack/react-query';
import { iclassClosureApi } from '@/api/iclassClosure.api';
import type { ClosurePendingCount, ClosurePendingList } from '@/api/iclassClosure.api';

/**
 * Dispatch an async backfill run (POST /closure/backfill → 202).
 * Returns BackfillTriggerResult: { queued: true } on dispatch,
 * or { queued: false, reason: 'already-running' } when already running.
 * 503 is surfaced as a thrown error; callers handle it via try/catch.
 */
export function useRunClosureBackfill() {
  return useMutation({ mutationFn: iclassClosureApi.backfill });
}

/**
 * Dispatch an async reprocess run (POST /closure/reprocess → 202).
 * Returns the queued-union result: { queued: true } on dispatch,
 * or { queued: false, reason } when already running or flag is OFF.
 */
export function useReprocessClosure() {
  return useMutation({ mutationFn: iclassClosureApi.reprocess });
}

/**
 * Polls GET /closure/reprocess/pending-count every 5 s while pending > 0.
 * Stops polling automatically when pending reaches 0.
 */
export function usePendingCount() {
  return useQuery<ClosurePendingCount>({
    queryKey: ['iclassClosure', 'pendingCount'],
    queryFn: iclassClosureApi.pendingCount,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.pending === 0) return false;
      return 5000;
    },
  });
}

/**
 * Polls GET /closure/reprocess/pending-list every 5 s while total > 0.
 * Stops polling automatically when total reaches 0 (nothing pending).
 * Mirrors usePendingCount stop-at-empty logic.
 */
export function usePendingList() {
  return useQuery<ClosurePendingList>({
    queryKey: ['iclassClosure', 'pendingList'],
    queryFn: iclassClosureApi.pendingList,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.total === 0) return false;
      return 5000;
    },
  });
}
