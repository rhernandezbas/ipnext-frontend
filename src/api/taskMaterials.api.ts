import axiosClient from './axios-client';
import type { TaskMaterialConsumption, RecordTaskMaterialInput } from '@/types/taskMaterial';

const base = (taskId: string) => `/scheduling/${taskId}/inventory/materials`;

export const taskMaterialsApi = {
  list: (taskId: string) =>
    axiosClient.get<TaskMaterialConsumption[]>(base(taskId)).then(r => r.data),
  record: (taskId: string, input: RecordTaskMaterialInput) =>
    axiosClient.post<TaskMaterialConsumption>(base(taskId), input).then(r => r.data),
  delete: (taskId: string, id: string) =>
    axiosClient.delete(`${base(taskId)}/${id}`),
};
