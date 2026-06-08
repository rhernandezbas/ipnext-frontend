import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { iclassClosureApi } from '@/api/iclassClosure.api';
import type {
  ClosurePendingCount,
  ClosurePendingList,
  InFlightTaskList,
} from '@/api/iclassClosure.api';

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

/**
 * Lists the tasks currently stuck in the `registered_in_iclass` stage
 * (GET /closure/in-flight → 200 { items }). Polls every 5 s while the list is
 * non-empty and stops once it drains, mirroring usePendingList's stop-at-empty
 * logic — a reconciled-and-closed task drops off on the next refetch.
 */
export function useInFlightTasks() {
  return useQuery<InFlightTaskList>({
    queryKey: ['iclassClosure', 'inFlight'],
    queryFn: iclassClosureApi.inFlightList,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.items.length === 0) return false;
      return 5000;
    },
  });
}

/**
 * Reconciles ONE in-flight task synchronously (POST /closure/reconcile/:taskId
 * → 200 counts). On success invalidates the in-flight query so the list
 * refetches: a task that transitioned out of `registered_in_iclass` disappears.
 */
export function useReconcileTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => iclassClosureApi.reconcileTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iclassClosure', 'inFlight'] });
    },
  });
}
