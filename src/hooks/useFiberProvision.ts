import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fiberApi } from '@/api/fiber.api';
import type { ProvisionOnuPayload, ProvisionOnuResult } from '@/types/fiber';

export const UNCONFIGURED_ONUS_KEY = ['fiber', 'unconfigured-onus'] as const;

/**
 * Lista de ONUs sin configurar para el picker del modal (K2-FE).
 * staleTime CORTO (30s): la lista cambia cuando el técnico conecta la ONU en
 * campo — el modal además ofrece un botón "Refrescar" (refetch manual).
 * El hook solo se monta con el modal abierto → no hay polling de fondo.
 */
export function useUnconfiguredOnus() {
  return useQuery({
    queryKey: UNCONFIGURED_ONUS_KEY,
    queryFn: fiberApi.listUnconfiguredOnus,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * POST /fiber/provision — sirve para el dry-run (dryRun:true, sin side-effects)
 * y para la ejecución real (dryRun:false). Tras una ejecución REAL invalida:
 *  - la lista de ONUs (la ONU dejó de estar "sin configurar"), y
 *  - el detalle de la tarea (el BE appendea el bloque auditable a la descripción
 *    → taskUpdated). Prefijo ['scheduling-task'] = el detalle abierto se refresca.
 */
export function useProvisionOnu() {
  const qc = useQueryClient();
  return useMutation<ProvisionOnuResult, Error, ProvisionOnuPayload>({
    mutationFn: fiberApi.provision,
    onSuccess: (result) => {
      if (!result.dryRun) {
        void qc.invalidateQueries({ queryKey: UNCONFIGURED_ONUS_KEY });
        void qc.invalidateQueries({ queryKey: ['scheduling-task'] });
      }
    },
  });
}
