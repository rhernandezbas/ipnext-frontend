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
