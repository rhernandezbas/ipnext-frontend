/**
 * whatsapp (messaging-inbox F1, design §3) — espejo campo a campo del BE real
 * (`ipnext-backend/src/application/dto/messaging.ts` + `dto/pagination.ts`, NO el
 * boceto del design.md del BE). Naming `Whatsapp`-prefixed para no colisionar con
 * el módulo interno `Message` (`useMessages.ts`/`messages.api.ts`).
 *
 * Drift cerrado (design §3, spec.md LIST-1 enmendado): `ConversationListItemDto`
 * NO tiene `unreadCount` ni `canReply` — esos campos solo existen en el detalle
 * (`ConversationDetailDto`, fetch-on-open). El badge de fila usa `status`.
 */

export interface WhatsappConversationListItem {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  lastMessageAt: string | null;
  preview: string | null;
  status: string;
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
  recentTasks: WhatsappInboxTask[];
  recentLogs: WhatsappInboxLog[];
}

export interface WhatsappInboxClientContext {
  status: WhatsappInboxClientContextStatus;
  /** solo `ambiguous` sin `clientId` elegido — NO agrega datos hasta elegir. */
  candidates?: WhatsappClientContextClient[];
  /** `matched`, o el candidato ya elegido en `ambiguous`. */
  client?: WhatsappInboxClientSummary;
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

// ─── Pagination (espejo de `application/dto/pagination.ts`) ─────────────────

export interface WhatsappPaginatedQuery {
  page?: number;
  limit?: number;
}

export interface WhatsappPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
