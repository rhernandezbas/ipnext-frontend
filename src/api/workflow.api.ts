import axiosClient from './axios-client';
import type { Workflow } from '@/types/workflow';

export const getWorkflow = (id: string) =>
  axiosClient.get<Workflow>(`/scheduling/workflows/${id}`).then(r => r.data);

export const listWorkflows = () =>
  axiosClient.get<Workflow[]>('/scheduling/workflows').then(r => r.data);
