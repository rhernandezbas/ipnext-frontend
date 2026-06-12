import axiosClient from './axios-client';
import type { TicketArea } from '@/types/ticketArea';

const BASE = '/tickets/areas';

export const ticketAreasApi = {
  list: () => axiosClient.get<TicketArea[]>(BASE).then(r => r.data),
  getById: (id: string) => axiosClient.get<TicketArea>(`${BASE}/${id}`).then(r => r.data),
  create: (data: { name: string }) =>
    axiosClient.post<TicketArea>(BASE, data).then(r => r.data),
  update: (id: string, data: { name?: string }) =>
    axiosClient.put<TicketArea>(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
