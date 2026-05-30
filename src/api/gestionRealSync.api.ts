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

/** Result of a full GR re-backfill trigger. The backfill itself runs async server-side. */
export interface ResyncAllResult {
  started?: boolean;
  [k: string]: unknown;
}

/**
 * POST a full GR re-backfill of clients + contracts. Destructive/long-running:
 * the backend enforces the `gestionReal:write` gate (surfaced as 403). Resolves
 * with the response body.
 */
export async function resyncAll(): Promise<ResyncAllResult> {
  const r = await axiosClient.post<ResyncAllResult>(`${BASE}/resync-all`);
  return r.data;
}
