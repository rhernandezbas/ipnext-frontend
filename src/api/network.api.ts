import axiosClient from './axios-client';
import type { IpNetwork, IpPool, IpAssignment, Ipv6Network } from '../types/network';

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

export const getIpAssignments = () =>
  axiosClient.get<IpAssignment[]>('/ip-assignments').then(r => r.data);

export const getIpv6Networks = () =>
  axiosClient.get<Ipv6Network[]>('/ipv6-networks').then(r => r.data);

export const createIpv6Network = (data: Omit<Ipv6Network, 'id'>) =>
  axiosClient.post<Ipv6Network>('/ipv6-networks', data).then(r => r.data);
