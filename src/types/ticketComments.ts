// #44 — Ticket comments wire contract (mirror of taskComments, FROZEN for the
// legacy write path: attachments still travel as base64 data-URIs, image-only,
// máx 3, 2MB c/u, via POST /:ticketId/comments).
//
// ticket-messaging-ui — GET /:ticketId/comments (`useTicketComments`) is the
// SINGLE merged thread: it returns every comment regardless of visibility,
// including the ones created by the NEW public-reply route
// (POST /:ticketId/messages, ver `ticketMessages.ts`) — same repo/table on the
// BE (`ListTicketComments`, sin filtro). `authorKind`/`visibility` son los
// campos que la UI usa para separar las 3 lanes (nota interna / respuesta
// pública del staff / mensaje del cliente) — antes se leían del DTO pero el
// tipo del FE los descartaba.
export type TicketCommentAuthorKind = 'client' | 'staff';
export type TicketCommentVisibility = 'public' | 'internal';
/** 'image' | 'audio' | 'video' — null en adjuntos viejos (legacy, siempre imagen). */
export type TicketCommentAttachmentKind = 'image' | 'audio' | 'video';

export interface TicketCommentAttachment {
  id: string;
  commentId: string;
  url: string | null;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  /** Ausente en fixtures/tests legacy — tratar como `null` (adjunto viejo, siempre imagen). */
  kind?: TicketCommentAttachmentKind | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  /** Ausente en fixtures legacy — cuando falta, la UI trata el comentario como público/staff. */
  authorId?: string | null;
  authorKind?: TicketCommentAuthorKind;
  visibility?: TicketCommentVisibility;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: TicketCommentAttachment[];
}

export interface AddTicketCommentInput {
  ticketId: string;
  authorName: string;
  body: string;
  attachments: Array<{
    url: string;
    filename: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
}
