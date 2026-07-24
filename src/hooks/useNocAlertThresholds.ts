import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNocAlertThresholds, updateNocAlertThresholds } from '@/api/nocAlertThresholds.api';
import type { UpdateNocAlertThresholdsPayload } from '@/types/nocAlertThresholds';

/**
 * useNocAlertThresholds (change `noc-alerts-config`, Fase F FE) — molde
 * `useNocBroadcast.ts` (GET puebla el form, PUT invalida para reflejar el
 * estado guardado real).
 */
export const NOC_ALERT_THRESHOLDS_QUERY_KEY = ['nocAlertThresholds', 'config'] as const;

/** GET los umbrales actuales. Devuelve los defaults seedeados si nadie los editó todavía. */
export function useNocAlertThresholds() {
  return useQuery({
    queryKey: NOC_ALERT_THRESHOLDS_QUERY_KEY,
    queryFn: getNocAlertThresholds,
  });
}

/** PUT los 5 umbrales (contrato: TODOS obligatorios). Invalida el GET al guardar. */
export function useUpdateNocAlertThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNocAlertThresholdsPayload) => updateNocAlertThresholds(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: NOC_ALERT_THRESHOLDS_QUERY_KEY });
    },
  });
}
