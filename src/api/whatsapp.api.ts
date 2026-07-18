import axiosClient from './axios-client';
import type {
  WhatsappArea,
  WhatsappAssignee,
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappConversationStatus,
  WhatsappInboxClientContext,
  WhatsappInboxViewCounts,
  WhatsappLabel,
  WhatsappMessage,
  WhatsappPaginatedQuery,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';
import type { TemplateSummaryDto } from '@/types/messagingBulk';

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
  const params: Record<string, number | string> = {};
  if (query.page) params['page'] = query.page;
  if (query.limit) params['limit'] = query.limit;
  // messaging-inbox-assignment F1.5-C2 (LIST-1 enmendado): 'assignment' filtra
  // server-side (mine|unassigned|all) — mismo criterio que page/limit, solo se
  // manda cuando viene definido (WAPI-1/2: sin query no manda params vacíos).
  if (query.assignment) params['assignment'] = query.assignment;
  // messaging-bulk-inbox Change 2: 'campaignId' filtra server-side por campaña
  // (JOIN Conversation×CampaignRecipient) — mismo criterio que assignment,
  // solo se manda cuando viene definido.
  if (query.campaignId) params['campaignId'] = query.campaignId;
  // Ola 5 (labels): 'labelId' filtra server-side por etiqueta — mismo criterio
  // que campaignId/assignment, solo se manda cuando viene definido.
  if (query.labelId) params['labelId'] = query.labelId;
  // inbox-resolve (API-1): 'status' filtra server-side por bucket
  // (open|resolved, design.md D2) — mismo criterio, solo se manda cuando
  // viene definido.
  if (query.status) params['status'] = query.status;
  // inbox-views (Ola 1, VIEW-2): 'view=unattended' filtra server-side el
  // bucket "Sin atender" (no-resuelta + último mensaje público inbound).
  // Ortogonal a assignment (AND válido); GANA sobre status en el BE. Mismo
  // criterio que el resto: solo se manda cuando viene definido.
  if (query.view) params['view'] = query.view;

  return axiosClient
    .get<WhatsappPaginatedResult<WhatsappConversationListItem>>(`${BASE}/conversations`, { params })
    .then(r => r.data);
};

/**
 * getInboxViewCounts (inbox-views Ola 1, COUNT-3) — contadores por vista para
 * los badges del sub-menú (`GET /messaging/conversations/counts`). Respuesta
 * FLAT (`res.json(result)`, SIN envelope `{data}` — mismo criterio que
 * `getWhatsappConversation`, verificado contra el route handler real del
 * worktree inbox-views-be). `mine` lo resuelve el BE del user AUTENTICADO
 * (req.user.id) — jamás viaja un param. Gate `messaging:read` (mismo que el
 * listado): un 403/503 acá lo degrada el hook (sub-menú sin números, no roto).
 */
export const getInboxViewCounts = (): Promise<WhatsappInboxViewCounts> =>
  axiosClient.get<WhatsappInboxViewCounts>(`${BASE}/conversations/counts`).then(r => r.data);

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
  /**
   * Aditivo (messaging-inbox-notes F1.5 fase D — NOTA PRIVADA, design §5) —
   * mirror EXACTO del campo wire que el BE lee (`private`/`isPrivate`,
   * NOTE-6). Opcional para no romper los call sites de 3 args existentes
   * (F1/F1.5 media, cero regresión).
   */
  private?: boolean;
}

