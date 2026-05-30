import axiosClient from './axios-client';
import type { SyncConfigDTO, UpdateSyncConfigPayload } from '@/types/gestionRealSync';

const BASE = '/gestion-real/sync';

/** GET the GR client-sync configuration. The STATUS call lives in `gestionReal.api.ts`. */
export async function getSyncConfig(): Promise<SyncConfigDTO> {
  const r = await axiosClient.get<SyncConfigDTO>(`${BASE}/config`);
  return r.data;
}

/** PUT a partial GR client-sync configuration. */
export async function updateSyncConfig(body: UpdateSyncConfigPayload): Promise<SyncConfigDTO> {
  const r = await axiosClient.put<SyncConfigDTO>(`${BASE}/config`, body);
  return r.data;
}
