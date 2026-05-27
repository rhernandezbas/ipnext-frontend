import axiosClient from './axios-client';
import type { ServicePlan } from '../types/service-plans';

export const getServicePlans = () =>
  axiosClient.get<ServicePlan[]>('/service-plans').then(r => r.data);

export const getServicePlan = (id: string) =>
  axiosClient.get<ServicePlan>(`/service-plans/${id}`).then(r => r.data);

export const createServicePlan = (data: Omit<ServicePlan, 'id'>) =>
  axiosClient.post<ServicePlan>('/service-plans', data).then(r => r.data);

export const updateServicePlan = (id: string, data: Partial<ServicePlan>) =>
  axiosClient.put<ServicePlan>(`/service-plans/${id}`, data).then(r => r.data);

export const deleteServicePlan = (id: string) =>
  axiosClient.delete(`/service-plans/${id}`);