export const sendWhatsappMessage = (id: string, input: SendMessageInput): Promise<WhatsappMessage> => {
  if (!input.files || input.files.length === 0) {
    return axiosClient
      .post<WhatsappMessage>(`${BASE}/conversations/${id}/messages`, { content: input.content, private: input.private })
      .then(r => r.data);
  }

  // field name 'attachments' = multer .array('attachments') del BE (spec-send.md SEND-6).
  const form = new FormData();
  form.append('content', input.content);
  for (const f of input.files) form.append('attachments', f);
  // NOTE-6: solo se agrega el campo cuando es realmente true — ausente/false
  // queda sin el campo (compat con F1, el BE default a false cuando falta).
  if (input.private) form.append('private', 'true');

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
 * editWhatsappNote / deleteWhatsappNote (internal-notes F1.5 — EDITAR/ELIMINAR
 * NOTA) — mutaciones de una nota interna EXISTENTE del hilo. Contrato BE (ya
 * en prod):
 *
 * - `PATCH /messaging/conversations/:id/messages/:messageId` body `{content}`
 *   (no vacío) → 200 `ChatMessageDto` editada (FLAT, sin envelope — mismo
 *   criterio que `setConversationStatus`/`getWhatsappConversation`).
 * - `DELETE /messaging/conversations/:id/messages/:messageId` → 200
 *   `ChatMessageDto` con `deleted:true` + `content:""` (TOMBSTONE — la fila
 *   sigue en el hilo, el BE la devuelve igual, no la borra del array).
 *
 * Errores reales (`errorHandler.ts`, body `{error,code}`, mapeados por
 * `mapNoteError`): 404 INTERNAL_NOTE_NOT_FOUND, 422 NOT_AN_INTERNAL_NOTE, 409
 * INTERNAL_NOTE_ALREADY_DELETED, 403 INTERNAL_NOTE_FORBIDDEN, 403
 * PERMISSION_DENIED.
 */
export const editWhatsappNote = (
  conversationId: string,
  messageId: string,
  content: string,
): Promise<WhatsappMessage> =>
  axiosClient
    .patch<WhatsappMessage>(`${BASE}/conversations/${conversationId}/messages/${messageId}`, { content })
    .then(r => r.data);

export const deleteWhatsappNote = (conversationId: string, messageId: string): Promise<WhatsappMessage> =>
  axiosClient
    .delete<WhatsappMessage>(`${BASE}/conversations/${conversationId}/messages/${messageId}`)
    .then(r => r.data);

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

/**
 * setConversationStatus (messaging-inbox-productivity F1.5-C v1 —
 * RESOLVER/REABRIR) — POST /messaging/conversations/:id/status con
 * `{status}`, devuelve la conversación actualizada (sin envelope — WAPI-8).
 *
 * hallazgo MEDIUM #4 (review adversarial): el BE devuelve el shape de LISTA
 * (`ConversationListItemDto`), NO el de detalle — SIN `canReply`/
 * `clientContext` (esos son exclusivos de `GetConversation`, el fetch-on-open
 * del detalle). El tipo estaba declarado `WhatsappConversationDetail` por
 * error (copy-paste de `getWhatsappConversation`); era inerte porque
 * `useSetConversationStatus` (`useWhatsapp.ts`) solo lee `.status` de la
 * respuesta para asentar el optimista en el refetch/`onSettled` — pero
 * cualquier código nuevo que leyera `.canReply`/`.clientContext` de acá
 * compilaría igual y rompería en runtime (`undefined`).
 */
export const setConversationStatus = (
  id: string,
  status: WhatsappConversationStatus,
): Promise<WhatsappConversationListItem> =>
  axiosClient
    .post<WhatsappConversationListItem>(`${BASE}/conversations/${id}/status`, { status })
    .then(r => r.data);

/**
 * setConversationAssignee / setConversationArea (messaging-inbox-assignment
 * F1.5-C2 — ASIGNACIÓN) — PATCH `.../assignee` y `.../area` con `{assigneeId}`/
 * `{areaId}` (string | null; `null` desasigna/quita área), devuelven la
 * conversación actualizada (shape de LISTA, mismo criterio que
 * `setConversationStatus` — WAPI-8: SIN `canReply`/`clientContext`).
 */
export const setConversationAssignee = (
  id: string,
  assigneeId: string | null,
): Promise<WhatsappConversationListItem> =>
  axiosClient
    .patch<WhatsappConversationListItem>(`${BASE}/conversations/${id}/assignee`, { assigneeId })
    .then(r => r.data);

export const setConversationArea = (
  id: string,
  areaId: string | null,
): Promise<WhatsappConversationListItem> =>
  axiosClient
    .patch<WhatsappConversationListItem>(`${BASE}/conversations/${id}/area`, { areaId })
    .then(r => r.data);

/**
 * getAssignableUsers / getMessagingAreas (messaging-inbox-assignment F1.5-C2)
 * — catálogos GET (envueltos en `{ data }` por el BE — se desenvuelve acá,
 * el bug de C2 que el E2E cazó: el componente hacía `.map` sobre el envelope)
 * que alimentan los
 * dropdowns "Asignar a"/"Área" del header del thread y el chip de la fila de
 * lista. `getMessagingAreas` es el MISMO catálogo que usan Tickets
 * (`GET /messaging/areas`, contrato compartido).
 */
export const getAssignableUsers = (): Promise<WhatsappAssignee[]> =>
  axiosClient.get<{ data: WhatsappAssignee[] }>(`${BASE}/assignable-users`).then(r => r.data.data);

export const getMessagingAreas = (): Promise<WhatsappArea[]> =>
  axiosClient.get<{ data: WhatsappArea[] }>(`${BASE}/areas`).then(r => r.data.data);

/**
 * listSendableTemplates / sendWhatsappTemplate (inbox-template-send, design
 * D11/WAPI-1) — catálogo + envío del picker de template del composer, para
 * cuando la ventana de 24h expiró. Verificado contra el BE real EN PROD:
 *
 * - `GET /messaging/send-templates` (gate `messaging:send`, ruta NUEVA
 *   distinta de `/messaging/bulk/templates` — ver design.md D7): envelope
 *   `{data}`, se desenvuelve acá (mismo criterio que `listWhatsappMessages`/
 *   `getAssignableUsers`). Tipo `TemplateSummaryDto` REUSADO de
 *   `types/messagingBulk.ts` — cero duplicación (design D11).
 * - `POST /messaging/conversations/:id/send-template` (gate `messaging:send`):
 *   responde el DTO FLAT (sin envelope) — 201 en un envío nuevo, 200 en un
 *   retry deduped por `idempotencyKey` (design D5), MISMO body en ambos casos.
 *   El FE no ramifica por status code acá — sólo consume el resultado.
 */
export const listSendableTemplates = (): Promise<TemplateSummaryDto[]> =>
  axiosClient.get<{ data: TemplateSummaryDto[] }>(`${BASE}/send-templates`).then(r => r.data.data);

/**
 * CONTRATO H1 (fix wave BE, idempotency-key server-side, design D5/D11): el
 * FE genera `idempotencyKey` como UUID al ABRIR el panel de confirmación y lo
 * REUSA en todos los reintentos de ESE MISMO intento de envío (ver
 * `TemplateSendPanel.tsx`) — acá sólo se threadea tal cual en el body.
 */
export interface SendWhatsappTemplateInput {
  templateRef: string;
  variables: Record<string, string>;
  idempotencyKey: string;
}

export const sendWhatsappTemplate = (id: string, input: SendWhatsappTemplateInput): Promise<WhatsappMessage> =>
  axiosClient.post<WhatsappMessage>(`${BASE}/conversations/${id}/send-template`, input).then(r => r.data);

/**
 * Etiquetas de conversación (Ola 5 — labels). Contrato BE (ya en prod):
 *
 * - `GET /messaging/labels` (gate `messaging:read`): catálogo, responde el
 *   ARRAY PLANO `[{id,name,color}]` (SIN envelope `{data}` — a diferencia de
 *   `/messaging/areas`/`/messaging/assignable-users`; verificado contra el
 *   contrato de la tarea). Alimenta chips de fila, control de asignación y
 *   filtro de la lista.
 * - `POST /messaging/labels` (gate `messaging:manage`): crea con `{name,color}`,
 *   devuelve la label creada FLAT. 409 CONVERSATION_LABEL_NAME_CONFLICT / 400.
 * - `PUT /messaging/labels/:id` (gate `messaging:manage`): edita `{name?,color?}`,
 *   devuelve la label actualizada FLAT. 409 / 404 CONVERSATION_LABEL_NOT_FOUND / 400.
 * - `DELETE /messaging/labels/:id` (gate `messaging:manage`): elimina (el BE la
 *   quita de las conversaciones que la tuvieran). 404.
 */
export const listMessagingLabels = (): Promise<WhatsappLabel[]> =>
  axiosClient.get<WhatsappLabel[]>(`${BASE}/labels`).then(r => r.data);

export const createMessagingLabel = (data: { name: string; color: string }): Promise<WhatsappLabel> =>
  axiosClient.post<WhatsappLabel>(`${BASE}/labels`, data).then(r => r.data);

export const updateMessagingLabel = (
  id: string,
  data: { name?: string; color?: string },
): Promise<WhatsappLabel> =>
  axiosClient.put<WhatsappLabel>(`${BASE}/labels/${id}`, data).then(r => r.data);

export const deleteMessagingLabel = (id: string): Promise<void> =>
  axiosClient.delete(`${BASE}/labels/${id}`).then(() => undefined);

/**
 * setConversationLabels (Ola 5 — labels) — `PATCH .../labels` con
 * `{labelIds: string[]}` REEMPLAZA el set completo (`[]` limpia todas),
 * devuelve la conversación actualizada (shape de LISTA, mismo criterio que
 * `setConversationArea` — WAPI-8: SIN `canReply`/`clientContext`, pero CON
 * `labels` ya poblado). Gate `messaging:send`.
 */
export const setConversationLabels = (
  id: string,
  labelIds: string[],
): Promise<WhatsappConversationListItem> =>
  axiosClient
    .patch<WhatsappConversationListItem>(`${BASE}/conversations/${id}/labels`, { labelIds })
    .then(r => r.data);
