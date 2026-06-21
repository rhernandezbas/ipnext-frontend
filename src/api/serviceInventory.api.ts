import axiosClient from './axios-client';
import type {
  ServiceInstalledItem,
  ClientInstalledItem,
  AddInstalledItemInput,
  UpdateInstalledItemInput,
  TaskInventorySuggestion,
  InstalledItemType,
  ConfirmSuggestionResult,
  CreateManualSuggestionInput,
  InspectPppoeDevicesResult,
} from '@/types/serviceInventory';

// ── Contract installed items ────────────────────────────────────────────────
export const listServiceInstalledItems = (contractId: string) =>
  axiosClient.get<ServiceInstalledItem[]>(`/contracts/${contractId}/inventory`).then(r => r.data);

// ── Client-wide installed items (aggregated across contracts) ────────────────
// BE wraps the array in `{ items: [...] }`; tolerate a bare array too.
export const listClientEquipment = (clientId: string) =>
  axiosClient
    .get<ClientInstalledItem[] | { items: ClientInstalledItem[] }>(`/clients/${clientId}/equipment`)
    .then(r => (Array.isArray(r.data) ? r.data : r.data.items ?? []));

export const addInstalledItem = (contractId: string, input: AddInstalledItemInput) =>
  axiosClient.post<ServiceInstalledItem>(`/contracts/${contractId}/inventory`, input).then(r => r.data);

export const updateInstalledItem = (contractId: string, itemId: string, patch: UpdateInstalledItemInput) =>
  axiosClient.patch<ServiceInstalledItem>(`/contracts/${contractId}/inventory/${itemId}`, patch).then(r => r.data);

export const deleteInstalledItem = (contractId: string, itemId: string) =>
  axiosClient.delete<ServiceInstalledItem>(`/contracts/${contractId}/inventory/${itemId}`).then(r => r.data);

// ── Task-scoped suggestion staging ──────────────────────────────────────────
export const listTaskInventorySuggestions = (taskId: string) =>
  axiosClient.get<TaskInventorySuggestion[]>(`/scheduling/${taskId}/inventory/suggestions`).then(r => r.data);

export const confirmInventorySuggestion = (
  taskId: string,
  suggestionId: string,
  typeOverride?: InstalledItemType,
  resolution?: 'add' | 'link_existing',
) =>
  axiosClient
    .post<ConfirmSuggestionResult>(
      `/scheduling/${taskId}/inventory/suggestions/${suggestionId}/confirm`,
      {
        ...(typeOverride ? { type: typeOverride } : {}),
        ...(resolution ? { resolution } : {}),
      },
    )
    .then(r => r.data);

export const replaceInventorySuggestion = (taskId: string, suggestionId: string, type?: InstalledItemType) =>
  axiosClient
    .post<ConfirmSuggestionResult>(
      `/scheduling/${taskId}/inventory/suggestions/${suggestionId}/replace`,
      type ? { type } : {},
    )
    .then(r => r.data);

export const discardInventorySuggestion = (taskId: string, suggestionId: string) =>
  axiosClient
    .post<TaskInventorySuggestion>(`/scheduling/${taskId}/inventory/suggestions/${suggestionId}/discard`)
    .then(r => r.data);

export const correctSuggestionType = (taskId: string, suggestionId: string, type: string) =>
  axiosClient
    .patch<ServiceInstalledItem>(
      `/scheduling/${taskId}/inventory/suggestions/${suggestionId}/type`,
      { type },
    )
    .then(r => r.data);

export const createManualSuggestion = (taskId: string, input: CreateManualSuggestionInput) =>
  axiosClient
    .post<TaskInventorySuggestion>(`/scheduling/${taskId}/inventory/suggestions`, input)
    .then(r => r.data);

// ── PPPoE live inspection ──────────────────────────────────────────────────
/** GET /contracts/:contractId/inspect-pppoe-devices — live SSH (~8s), best-effort */
export const inspectPppoeDevices = (contractId: string): Promise<InspectPppoeDevicesResult> =>
  axiosClient.get<InspectPppoeDevicesResult>(`/contracts/${contractId}/inspect-pppoe-devices`).then(r => r.data);
