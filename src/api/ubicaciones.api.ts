import axiosClient from './axios-client';
import type { Ubicacion } from '@/types/ubicacion';

const BASE = '/locations';

export const getUbicaciones = () => axiosClient.get<Ubicacion[]>(BASE).then(r => r.data);
export const getUbicacion = (id: string) => axiosClient.get<Ubicacion>(`${BASE}/${id}`).then(r => r.data);
export const createUbicacion = (data: Omit<Ubicacion, 'id'>) =>
  axiosClient.post<Ubicacion>(BASE, data).then(r => r.data);
export const updateUbicacion = (id: string, data: Partial<Ubicacion>) =>
  axiosClient.put<Ubicacion>(`${BASE}/${id}`, data).then(r => r.data);
export const deleteUbicacion = (id: string) => axiosClient.delete(`${BASE}/${id}`);
