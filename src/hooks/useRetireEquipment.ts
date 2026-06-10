import { useMutation, useQueryClient } from '@tanstack/react-query';
import { retireEquipment } from '@/api/scheduling.api';

const itemsKey = (serviceId: string) => ['service-inventory', serviceId];

/**
 * Mutation hook for manually retiring contract equipment back to the depot (#39).
 * On success, invalidates the service inventory cache for the given contractId
 * so the InventoryPanel reflects the retired items immediately.
 */
export function useRetireEquipment(contractId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, itemIds }: { taskId: string; itemIds: string[] }) =>
      retireEquipment(taskId, itemIds),
    onSuccess: () => {
      if (contractId) {
        void qc.invalidateQueries({ queryKey: itemsKey(contractId) });
      } else {
        void qc.invalidateQueries({ queryKey: ['service-inventory'] });
      }
    },
  });
}
