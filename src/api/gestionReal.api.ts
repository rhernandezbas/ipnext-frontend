import axiosClient from './axios-client';

export interface GestionRealSyncStatus {
  entity: string;
  cursor: string | null;
  lastRunAt: string | null;
  lastResult: string | null;
  itemsSynced: number;
  hasRun: boolean;
  /** Total mirrored clients — populated by the backend when available. */
  clientCount?: number;
  /** Total mirrored contracts — populated by the backend when available. */
  contractCount?: number;
}

export async function getGestionRealSyncStatus(): Promise<GestionRealSyncStatus> {
  const response = await axiosClient.get<GestionRealSyncStatus>('/gestion-real/sync/status');
  return response.data;
}
