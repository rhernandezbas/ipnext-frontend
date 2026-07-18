/**
 * whatsapp (messaging-inbox F1, design §3) — espejo campo a campo del BE real
 * (`ipnext-backend/src/application/dto/messaging.ts` + `dto/pagination.ts`, NO el
 * boceto del design.md del BE). Naming `Whatsapp`-prefixed — históricamente para
 * no colisionar con el módulo interno `Message` (Support legacy, eliminado en el
 * change sidebar-comunicaciones); se mantiene por consistencia del dominio.
 *
 * Drift cerrado (design §3, spec.md LIST-1 enmendado): `ConversationListItemDto`
 * NO tiene `unreadCount` ni `canReply` — esos campos solo existen en el detalle
 * (`ConversationDetailDto`, fetch-on-open). El badge de fila usa `status`.
 */

// ─── Asignación (messaging-inbox-assignment F1.5-C2 — ASIGNACIÓN) — espejo de
// `ConversationListItemDto.assignee`/`.area` (`ipnext-backend`). `WhatsappAssignee`
// reusa el MISMO shape que devuelve `GET /messaging/assignable-users` (design
// contrato: `[{id,name}]`) — el agente asignado de una conversación y una fila
// de la lista de asignables son el mismo DTO, no hace falta duplicar el tipo.

export interface WhatsappAssignee {
  id: string;
  name: string;
}

/** Catálogo COMPARTIDO con tickets (`GET /messaging/areas`, mismo shape que `TicketArea`). */
export interface WhatsappArea {
  id: string;
  name: string;
  color: string;
}

/**
 * Etiqueta de campaña (messaging-bulk-inbox Change 2) — espejo del sub-DTO
 * `campaigns[]` que el BE agrega a `ConversationListItemDto`: las campañas
 * cuya audiencia incluye a ese cliente (JOIN Conversation×CampaignRecipient).
 * Sin `color` (a diferencia de `WhatsappArea`): el chip de campaña deriva su
 * color de un token dedicado, no de un hex por-campaña.
 */
export interface WhatsappCampaignTag {
  id: string;
  name: string;
}

/**
 * Etiqueta de conversación (Ola 5 — labels) — espejo del catálogo
 * `GET /messaging/labels` (`[{id,name,color}]`) y del sub-DTO `labels[]` que el
 * BE agrega a `ConversationListItemDto`. A diferencia de `WhatsappCampaignTag`
 * (color de token), la label SÍ trae `color` propio (hex del catálogo, editable
 * por el operador) — el chip lo pinta inline como fondo con texto de contraste
 * (`readableTextColor`), mismo criterio que un chip de label de Chatwoot.
 * Mismo shape que `WhatsappArea` ({id,name,color}) pero dominio distinto (una
 * conversación tiene UNA área y N labels), por eso NO se reusa el tipo.
 */
export interface WhatsappLabel {
  id: string;
  name: string;
  color: string;
}

export type ConversationAssignment = 'all' | 'mine' | 'unassigned';

