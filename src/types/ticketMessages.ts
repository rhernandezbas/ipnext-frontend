// ticket-messaging-ui — wire contract of the NEW "respuesta pública al
// cliente" write path (POST /api/tickets/:ticketId/messages,
// `SendStaffTicketReplySchema` / `toTicketMessageDto` en el BE,
// `ticketMessages.routes.ts`). SIEMPRE crea `visibility: 'public'` /
// `authorKind: 'staff'` — la ruta jamás acepta esos campos en el body
// (`.strict()` en el BE: si viajan, 400).
//
// El GET del hilo sigue siendo `GET /:ticketId/comments`
// (`useTicketComments`, `types/ticketComments.ts`) — este archivo NO define un
// GET propio de "messages": `POST /:ticketId/messages` devuelve el comentario
// recién creado (para pintarlo optimista/sin esperar el refetch), pero la
// fuente de verdad del hilo sigue siendo la lista de comentarios, que ya
// incluye los mensajes públicos (mismo repo/tabla en el BE).
import type {
  TicketCommentAttachmentKind,
  TicketCommentAuthorKind,
  TicketCommentVisibility,
} from './ticketComments';

export interface TicketMessageAttachment {
  id: string;
  kind: TicketCommentAttachmentKind | null;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Auth-gated, BE-proxy: `/api/tickets/messages/attachments/{id}/file`. */
  url: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorKind: TicketCommentAuthorKind;
  visibility: TicketCommentVisibility;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: TicketMessageAttachment[];
}

export interface SendStaffTicketReplyInput {
  ticketId: string;
  /** Puede ser '' cuando hay adjuntos (el BE exige body no-vacío O al menos un adjunto). */
  body: string;
  authorName?: string;
  files: File[];
}

/** Límites — mirror de `application/use-cases/ticketMessageAttachments.ts` (BE, fuente de verdad). */
export const TICKET_MESSAGE_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const TICKET_MESSAGE_MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const TICKET_MESSAGE_MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const TICKET_MESSAGE_MAX_ATTACHMENTS = 5;
export const TICKET_MESSAGE_MAX_TOTAL_BATCH_BYTES = 60 * 1024 * 1024;
export const TICKET_MESSAGE_MAX_BODY_LEN = 4000;

/** Mirror de `IMAGE/AUDIO/VIDEO_MIME_TO_EXT` (BE) — usado para el `accept` del input y la validación client-side. */
export const TICKET_MESSAGE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const TICKET_MESSAGE_AUDIO_MIME_TYPES = [
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/x-m4a',
];
export const TICKET_MESSAGE_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];

export function classifyTicketMessageFile(mimeType: string): { kind: TicketCommentAttachmentKind; maxBytes: number } | null {
  if (TICKET_MESSAGE_IMAGE_MIME_TYPES.includes(mimeType)) return { kind: 'image', maxBytes: TICKET_MESSAGE_MAX_IMAGE_BYTES };
  if (TICKET_MESSAGE_AUDIO_MIME_TYPES.includes(mimeType)) return { kind: 'audio', maxBytes: TICKET_MESSAGE_MAX_AUDIO_BYTES };
  if (TICKET_MESSAGE_VIDEO_MIME_TYPES.includes(mimeType)) return { kind: 'video', maxBytes: TICKET_MESSAGE_MAX_VIDEO_BYTES };
  return null;
}
