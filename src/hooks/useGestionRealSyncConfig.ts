import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncConfig, updateSyncConfig } from '@/api/gestionRealSync.api';
import type { UpdateSyncConfigPayload } from '@/types/gestionRealSync';

const ROOT = ['gestionRealSync'] as const;
const CONFIG_KEY = [...ROOT, 'config'] as const;
/** Owned by the existing `useGestionRealSyncStatus` hook — kept in sync here. */
const STATUS_KEY = ['gestion-real-sync-status'] as const;

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