export interface WhatsappConversationListItem {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  lastMessageAt: string | null;
  preview: string | null;
  status: string;
  /**
   * Aditivo (messaging-inbox-assignment F1.5-C2) — opcional para no romper
   * los fixtures existentes (ConversationList/ConversationListItem/
   * WhatsappInboxPage tests, anteriores a esta tanda) que construyen el DTO
   * sin estos 2 campos. El BE siempre manda `assignee`/`area` (`null` cuando
   * no hay asignación), nunca `undefined` — el FE los trata igual
   * (`conversation.assignee ?? null`), mismo criterio que `attachments`/
   * `private` en `WhatsappMessage` de más abajo.
   */
  assignee?: WhatsappAssignee | null;
  area?: WhatsappArea | null;
  /**
   * Aditivo (messaging-bulk-inbox Change 2) — campañas cuya audiencia incluye
   * a este cliente. El BE lo manda SIEMPRE (array vacío `[]` cuando no hay
   * ninguna, nunca `undefined`); opcional acá — mismo criterio defensivo que
   * `assignee`/`area` — para no romper los fixtures previos a esta tanda, que
   * construyen el DTO sin este campo. El FE lo consume con
   * `conversation.campaigns?.length` (mismo patrón falsy que `attachments`).
   */
  campaigns?: WhatsappCampaignTag[];
  /**
   * Aditivo (Ola 5 — labels) — etiquetas ASIGNADAS a esta conversación
   * (`ConversationListItemDto.labels`, ya en prod). El BE lo manda SIEMPRE
   * (array vacío `[]` cuando no hay ninguna, nunca `undefined`); opcional acá
   * — mismo criterio defensivo que `campaigns`/`assignee`/`area` — para no
   * romper los fixtures previos a esta tanda, que construyen el DTO sin este
   * campo. El FE lo consume con `conversation.labels?.length` (falsy si
   * ausente/vacío). El chip de cada label pinta su `color` inline.
   */
  labels?: WhatsappLabel[];
  /**
   * Aditivo (internal-notes F1.5 — INDICADOR EN LA FILA) — mirror EXACTO del
   * wire (`ConversationListItemDto.internalNoteCount`, ya en prod): cantidad
   * de notas internas VIVAS (no borradas) de la conversación. El BE lo manda
   * SIEMPRE (0 cuando no hay ninguna, nunca `undefined`); opcional acá — mismo
   * criterio defensivo que `campaigns`/`assignee`/`area` — para no romper los
   * fixtures previos a esta tanda. El FE lo consume con
   * `(conversation.internalNoteCount ?? 0) > 0` (ConversationListItem): 0 o
   * ausente = sin indicador.
   */
  internalNoteCount?: number;
  /**
   * Aditivo (Ola 6 — snooze) — mirror del wire (`ConversationListItemDto.
   * snoozedUntil`, ya en prod): timestamp ISO hasta el que la conversación
   * está POSPUESTA, o `null` si no está pospuesta. El BE lo manda siempre
   * (`null` cuando no hay snooze); opcional acá — mismo criterio defensivo que
   * `campaigns`/`labels` — para no romper los fixtures previos a esta tanda. El
   * FE lo consume con `isFutureSnooze(snoozedUntil)` (una fecha pasada = snooze
   * ya expirado, se trata como no-pospuesta).
   */
  snoozedUntil?: string | null;
}

export interface WhatsappClientContextClient {
  id: string;
  name: string;
  status: string;
}

export interface WhatsappClientContext {
  status: 'matched' | 'unknown' | 'ambiguous';
  clients: WhatsappClientContextClient[];
}

export interface WhatsappConversationDetail extends WhatsappConversationListItem {
  canReply: boolean;
  clientContext: WhatsappClientContext;
}

/**
 * WhatsappPreviousConversation (Ola 6 — conversaciones previas) — espejo del
 * item de `GET /messaging/conversations/:id/previous` (`{data:[…]}`): OTRAS
 * conversaciones del MISMO contacto (distintas de la abierta). Shape más
 * chico que `WhatsappConversationListItem` — solo lo que el panel de contexto
 * lista (id + preview + estado con color + labels + fecha + si tiene no
 * leídos). `assigneeName` viene ya aplanado a string (el BE resuelve el nombre
 * del agente asignado, o `null` si no hay).
 */
export interface WhatsappPreviousConversation {
  id: string;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  assigneeName: string | null;
  unread: boolean;
  labels: WhatsappLabel[];
}

