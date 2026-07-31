import axiosClient from './axios-client';
import type { TicketMessage, SendStaffTicketReplyInput } from '@/types/ticketMessages';

const BASE = '/tickets';

/**
 * POST /tickets/:ticketId/messages — respuesta PÚBLICA del staff (gated
 * `tickets.write`, BE). multipart/form-data, field name `files` (mirror del
 * BE — `TICKET_MESSAGE_FILES_FIELD`, `ticketMessageUpload.ts`). SIEMPRE crea
 * `visibility: 'public'` — la ruta no acepta ese campo en el body
 * (`.strict()`), así que este cliente ni lo manda.
 */
export const sendStaffTicketReply = (input: SendStaffTicketReplyInput) => {
  const form = new FormData();
  form.append('body', input.body);
  if (input.authorName) form.append('authorName', input.authorName);
  for (const file of input.files) form.append('files', file);
  return axiosClient
    .post<TicketMessage>(`${BASE}/${input.ticketId}/messages`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(r => r.data);
};

/** GET /tickets/:ticketId/messages/unread-count — gated `tickets.read`. */
export const getTicketUnreadCount = (ticketId: string) =>
  axiosClient
    .get<{ unreadCount: number }>(`${BASE}/${ticketId}/messages/unread-count`)
    .then(r => r.data.unreadCount);
