import axiosClient from './axios-client';
import type { IpNetwork, IpPool, Ipv6Network, PaginatedAssignments } from '../types/network';

export const getIpNetworks = () =>
  axiosClient.get<IpNetwork[]>('/ip-networks').then(r => r.data);

export const createIpNetwork = (data: Omit<IpNetwork, 'id'>) =>
  axiosClient.post<IpNetwork>('/ip-networks', data).then(r => r.data);

export const deleteIpNetwork = (id: string) =>
  axiosClient.delete(`/ip-networks/${id}`);

export const getIpPools = () =>
  axiosClient.get<IpPool[]>('/ip-pools').then(r => r.data);

export const createIpPool = (data: Omit<IpPool, 'id'>) =>
  axiosClient.post<IpPool>('/ip-pools', data).then(r => r.data);

export const deleteIpPool = (id: string) =>
  axiosClient.delete(`/ip-pools/${id}`);

export interface GetIpAssignmentsParams {
  page: number;
  pageSize: number;
  search?: string;
  nasId?: string;
}

export const getIpAssignments = (params: GetIpAssignmentsParams) => {
  const p = new URLSearchParams();
  p.set('page', String(params.page));
  p.set('pageSize', String(params.pageSize));
  if (params.search) p.set('search', params.search);
  if (params.nasId) p.set('nasId', params.nasId);
  return axiosClient.get<PaginatedAssignments>(`/ip-assignments?${p.toString()}`).then(r => r.data);
};

export const getIpv6Networks = () =>
  axiosClient.get<Ipv6Network[]>('/ipv6-networks').then(r => r.data);

export const createIpv6Network = (data: Omit<Ipv6Network, 'id'>) =>
  axiosClient.post<Ipv6Network>('/ipv6-networks', data).then(r => r.data);
