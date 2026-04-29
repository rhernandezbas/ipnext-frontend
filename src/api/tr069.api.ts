import axiosClient from './axios-client';
import type { Tr069Profile, Tr069Device } from '../types/tr069';

export const getTr069Profiles = () =>
  axiosClient.get<Tr069Profile[]>('/tr069/profiles').then(r => r.data);

export const createTr069Profile = (data: Omit<Tr069Profile, 'id'>) =>
  axiosClient.post<Tr069Profile>('/tr069/profiles', data).then(r => r.data);

export const updateTr069Profile = (id: string, data: Partial<Tr069Profile>) =>
  axiosClient.put<Tr069Profile>(`/tr069/profiles/${id}`, data).then(r => r.data);

export const deleteTr069Profile = (id: string) =>
  axiosClient.delete(`/tr069/profiles/${id}`);

export const getTr069Devices = () =>
  axiosClient.get<Tr069Device[]>('/tr069/devices').then(r => r.data);

export const provisionDevice = (id: string) =>
  axiosClient.post<Tr069Device>(`/tr069/devices/${id}/provision`).then(r => r.data);

export const deleteTr069Device = (id: string) =>
  axiosClient.delete(`/tr069/devices/${id}`);
