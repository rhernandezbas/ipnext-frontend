import axiosClient from './axios-client';
import type { VoipCategory, VoipCdr, VoipPlan, VoipPrefix } from '@/types/voz';

const BASE = '/voip';

export const listVoipCategories = () =>
  axiosClient.get<VoipCategory[]>(`${BASE}/categories`).then(r => r.data);

export const createVoipCategory = (data: Omit<VoipCategory, 'id'>) =>
  axiosClient.post<VoipCategory>(`${BASE}/categories`, data).then(r => r.data);

export const listVoipCdrs = () =>
  axiosClient.get<VoipCdr[]>(`${BASE}/cdr`).then(r => r.data);

export const listVoipPlans = () =>
  axiosClient.get<VoipPlan[]>(`${BASE}/plans`).then(r => r.data);

export const createVoipPlan = (data: Omit<VoipPlan, 'id'>) =>
  axiosClient.post<VoipPlan>(`${BASE}/plans`, data).then(r => r.data);

export const listVoipPrefixes = () =>
  axiosClient.get<VoipPrefix[]>(`${BASE}/prefixes`).then(r => r.data);