/**
 * WhatsappConversationStatus (messaging-inbox-productivity F1.5-C v1 —
 * RESOLVER/REABRIR) — unión real del `status` que Chatwoot expone y que el
 * BE espeja (`ConversationListItem.status`/`ConversationDetail.status`
 * siguen tipados como `string` ancho por legado — ver la nota de arriba).
 * v1 SOLO deja setear `open`/`resolved` desde la UI (`useSetConversationStatus`,
 * `POST /messaging/conversations/:id/status`); `pending` queda contemplado
 * en el tipo (puede LLEGAR como status leído de Chatwoot) pero ningún
 * control de la UI lo dispara todavía.
 */
export type WhatsappConversationStatus = 'open' | 'resolved' | 'pending';

// ─── Media entrante (messaging-inbox-v2-media F1.5 fase A, Tanda 1 — RECIBIR)
// espejo de `ChatMessageAttachmentDto` (`ipnext-backend/src/application/dto/
// messaging.ts`, MEDIA-4). `url`/`thumbUrl` son rutas BE-proxy relativas al
// mismo origen (`/api/messaging/attachments/:id/file[?variant=thumb]`) — la
// cookie de sesión viaja sola, nunca se ve una URL de Chatwoot (spec §MEDIA-4/5).

export interface WhatsappChatMessageAttachment {
  id: string;
  fileType: 'image' | 'audio' | 'video' | 'file';
  contentType: string;
  filename: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  status: 'pending' | 'downloaded' | 'failed';
  url: string;
  thumbUrl: string | null;
}

export interface WhatsappMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  senderName: string | null;
  sentAt: string;
  /**
   * Aditivo (F2.2) — opcional para no romper los fixtures existentes que
   * construyen `WhatsappMessage` sin este campo (MessageThread/Composer/
   * useWhatsapp tests, anteriores a esta tanda). El BE siempre manda `[]`
   * cuando no hay adjuntos (nunca `undefined`); el FE lo consume con
   * `message.attachments?.length` (MessageBubble, F4) — mismo resultado
   * falsy en ambos casos.
   */
  attachments?: WhatsappChatMessageAttachment[];
  /**
   * Aditivo (messaging-inbox-notes F1.5 fase D — NOTA PRIVADA) — mirror
   * EXACTO del wire (`ChatMessageDto.private`, spec.md NOTE-5). A propósito
   * NO se llama `isPrivate` acá (aunque el dominio/BE internamente rename
   * `isPrivate`↔`private`): este tipo es un espejo campo-a-campo del DTO real
   * (ver header del archivo), y cualquier paso de mapeo extra es un lugar
   * más donde el flag podría "olvidarse" (design.md §0 — el mismo leak de F1,
   * más sutil). Opcional para no romper fixtures anteriores a esta tanda;
   * `undefined` se trata como `false` (degrade seguro si el BE aún no lo
   * expone).
   */
  private?: boolean;
  /**
   * Aditivo (internal-notes F1.5 — EDITAR/ELIMINAR NOTA) — mirror EXACTO del
   * wire (`ChatMessageDto`, ya en prod). Todos OPCIONALES: no viajan en
   * mensajes normales (reply/inbound) ni en fixtures previos a esta tanda —
   * `undefined` degrada seguro a `false`/sin-acciones. Solo las notas internas
   * (`private:true`) los traen poblados.
   *
   * - `authorId`: id del agente autor de la nota (o `null`). Base para que el
   *   BE decida `canEdit`/`canDelete`; el FE NO lo compara (confía en los
   *   flags resueltos por el BE, que ya conoce al usuario autenticado).
   * - `edited`: la nota fue editada al menos una vez → burbuja muestra "(editado)".
   * - `deleted`: TOMBSTONE — la nota fue borrada. Llega con `content:""`; la
   *   fila SIGUE en el hilo (el BE la devuelve igual). Sin acciones sobre ella.
   * - `canEdit`/`canDelete`: permiso YA resuelto por el BE para el usuario
   *   autenticado — el FE solo muestra la acción correspondiente si es `true`.
   */
  authorId?: string | null;
  edited?: boolean;
  deleted?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

