import axiosClient from './axios-client';
import type { TicketStatus } from '@/types/ticketStatus';

const BASE = '/tickets/statuses';

export const ticketStatusesApi = {
  list: () => axiosClient.get<TicketStatus[]>(BASE).then(r => r.data),
  getById: (id: string) => axiosClient.get<TicketStatus>(`${BASE}/${id}`).then(r => r.data),
  create: (data: { name: string; color: string; weight: number }) =>
    axiosClient.post<TicketStatus>(BASE, data).then(r => r.data),
  update: (id: string, data: { name?: string; color?: string; weight?: number }) =>
    axiosClient.put<TicketStatus>(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
