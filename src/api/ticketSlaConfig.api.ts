import axiosClient from './axios-client';
import type { TicketSlaConfig } from '@/types/ticketSlaConfig';

const BASE = '/tickets/sla-config';

export const ticketSlaConfigApi = {
  get: () => axiosClient.get<TicketSlaConfig>(BASE).then(r => r.data),
  update: (data: Partial<TicketSlaConfig>) =>
    axiosClient.put<TicketSlaConfig>(BASE, data).then(r => r.data),
};
