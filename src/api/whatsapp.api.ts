import axiosClient from './axios-client';
import type {
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappInboxClientContext,
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

/**
 * SendMessageInput (messaging-inbox-v2-media F1.5 fase A, Tanda 2 — ENVIAR,
 * design §6.1) — `files`/`onUploadProgress` son ADITIVOS: sin `files` el
 * camino es JSON idéntico a F1 (cero regresión, SEND-4/WAPI-5).
 */
export interface SendMessageInput {
  content: string;
  files?: File[];
  onUploadProgress?: (fraction: number) => void;
}

export const sendWhatsappMessage = (id: string, input: SendMessageInput): Promise<WhatsappMessage> => {
  if (!input.files || input.files.length === 0) {
    return axiosClient
      .post<WhatsappMessage>(`${BASE}/conversations/${id}/messages`, { content: input.content })
      .then(r => r.data);
  }

  // field name 'attachments' = multer .array('attachments') del BE (spec-send.md SEND-6).
  const form = new FormData();
  form.append('content', input.content);
  for (const f of input.files) form.append('attachments', f);

  return axiosClient
    .post<WhatsappMessage>(`${BASE}/conversations/${id}/messages`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }, // axios 1.x agrega el boundary solo
      onUploadProgress: (e: { loaded: number; total?: number }) => {
        if (e.total) input.onUploadProgress?.(e.loaded / e.total);
      },
    })
    .then(r => r.data);
};

/**
 * getInboxClientContext (messaging-inbox-v2 F1.5, RICH-1..6, design §3.3,
 * tasks F1) — GET del agregador rico. `clientId` desambigua un `ambiguous`
 * (validado server-side contra los candidatos, RICH-1). `opts.refreshBalance`
 * es el nombre LOCAL del flag FE; en el wire viaja como `?refresh=1`
 * (verificado contra el route handler real, B4: `const {clientId, refresh} =
 * req.query`) — RICH-4, dispara el refresh vivo de Gestión Real en el BE.
 * Devuelve el DTO FLAT (sin envelope), igual que `getWhatsappConversation`.
 */
export const getInboxClientContext = (
  conversationId: string,
  clientId?: string,
  opts?: { refreshBalance?: boolean },
): Promise<WhatsappInboxClientContext> => {
  const params: Record<string, string> = {};
  if (clientId) params['clientId'] = clientId;
  if (opts?.refreshBalance) params['refresh'] = '1';

  return axiosClient
    .get<WhatsappInboxClientContext>(`${BASE}/conversations/${conversationId}/client-context`, { params })
    .then(r => r.data);
};
