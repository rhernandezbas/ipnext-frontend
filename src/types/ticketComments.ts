// #44 — Ticket comments wire contract (mirror of taskComments, FROZEN).
// Attachments travel as base64 data-URIs (image-only, máx 3, 2MB c/u).

export interface TicketCommentAttachment {
  id: string;
  commentId: string;
  url: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
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
