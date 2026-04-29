import axiosClient from './axios-client';
import type { AdminRole_Definition } from '../types/role';

const BASE = '/roles';

export const getRoles = () => axiosClient.get<AdminRole_Definition[]>(BASE).then(r => r.data);
export const getRole = (id: string) => axiosClient.get<AdminRole_Definition>(`${BASE}/${id}`).then(r => r.data);
export const createRole = (data: Omit<AdminRole_Definition, 'id'>) =>
  axiosClient.post<AdminRole_Definition>(BASE, data).then(r => r.data);
export const updateRole = (id: string, data: Partial<AdminRole_Definition>) =>
  axiosClient.put<AdminRole_Definition>(`${BASE}/${id}`, data).then(r => r.data);
