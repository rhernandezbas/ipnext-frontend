import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/serviceInventory.api';
import type { AddInstalledItemInput, UpdateInstalledItemInput, InstalledItemType, ConfirmSuggestionResult } from '@/types/serviceInventory';

const itemsKey = (serviceId: string) => ['service-inventory', serviceId];
const suggestionsKey = (taskId: string) => ['task-inventory-suggestions', taskId];

// ── Contract installed items ────────────────────────────────────────────────
export function useServiceInstalledItems(serviceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: itemsKey(serviceId ?? ''),
    queryFn: () => api.listServiceInstalledItems(serviceId!),
    enabled: !!serviceId && enabled,
  });
}

export function useAddInstalledItem(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddInstalledItemInput) => api.addInstalledItem(serviceId, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: itemsKey(serviceId) }),
  });
}

export function useUpdateInstalledItem(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: UpdateInstalledItemInput }) =>
      api.updateInstalledItem(serviceId, itemId, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: itemsKey(serviceId) }),
  });
}

export function useRemoveInstalledItem(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.deleteInstalledItem(serviceId, itemId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: itemsKey(serviceId) }),
  });
}

// ── Task suggestions ────────────────────────────────────────────────────────
export function useTaskInventorySuggestions(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: suggestionsKey(taskId ?? ''),
    queryFn: () => api.listTaskInventorySuggestions(taskId!),
    enabled: !!taskId && enabled,
  });
}

export function useConfirmSuggestion(taskId: string, contractId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, type, resolution }: { suggestionId: string; type?: InstalledItemType; resolution?: 'add' | 'link_existing' }) =>
      api.confirmInventorySuggestion(taskId, suggestionId, type, resolution),
    onSuccess: (result: ConfirmSuggestionResult) => {
      void qc.invalidateQueries({ queryKey: suggestionsKey(taskId) });
      if (result.kind === 'DEVICE') {
        // Confirm added a device to the contract inventory
        if (contractId) {
          void qc.invalidateQueries({ queryKey: itemsKey(contractId) });
        } else {
          void qc.invalidateQueries({ queryKey: ['service-inventory'] });
        }
      } else {
        // result.kind === 'MATERIAL' — confirm created a task material consumption
        void qc.invalidateQueries({ queryKey: ['task-materials', taskId] });
        if (contractId) {
          void qc.invalidateQueries({ queryKey: itemsKey(contractId) });
        }
      }
    },
  });
}

export function useReplaceSuggestion(taskId: string, contractId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, type }: { suggestionId: string; type?: InstalledItemType }) =>
      api.replaceInventorySuggestion(taskId, suggestionId, type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suggestionsKey(taskId) });
      if (contractId) {
        void qc.invalidateQueries({ queryKey: itemsKey(contractId) });
      } else {
        void qc.invalidateQueries({ queryKey: ['service-inventory'] });
      }
    },
  });
}

export function useDiscardSuggestion(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) => api.discardInventorySuggestion(taskId, suggestionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: suggestionsKey(taskId) }),
  });
}

export function useCorrectSuggestionType(taskId: string, contractId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, type }: { suggestionId: string; type: string }) =>
      api.correctSuggestionType(taskId, suggestionId, type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suggestionsKey(taskId) });
      if (contractId) {
        void qc.invalidateQueries({ queryKey: itemsKey(contractId) });
      } else {
        void qc.invalidateQueries({ queryKey: ['service-inventory'] });
      }
    },
  });
}
