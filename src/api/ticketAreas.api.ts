import axiosClient from './axios-client';
import type { TicketArea } from '@/types/ticketArea';

const BASE = '/tickets/areas';

/** portal-topic-admin — payload de los 4 campos de visibilidad en la app de clientes. */
interface TicketAreaPortalFields {
  portalVisible?: boolean;
  /** `null` para borrar/limpiar; el BE rechaza `""` con 400 (.trim().min(1)). */
  portalLabel?: string | null;
  portalDescription?: string | null;
  portalOrder?: number;
}

export interface CreateTicketAreaData extends TicketAreaPortalFields {
  name: string;
  color: string;
}

export interface UpdateTicketAreaData extends TicketAreaPortalFields {
  name?: string;
  color?: string;
}

export const ticketAreasApi = {
  list: () => axiosClient.get<TicketArea[]>(BASE).then(r => r.data),
  getById: (id: string) => axiosClient.get<TicketArea>(`${BASE}/${id}`).then(r => r.data),
  create: (data: CreateTicketAreaData) =>
    axiosClient.post<TicketArea>(BASE, data).then(r => r.data),
  update: (id: string, data: UpdateTicketAreaData) =>
    axiosClient.put<TicketArea>(`${BASE}/${id}`, data).then(r => r.data),
  delete: (id: string) => axiosClient.delete(`${BASE}/${id}`),
};
