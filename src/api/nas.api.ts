import axiosClient from './axios-client';
import type { NasServer, RadiusConfig } from '../types/nas';

export const getNasServers = () =>
  axiosClient.get<NasServer[]>('/nas-servers').then(r => r.data);

export const getNasServer = (id: string) =>
  axiosClient.get<NasServer>(`/nas-servers/${id}`).then(r => r.data);

export const createNasServer = (data: Omit<NasServer, 'id'>) =>
  axiosClient.post<NasServer>('/nas-servers', data).then(r => r.data);

export const updateNasServer = (id: string, data: Partial<NasServer>) =>
  axiosClient.put<NasServer>(`/nas-servers/${id}`, data).then(r => r.data);

export const deleteNasServer = (id: string) =>
  axiosClient.delete(`/nas-servers/${id}`);

export const getRadiusConfig = () =>
  axiosClient.get<RadiusConfig>('/radius-config').then(r => r.data);

export const updateRadiusConfig = (data: Partial<RadiusConfig>) =>
  axiosClient.put<RadiusConfig>('/radius-config', data).then(r => r.data);
