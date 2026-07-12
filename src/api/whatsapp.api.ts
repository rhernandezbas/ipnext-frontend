import axiosClient from './axios-client';
import type {
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappMessage,
  WhatsappPaginatedQuery,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

/**
 * whatsapp.api (messaging-inbox F1, design §4) — cliente del router
 * `/api/messaging`. Contrato verificado contra el código REAL del BE:
 * `messaging.routes.ts` + los use-cases `ListConversations`/`GetConversation`/
 * `ListMessages`/`SendMessage` (no el boceto del design.md del BE).
 *
 * OJO con los envelopes — son ASIMÉTRICOS entre endpoints:
 * - GET /conversations       → `res.json(result)`  → envelope paginado completo
 * - GET /conversations/:id   → `res.json(result)`  → DTO flat, SIN envelope
 * - GET /conversations/:id/messages → `res.json({data})` → hay que UNWRAP acá
 * - POST /conversations/:id/messages → `res.status(201).json(result)` → flat
 *
 * Errores reales (`errorHandler.ts`, body `{error,code}`): 404
 * CONVERSATION_NOT_FOUND, 422 MESSAGING_WINDOW_EXPIRED (send), 503
 * CHATWOOT_UNAVAILABLE. El interceptor global solo cubre 401 — 422/503 se
 * capturan en el `onError` de `useSendWhatsappMessage` (design §3/§5).
 */

const BASE = '/messaging';

export const listWhatsappConversations = (
  query: WhatsappPaginatedQuery = {},
): Promise<WhatsappPaginatedResult<WhatsappConversationListItem>> => {
  const params: Record<string, number> = {};
  if (query.page) params['page'] = query.page;
  if (query.limit) params['limit'] = query.limit;

  return axiosClient
    .get<WhatsappPaginatedResult<WhatsappConversationListItem>>(`${BASE}/conversations`, { params })
    .then(r => r.data);
};

export const getWhatsappConversation = (id: string): Promise<WhatsappConversationDetail> =>
  axiosClient
    .get<WhatsappConversationDetail>(`${BASE}/conversations/${id}`)
    .then(r => r.data);

export const listWhatsappMessages = (id: string): Promise<WhatsappMessage[]> =>
  axiosClient
    .get<{ data: WhatsappMessage[] }>(`${BASE}/conversations/${id}/messages`)
    .then(r => r.data.data);

export const sendWhatsappMessage = (id: string, content: string): Promise<WhatsappMessage> =>
  axiosClient
    .post<WhatsappMessage>(`${BASE}/conversations/${id}/messages`, { content })
    .then(r => r.data);
