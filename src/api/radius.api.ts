import axiosClient from './axios-client';
import type { RadiusSession } from '../types/radiusSessions';

export const getRadiusSessions = () =>
  axiosClient.get<RadiusSession[]>('/radius/sessions').then(r => r.data);

export const disconnectSession = (id: string) =>
  axiosClient.delete<{ success: boolean }>(`/radius/sessions/${id}`).then(r => r.data);