// ─── Rich client context (messaging-inbox-v2 F1.5, RICH-1..6) — espejo de
// `InboxClientContextDto` (`ipnext-backend/src/application/dto/messaging.ts`).
// Distinto del `WhatsappClientContext` de arriba (F1, contexto LIGHT del
// detalle fetch-on-open): este es el contexto RICO, agregado bajo demanda vía
// `GET /messaging/conversations/:id/client-context` (`useInboxClientContext`,
// F2). `candidates` reusa `WhatsappClientContextClient` ({id,name,status}) —
// mismo shape liviano que usa el picker de `ambiguous`.

export type WhatsappInboxClientContextStatus = 'matched' | 'ambiguous' | 'unknown';

export interface WhatsappInboxClientBalance {
  due: number | null;
  currency: string | null;
  isDebtor: boolean;
  stale: boolean;
  lastRefreshedAt: string | null;
}

export interface WhatsappInboxInvoice {
  id: string;
  number: string;
  dueDate: string;
  amount: number;
  status: 'pagada' | 'pendiente' | 'vencida';
  balance: number | null;
}

export interface WhatsappInboxContract {
  id: string;
  plan: string;
  status: string;
  technology: string | null;
  address: string | null;
  serviceStatus: 'active' | 'reduced' | 'blocked' | 'baja' | 'inactive' | null;
}

export interface WhatsappInboxTicket {
  id: string;
  sequenceNumber: number;
  subject: string;
  status: string;
  priority: string;
}

export interface WhatsappInboxTask {
  id: string;
  sequenceNumber: number;
  title: string;
  status: string;
}

export interface WhatsappInboxLog {
  id: string;
  timestamp: string;
  eventType: string;
  description: string;
}

export interface WhatsappInboxClientSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'late' | 'blocked' | 'inactive' | 'baja';
  fichaClientId: string;
  balance: WhatsappInboxClientBalance;
  lastInvoice: WhatsappInboxInvoice | null;
  nextDueDate: string | null;
  contracts: WhatsappInboxContract[];
  openTicketsCount: number;
  recentTickets: WhatsappInboxTicket[];
  /**
   * Aditivo (messaging-inbox-v2 F1.5 spec #2 — ESTADOS ABIERTO/CERRADO). Top 2
   * tickets NO abiertos (resueltos/cerrados), ya truncados por el BE (RICH-3,
   * mismo criterio que `recentTickets`). Opcional para no romper los fixtures
   * existentes (FinancialSection/MatchedClientView/ClientContextPanel/
   * WhatsappInboxPage/useWhatsapp/whatsapp.api tests, anteriores a esta tanda)
   * que construyen el DTO sin este campo — el BE siempre manda `[]` cuando no
   * hay cerrados (nunca `undefined`); el FE lo trata igual que `recentTickets`
   * (`?? []`, mismo patrón defensivo, ver `InteractionsSection.tsx`).
   */
  recentClosedTickets?: WhatsappInboxTicket[];
  /** Aditivo, ver `recentClosedTickets` — total real (puede ser > 2, ya truncado arriba). */
  closedTicketsCount?: number;
  /**
   * Aditivo (F1.5 spec #2) — `recentTasks` ahora SOLO trae tareas abiertas
   * (antes traía cualquier estado); este es el total real de abiertas.
   */
  recentTasks: WhatsappInboxTask[];
  openTasksCount?: number;
  /** Aditivo (F1.5 spec #2) — top 2 tareas `closed`/`dismissed`. */
  recentClosedTasks?: WhatsappInboxTask[];
  /** Aditivo (F1.5 spec #2) — total real de tareas cerradas + descartadas. */
  closedTasksCount?: number;
  recentLogs: WhatsappInboxLog[];
}

