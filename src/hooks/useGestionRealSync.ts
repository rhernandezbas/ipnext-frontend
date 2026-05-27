import { useQuery } from '@tanstack/react-query';
import { getGestionRealSyncStatus } from '../api/gestionReal.api';

/** Polls the GR mirror sync status so the UI can show a "réplica viva" badge. */
export function useGestionRealSyncStatus() {
  return useQuery({
    queryKey: ['gestion-real-sync-status'],
    queryFn: getGestionRealSyncStatus,
    refetchInterval: 30_000,
    staleTime: 15_000,
    // The endpoint 404s/401s harmlessly when the feature is off — don't hammer retries.
    retry: false,
  });
}
