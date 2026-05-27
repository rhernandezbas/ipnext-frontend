import axiosClient from './axios-client';
import type { NetworkDevice } from '../types/network-devices';

export const getNetworkDevices = () =>
  axiosClient.get<NetworkDevice[]>('/network-devices').then(r => r.data);

export const getNetworkDevice = (id: string) =>
  axiosClient.get<NetworkDevice>(`/network-devices/${id}`).then(r => r.data);

export const createNetworkDevice = (data: Omit<NetworkDevice, 'id'>) =>
  axiosClient.post<NetworkDevice>('/network-devices', data).then(r => r.data);

export const updateNetworkDevice = (id: string, data: Partial<NetworkDevice>) =>
  axiosClient.put<NetworkDevice>(`/network-devices/${id}`, data).then(r => r.data);
