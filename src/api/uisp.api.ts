import axiosClient from './axios-client';
import type { UispSiteRow, UispSiteDetail, UispDeviceRow, UispSyncStatus } from '@/types/uisp';

const BASE = '/uisp';

/** Response from GET /api/uisp/sites */
interface ListUispSitesResponse {
  sites: UispSiteRow[];
}

/** Response from GET /api/uisp/sites/:uispId */
export interface UispSiteDetailResponse {
  site: UispSiteDetail;
  devices: UispDeviceRow[];
}

/** Response from POST /api/uisp/sync */
export type TriggerUispSyncResponse =
  | { queued: true }
  | { queued: false; reason: 'already-running' | 'flag-disabled' };

export async function fetchUispSites(): Promise<ListUispSitesResponse> {
  const r = await axiosClient.get<ListUispSitesResponse>(`${BASE}/sites`);
  return r.data;
}

export async function fetchUispSiteDetail(uispId: string): Promise<UispSiteDetailResponse> {
  const r = await axiosClient.get<UispSiteDetailResponse>(`${BASE}/sites/${uispId}`);
  return r.data;
}

export async function fetchUispSyncStatus(): Promise<UispSyncStatus> {
  const r = await axiosClient.get<UispSyncStatus>(`${BASE}/sync/status`);
  return r.data;
}

export async function postUispSync(): Promise<TriggerUispSyncResponse> {
  const r = await axiosClient.post<TriggerUispSyncResponse>(`${BASE}/sync`);
  return r.data;
}