/**
 * Aditivo (contador de conversaciones en INTERACCIONES) — espejo de
 * `conversations` TOP-LEVEL en `GET /messaging/conversations/:id/client-context`
 * (sibling de `client`, NO un campo de `WhatsappInboxClientSummary`): cuántas
 * veces el cliente abrió una conversación (abierta + resuelta/cerrada = 1
 * interacción). El BE lo manda en los 3 estados del contexto
 * (matched|ambiguous|unknown); ante un fallo interno manda ceros. Invariante
 * `total = open + resolved`.
 */
export interface WhatsappInboxConversationsSummary {
  total: number;
  open: number;
  resolved: number;
}

export interface WhatsappInboxClientContext {
  status: WhatsappInboxClientContextStatus;
  /** solo `ambiguous` sin `clientId` elegido — NO agrega datos hasta elegir. */
  candidates?: WhatsappClientContextClient[];
  /** `matched`, o el candidato ya elegido en `ambiguous`. */
  client?: WhatsappInboxClientSummary;
  /**
   * Aditivo — ver `WhatsappInboxConversationsSummary`. Opcional para no
   * romper los fixtures existentes (ClientContextPanel/MatchedClientView/
   * InteractionsSection tests, anteriores a esta tanda) que construyen el
   * contexto sin este campo — el FE renderiza defensivo con ceros si falta
   * (deploy FE puede llegar antes que un refetch que traiga el campo nuevo).
   */
  conversations?: WhatsappInboxConversationsSummary;
}

// ─── Envío de media (messaging-inbox-v2-media F1.5 fase A, Tanda 2 — ENVIAR)
// FE-only: nunca viajan al wire tal cual (design §3).

/** Draft local del composer — un archivo elegido, antes de enviar. */
export interface DraftAttachment {
  /** clave estable local (crypto.randomUUID(); fallback contador si no existe). */
  id: string;
  file: File;
  /** derivado del mimetype, ESPEJO del BE (image|video|audio|file). */
  fileType: WhatsappChatMessageAttachment['fileType'];
  /** objectURL para preview inline (image/video); null para audio/file (chip ícono). */
  previewUrl: string | null;
  /** validación client-side ANTES de subir. null = válido. */
  error: null | { code: 'UNSUPPORTED_TYPE' | 'TOO_LARGE'; message: string };
}

/** Envío optimista en vuelo — vive en un slice de cache no polleado (design §6.3). */
export interface PendingSend {
  /** id temporal del mensaje optimista (`optimistic:{uuid}`). */
  tempId: string;
  content: string;
  /** conserva los `File` para poder reintentar. */
  drafts: DraftAttachment[];
  /** 0..1, de `onUploadProgress` (axios). */
  progress: number;
  status: 'sending' | 'failed';
  /** ISO — orden estable en el merge del thread. */
  createdAt: string;
  /**
   * messaging-inbox-notes F1.5 fase D — NOTA PRIVADA (design §5). NO opcional
   * a propósito: es el único booleano que tiene que viajar intacto en TODO
   * envío en vuelo (reply o nota) — dejarlo opcional habilitaría un
   * `undefined` silencioso exactamente en el punto que `toOptimisticMessage`
   * (`MessageThread.tsx`) usa para decidir si la burbuja se pinta como nota.
   * FE-interno (sin equivalente 1:1 en el wire, a diferencia de
   * `WhatsappMessage.private`) — de ahí el nombre distinto.
   */
  isPrivate: boolean;
}

/**
 * inbox-views (Ola 1) — espejo EXACTO de `InboxViewCountsDto`
 * (`ipnext-backend/src/application/dto/messaging.ts`, worktree inbox-views-be):
 * contadores por VISTA del inbox para los badges del sub-menú lateral
 * (`GET /messaging/conversations/counts`, respuesta FLAT sin envelope).
 * `mine`/`unattended`/`all`/`unassigned` cuentan SOLO no-resueltas
 * (`status != 'resolved'`, bucket LS-1); `resolved` va aparte (match exacto).
 * NO confundir con `WhatsappInboxConversationsSummary` (interacciones de UN
 * contacto, panel de contexto) — este es el agregado GLOBAL del inbox.
 */
