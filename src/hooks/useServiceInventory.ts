import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import * as api from '@/api/serviceInventory.api';
import type { AddInstalledItemInput, UpdateInstalledItemInput, InstalledItemType, ConfirmSuggestionResult, CreateManualSuggestionInput, InspectPppoeDevicesResult, RetireInstalledItemInput } from '@/types/serviceInventory';

// Technicians for the retire "Con un técnico" picker come from the inventory
// technician list (GET /inventory/technicians) — reused here so the equipment
// retire flow has a domain-local hook name.
export { useTechnicianList as useInventoryTechnicians } from '@/hooks/useTechnicianList';

const itemsKey = (serviceId: string) => ['service-inventory', serviceId];
const suggestionsKey = (taskId: string) => ['task-inventory-suggestions', taskId];
const clientEquipmentKey = (clientId: string) => ['client-equipment', clientId];

// ── Client-wide installed items (aggregated across contracts) ────────────────
/**
 * All equipment installed across a client's contracts (EPIC #38 W2), read-only.
 * GC-7: if the BE route is not yet deployed (404), degrade to an empty list so
 * the "Equipos" tab shows its empty state instead of an error. Other errors
 * propagate as `isError`.
 */
export function useClientInstalledItems(clientId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: clientEquipmentKey(clientId ?? ''),
    queryFn: async () => {
      try {
        return await api.listClientEquipment(clientId!);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 404) return [];
        throw err;
      }
    },
    enabled: !!clientId && enabled,
  });
}

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

/**
 * Retire an installed item with a destination (disposition + optional technician
 * + note). Replaces the plain delete for the "Quitar" flow. Invalidates the
 * contract inventory query on success so the table reflects the removal.
 */
export function useRetireInstalledItem(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: RetireInstalledItemInput }) =>
      api.retireInstalledItem(serviceId, itemId, input),
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

export function useCreateManualSuggestion(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateManualSuggestionInput) => api.createManualSuggestion(taskId, input),
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

// ── PPPoE live inspection ──────────────────────────────────────────────────
/**
 * Lazy (manual trigger) hook for inspecting a contract's PPPoE devices live
 * via SSH. Returns an `inspect(contractId)` function that triggers on demand,
 * plus `isPending` for loading state (~8s SSH round-trip).
 *
 * Does NOT auto-fetch — the operator triggers it explicitly. Uses a manual
 * useState + api call pattern (simpler than useMutation for this UX: we want
 * a stable `inspect` reference without needing .mutate() callback indirection).
 */
export function useInspectPppoeDevices() {
  const [isPending, setIsPending] = useState(false);

  const inspect = useCallback(async (contractId: string): Promise<InspectPppoeDevicesResult> => {
    setIsPending(true);
    try {
      return await api.inspectPppoeDevices(contractId);
    } finally {
      setIsPending(false);
    }
  }, []);

  return { inspect, isPending };
}
