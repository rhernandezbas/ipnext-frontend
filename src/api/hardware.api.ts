import axiosClient from './axios-client';
import type { HardwareAsset } from '../types/hardware';

export const getHardwareAssets = () =>
  axiosClient.get<HardwareAsset[]>('/hardware').then(r => r.data);

export const createHardwareAsset = (data: Omit<HardwareAsset, 'id'>) =>
  axiosClient.post<HardwareAsset>('/hardware', data).then(r => r.data);

export const updateHardwareAsset = (id: string, data: Partial<HardwareAsset>) =>
  axiosClient.put<HardwareAsset>(`/hardware/${id}`, data).then(r => r.data);

export const deleteHardwareAsset = (id: string) =>
  axiosClient.delete(`/hardware/${id}`);
