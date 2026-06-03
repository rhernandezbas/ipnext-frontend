import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/serviceInventory.api';
import type { AddInstalledItemInput, UpdateInstalledItemInput, InstalledItemType } from '@/types/serviceInventory';

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

// ── Task suggestions ────────────────────────────────────────────────────────
export function useTaskInventorySuggestions(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: suggestionsKey(taskId ?? ''),
    queryFn: () => api.listTaskInventorySuggestions(taskId!),
    enabled: !!taskId && enabled,
  });
}

export function useConfirmSuggestion(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, type }: { suggestionId: string; type?: InstalledItemType }) =>
      api.confirmInventorySuggestion(taskId, suggestionId, type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suggestionsKey(taskId) });
      void qc.invalidateQueries({ queryKey: ['service-inventory'] });
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
