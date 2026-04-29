import axiosClient from './axios-client';
import type { Partner } from '../types/partner';

const BASE = '/partners';

export const getPartners = () => axiosClient.get<Partner[]>(BASE).then(r => r.data);
export const getPartner = (id: string) => axiosClient.get<Partner>(`${BASE}/${id}`).then(r => r.data);
export const createPartner = (data: Omit<Partner, 'id' | 'createdAt' | 'clientCount' | 'adminCount'>) =>
  axiosClient.post<Partner>(BASE, data).then(r => r.data);
export const updatePartner = (id: string, data: Partial<Partner>) =>
  axiosClient.put<Partner>(`${BASE}/${id}`, data).then(r => r.data);
export const deletePartner = (id: string) => axiosClient.delete(`${BASE}/${id}`);
