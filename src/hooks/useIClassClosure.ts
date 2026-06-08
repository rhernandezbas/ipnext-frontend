import { useMutation, useQuery } from '@tanstack/react-query';
import { iclassClosureApi } from '@/api/iclassClosure.api';
import type { ClosurePendingCount } from '@/api/iclassClosure.api';

/** Run the on-demand closure backfill (reconcile in-flight tasks against IClass). */
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
