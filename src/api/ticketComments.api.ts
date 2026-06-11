import axiosClient from './axios-client';
import type { TicketComment, AddTicketCommentInput } from '@/types/ticketComments';

const BASE = '/tickets';

export const listTicketComments = (ticketId: string) =>
  axiosClient
    .get<TicketComment[]>(`${BASE}/${ticketId}/comments`)
    .then(r => r.data);

export const addTicketComment = (input: AddTicketCommentInput) =>
  axiosClient
    .post<TicketComment>(`${BASE}/${input.ticketId}/comments`, {
      body: input.body,
      authorName: input.authorName,
      attachments: input.attachments,
    })
    .then(r => r.data);
