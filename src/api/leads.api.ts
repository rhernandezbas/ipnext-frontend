import axiosClient from './axios-client';
import type { Lead } from '@/types/lead';

const BASE = '/leads';

export const getLeads = () => axiosClient.get<Lead[]>(BASE).then(r => r.data);
export const getLead = (id: string) => axiosClient.get<Lead>(`${BASE}/${id}`).then(r => r.data);
export const createLead = (data: Omit<Lead, 'id' | 'createdAt' | 'convertedAt' | 'convertedClientId'>) =>
  axiosClient.post<Lead>(BASE, data).then(r => r.data);
export const updateLead = (id: string, data: Partial<Lead>) =>
  axiosClient.put<Lead>(`${BASE}/${id}`, data).then(r => r.data);
export const deleteLead = (id: string) => axiosClient.delete(`${BASE}/${id}`);
export const convertLeadToClient = (id: string, clientId: string) =>
  axiosClient.post<Lead>(`${BASE}/${id}/convert`, { clientId }).then(r => r.data);
