import axiosClient from './axios-client';
import type { CpeDevice } from '../types/cpe';

export const getCpeDevices = () =>
  axiosClient.get<CpeDevice[]>('/cpe').then(r => r.data);

export const createCpeDevice = (data: Omit<CpeDevice, 'id'>) =>
  axiosClient.post<CpeDevice>('/cpe', data).then(r => r.data);

export const updateCpeDevice = (id: string, data: Partial<CpeDevice>) =>
  axiosClient.put<CpeDevice>(`/cpe/${id}`, data).then(r => r.data);

export const deleteCpeDevice = (id: string) =>
  axiosClient.delete(`/cpe/${id}`);

export const assignCpeToClient = (id: string, clientId: string, clientName: string) =>
  axiosClient.post<CpeDevice>(`/cpe/${id}/assign`, { clientId, clientName }).then(r => r.data);
