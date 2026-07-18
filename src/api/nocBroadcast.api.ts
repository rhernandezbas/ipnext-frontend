import axiosClient from './axios-client';
import type {
  NocBroadcastConfigDTO,
  UpdateNocBroadcastPayload,
  TestNocBroadcastResult,
} from '@/types/nocBroadcast';

const BASE = '/messaging/noc-broadcast';

/** GET the NOC-broadcast config. `apiKey` never travels — only `hasApiKey` + `apiKeyLast4`. */
export async function getNocBroadcastConfig(): Promise<NocBroadcastConfigDTO> {
  const r = await axiosClient.get<NocBroadcastConfigDTO>(`${BASE}/config`);
  return r.data;
}

/**
 * PUT a partial NOC-broadcast config. `evolutionApiKey` must be included ONLY
 * when the user typed a new key — the caller (hook/component) builds the diff;
 * omitting it preserves the stored key server-side.
 */
export async function updateNocBroadcastConfig(
  body: UpdateNocBroadcastPayload,
): Promise<NocBroadcastConfigDTO> {
  const r = await axiosClient.put<NocBroadcastConfigDTO>(`${BASE}/config`, body);
  return r.data;
}

/**
 * POST a test message to the NOC channel. Resolves `{ ok: true }`. The backend
 * surfaces 503 NOC_BROADCAST_NOT_CONFIGURED / 502 EVOLUTION_API_ERROR as errors.
 */
export async function testNocBroadcast(): Promise<TestNocBroadcastResult> {
  const r = await axiosClient.post<TestNocBroadcastResult>(`${BASE}/test`);
  return r.data;
}
