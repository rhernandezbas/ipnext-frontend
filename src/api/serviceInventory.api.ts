import axiosClient from './axios-client';
import type {
  ServiceInstalledItem,
  AddInstalledItemInput,
  UpdateInstalledItemInput,
  TaskInventorySuggestion,
  InstalledItemType,
} from '@/types/serviceInventory';

// ── Contract installed items ────────────────────────────────────────────────
export const listServiceInstalledItems = (contractId: string) =>
  axiosClient.get<ServiceInstalledItem[]>(`/contracts/${contractId}/inventory`).then(r => r.data);

export const addInstalledItem = (contractId: string, input: AddInstalledItemInput) =>
  axiosClient.post<ServiceInstalledItem>(`/contracts/${contractId}/inventory`, input).then(r => r.data);

export const updateInstalledItem = (contractId: string, itemId: string, patch: UpdateInstalledItemInput) =>
  axiosClient.patch<ServiceInstalledItem>(`/contracts/${contractId}/inventory/${itemId}`, patch).then(r => r.data);

// ── Task-scoped suggestion staging ──────────────────────────────────────────
export const listTaskInventorySuggestions = (taskId: string) =>
  axiosClient.get<TaskInventorySuggestion[]>(`/scheduling/${taskId}/inventory/suggestions`).then(r => r.data);

export const confirmInventorySuggestion = (taskId: string, suggestionId: string, typeOverride?: InstalledItemType) =>
  axiosClient
    .post<ServiceInstalledItem>(
      `/scheduling/${taskId}/inventory/suggestions/${suggestionId}/confirm`,
      typeOverride ? { type: typeOverride } : {},
    )
    .then(r => r.data);

export const discardInventorySuggestion = (taskId: string, suggestionId: string) =>
  axiosClient
    .post<TaskInventorySuggestion>(`/scheduling/${taskId}/inventory/suggestions/${suggestionId}/discard`)
    .then(r => r.data);
