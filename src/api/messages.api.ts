import axiosClient from './axios-client';
import type { Message, CreateMessagePayload } from '@/types/message';

const BASE = '/messages';

export const getMessages = (filter?: 'inbox' | 'sent' | 'draft') =>
  axiosClient.get<Message[]>(BASE, { params: filter ? { filter } : {} }).then(r => r.data);

export const getMessage = (id: string) =>
  axiosClient.get<Message>(`${BASE}/${id}`).then(r => r.data);

export const createMessage = (data: CreateMessagePayload) =>
  axiosClient.post<Message>(BASE, data).then(r => r.data);

export const markMessageAsRead = (id: string) =>
  axiosClient.patch<Message>(`${BASE}/${id}/read`).then(r => r.data);

export const deleteMessage = (id: string) =>
  axiosClient.delete(`${BASE}/${id}`);
