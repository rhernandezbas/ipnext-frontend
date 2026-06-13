import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractServicesApi } from '@/api/contract-services.api';
import type { AddContractServicePayload, UpdateContractServicePayload } from '@/api/contract-services.api';

/**
 * Mutations over a contract's service lines (#43). Services arrive embedded in
 * the `['client-contracts', clientId]` query (AD-3), so every mutation
 * invalidates that key — there is no per-contract query.
 *
 * #73 re-review — these mutations also change what the ServiceHistoryModal shows
 * (a line added/updated/removed is a new/updated history row), so each invalidates
 * the service-history ROOT (['contract-service-history']) too. Using the root key
 * (not the per-contract one) is simpler and safe: it refreshes every open history.
 */

const SERVICE_HISTORY_ROOT = ['contract-service-history'] as const;

export function useAddContractService(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, payload }: { contractId: string; payload: AddContractServicePayload }) =>
      contractServicesApi.add(contractId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-contracts', clientId] });
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
    },
  });
}

export function useUpdateContractService(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, id, payload }: { contractId: string; id: string; payload: UpdateContractServicePayload }) =>
      contractServicesApi.update(contractId, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-contracts', clientId] });
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
    },
  });
}

export function useRemoveContractService(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, id }: { contractId: string; id: string }) =>
      contractServicesApi.remove(contractId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-contracts', clientId] });
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
    },
  });
}
