import axiosClient from './axios-client';
import type {
  ServiceInstalledItem,
  AddInstalledItemInput,
  UpdateInstalledItemInput,
  TaskInventorySuggestion,
} from '@/types/serviceInventory';

// ── Contract (Service) installed items ──────────────────────────────────────
export const listServiceInstalledItems = (serviceId: string) =>
  axiosClient.get<ServiceInstalledItem[]>(`/services/${serviceId}/inventory`).then(r => r.data);

export const addInstalledItem = (serviceId: string, input: AddInstalledItemInput) =>
  axiosClient.post<ServiceInstalledItem>(`/services/${serviceId}/inventory`, input).then(r => r.data);

export const updateInstalledItem = (serviceId: string, itemId: string, patch: UpdateInstalledItemInput) =>
  axiosClient.patch<ServiceInstalledItem>(`/services/${serviceId}/inventory/${itemId}`, patch).then(r => r.data);

// ── Task-scoped suggestion staging ──────────────────────────────────────────
export const listTaskInventorySuggestions = (taskId: string) =>
  axiosClient.get<TaskInventorySuggestion[]>(`/scheduling/${taskId}/inventory/suggestions`).then(r => r.data);

export const confirmInventorySuggestion = (taskId: string, suggestionId: string) =>
  axiosClient
    .post<ServiceInstalledItem>(`/scheduling/${taskId}/inventory/suggestions/${suggestionId}/confirm`)
    .then(r => r.data);

export const discardInventorySuggestion = (taskId: string, suggestionId: string) =>
  axiosClient
    .post<TaskInventorySuggestion>(`/scheduling/${taskId}/inventory/suggestions/${suggestionId}/discard`)
    .then(r => r.data);
