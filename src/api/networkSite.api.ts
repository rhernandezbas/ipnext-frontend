import axiosClient from './axios-client';
import type { NetworkSite } from '../types/networkSite';

export const getNetworkSites = () =>
  axiosClient.get<NetworkSite[]>('/network-sites').then(r => r.data);

export const createNetworkSite = (data: Omit<NetworkSite, 'id'>) =>
  axiosClient.post<NetworkSite>('/network-sites', data).then(r => r.data);

export const updateNetworkSite = (id: string, data: Partial<NetworkSite>) =>
  axiosClient.put<NetworkSite>(`/network-sites/${id}`, data).then(r => r.data);

export const deleteNetworkSite = (id: string) =>
  axiosClient.delete(`/network-sites/${id}`);
