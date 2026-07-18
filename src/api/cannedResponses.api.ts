import axiosClient from './axios-client';
import type {
  CannedResponse,
  CreateCannedResponseInput,
  UpdateCannedResponseInput,
} from '@/types/cannedResponses';

/**
 * cannedResponses.api (Ola 4 — respuestas rápidas / macros) — cliente del
 * router `/api/messaging/canned-responses`. Contrato verificado contra el BE
 * (ya en prod):
 *
 * - GET    /canned-responses?q= → `{ data }` (envelope, se desenvuelve acá —
 *   mismo criterio que `listWhatsappMessages`/`getAssignableUsers`). `q`
 *   matchea shortcut o content; opcional (sin `q` trae el catálogo completo).
 * - POST   /canned-responses    → 201, DTO creado (FLAT, sin envelope).
 * - PUT    /canned-responses/:id → 200, DTO actualizado (FLAT).
 * - DELETE /canned-responses/:id → 204 No Content → void.
 *
 * Errores (`errorHandler.ts`, body `{error,code}`): 409 SHORTCUT_TAKEN, 404
 * CANNED_RESPONSE_NOT_FOUND, 400 VALIDATION_ERROR — los mapea el hook
 * (`useCannedResponses`), no acá.
 */

const BASE = '/messaging/canned-responses';

export const listCannedResponses = (q?: string): Promise<CannedResponse[]> => {
  const params: Record<string, string> = {};
  if (q && q.trim().length > 0) params['q'] = q.trim();
  return axiosClient
    .get<{ data: CannedResponse[] }>(BASE, { params })
    .then((r) => r.data.data);
};

export const createCannedResponse = (input: CreateCannedResponseInput): Promise<CannedResponse> =>
  axiosClient.post<CannedResponse>(BASE, input).then((r) => r.data);

export const updateCannedResponse = (
  id: string,
  input: UpdateCannedResponseInput,
): Promise<CannedResponse> =>
  axiosClient.put<CannedResponse>(`${BASE}/${id}`, input).then((r) => r.data);

export const deleteCannedResponse = (id: string): Promise<void> =>
  axiosClient.delete(`${BASE}/${id}`).then(() => undefined);
