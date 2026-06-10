import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUispSyncStatus, postUispSync } from '@/api/uisp.api';
import type { TriggerUispSyncResponse } from '@/api/uisp.api';

export const UISP_SYNC_STATUS_KEY = ['uisp', 'sync', 'status'] as const;

/**
 * Polls the UISP sync status every 30 seconds.
 * Exposes `configured` and `enabled` booleans for conditional rendering.
 */
export function useUispSyncStatus() {
  return useQuery({
    queryKey: UISP_SYNC_STATUS_KEY,
    queryFn: fetchUispSyncStatus,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

/**
 * Triggers a UISP sync. Returns the queued/reason response.
 * Invalidates the sync status on success.
 */
export function useTriggerUispSync() {
  const qc = useQueryClient();
  return useMutation<TriggerUispSyncResponse>({
    mutationFn: postUispSync,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UISP_SYNC_STATUS_KEY });
    },
  });
}
