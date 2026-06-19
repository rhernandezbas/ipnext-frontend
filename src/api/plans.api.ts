import axiosClient from './axios-client';
import type { PlanDto, CreatePlanDto, UpdatePlanDto } from '@/types/plans';

export const getPlans = () =>
  axiosClient.get<PlanDto[]>('/plans').then(r => r.data);

export const createPlan = (data: CreatePlanDto) =>
  axiosClient.post<PlanDto>('/plans', data).then(r => r.data);

export const updatePlan = (id: string, data: UpdatePlanDto) =>
  axiosClient.patch<PlanDto>(`/plans/${id}`, data).then(r => r.data);

export const deletePlan = (id: string) =>
  axiosClient.delete(`/plans/${id}`);
