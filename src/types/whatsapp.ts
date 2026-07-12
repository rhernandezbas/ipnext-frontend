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

export interface WhatsappMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  senderName: string | null;
  sentAt: string;
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
