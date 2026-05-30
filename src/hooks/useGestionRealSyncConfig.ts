import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncConfig, updateSyncConfig, resyncAll } from '@/api/gestionRealSync.api';
import type { UpdateSyncConfigPayload } from '@/types/gestionRealSync';

const ROOT = ['gestionRealSync'] as const;
const CONFIG_KEY = [...ROOT, 'config'] as const;
/** Owned by the existing `useGestionRealSyncStatus` hook — kept in sync here. */
const STATUS_KEY = ['gestion-real-sync-status'] as const;
/** Owned by `useClientStats` (`@/hooks/useCustomers`) — invalidated so the breakdown refreshes. */
const STATS_KEY = ['client-stats'] as const;

export function useSyncConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: getSyncConfig,
  });
}

export function useUpdateSyncConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSyncConfigPayload) => updateSyncConfig(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONFIG_KEY });
      qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}

/**
 * Trigger a full GR re-backfill. On success, invalidates the sync-status, the
 * config, and the client-stats keys so the status panel and the breakdown
 * refresh. The backfill is async server-side, so counts may lag by one poll.
 */
export function useResyncAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resyncAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STATUS_KEY });
      qc.invalidateQueries({ queryKey: CONFIG_KEY });
      qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}