export interface WhatsappInboxViewCounts {
  /** No-resueltas asignadas al user autenticado. */
  mine: number;
  /** No-resueltas cuyo último mensaje público es inbound (Sin atender). */
  unattended: number;
  /** Todas las no-resueltas. */
  all: number;
  /** No-resueltas sin assignee. */
  unassigned: number;
  /** status === 'resolved' (bucket aparte, no solapa con los otros). */
  resolved: number;
  /**
   * Ola 6 (menciones) — conversaciones con una mención NO LEÍDA del user
   * autenticado (incluye resueltas, mismo criterio que `view=mentioned`). El BE
   * lo agregó al DTO de counts; opcional acá para no romper los fixtures
   * previos a esta tanda (degrada a "sin número" en el badge, como cualquier
   * count ausente).
   */
  mentioned?: number;
  /**
   * Ola 6 (snooze) — pospuestas vigentes (`snoozedUntil` en el futuro). Mismo
   * criterio de opcionalidad/backcompat que `mentioned`.
   */
  snoozed?: number;
}

// ─── Pagination (espejo de `application/dto/pagination.ts`) ─────────────────

export interface WhatsappPaginatedQuery {
  page?: number;
  limit?: number;
  /** messaging-inbox-assignment F1.5-C2 — filtro server-side (LIST-1 enmendado). */
  assignment?: ConversationAssignment;
  /**
   * messaging-bulk-inbox Change 2 — filtro server-side por campaña
   * (`GET /messaging/conversations?campaignId=<id>`, JOIN Conversation×
   * CampaignRecipient). Mismo criterio que `assignment`: solo se manda cuando
   * viene definido (ausente = "Todas las campañas").
   */
  campaignId?: string;
  /**
   * Ola 5 (labels) — filtro server-side por etiqueta
   * (`GET /messaging/conversations?labelId=<id>`). Eje PROPIO, ORTOGONAL a
   * `assignment`/`campaignId`/`view`/`status` (combina con todos ellos, mismo
   * criterio: solo se manda cuando viene definido; ausente = "Todas las
   * etiquetas").
   */
  labelId?: string;
  /**
   * inbox-resolve (API-1) — filtro server-side por ciclo de vida, espejo del
   * contrato BE (`GET /messaging/conversations?status=open|resolved`).
   * `'open'` es un BUCKET (`status != 'resolved'`), no un match exacto —
   * `pending`/`snoozed` entran ahí (design.md D2). Mismo criterio que
   * `assignment`/`campaignId`: solo se manda cuando viene definido; el FE
   * (`WhatsappInboxPage`) manda `'open'` explícito como default VISUAL, el
   * default del CONTRATO (ausente = sin filtro) no cambia.
   */
  status?: 'open' | 'resolved';
  /**
   * inbox-views (Ola 1, VIEW-2) — bucket "Sin atender" server-side
   * (`GET /messaging/conversations?view=unattended`): no-resuelta cuyo último
   * mensaje público es del cliente. Eje PROPIO, ORTOGONAL a `assignment`
   * (`view=unattended&assignment=mine` es un AND válido en el BE) y GANA
   * sobre `status` (el bucket ya lleva su propio filtro de ciclo de vida).
   * Mismo criterio que el resto: solo se manda cuando viene definido.
   *
   * Ola 6 amplía el eje con 2 buckets propios más:
   * - `mentioned`: conversaciones con una mención NO LEÍDA del user actual.
   *   MUESTRA RESUELTAS también (a diferencia de `unattended`/`snoozed`) — una
   *   mención te reclama aunque la conversación ya esté resuelta.
   * - `snoozed`: pospuestas VIGENTES (`snoozedUntil` en el futuro).
   */
  view?: 'unattended' | 'mentioned' | 'snoozed';
}

export interface WhatsappPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
