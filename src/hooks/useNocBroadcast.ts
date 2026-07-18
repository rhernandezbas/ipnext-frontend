import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNocBroadcastConfig,
  updateNocBroadcastConfig,
  testNocBroadcast,
} from '@/api/nocBroadcast.api';
import type { UpdateNocBroadcastPayload } from '@/types/nocBroadcast';

const ROOT = ['nocBroadcast'] as const;
const CONFIG_KEY = [...ROOT, 'config'] as const;

/** GET the NOC-broadcast config (apiKey enmascarada). */
export function useNocBroadcastConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: getNocBroadcastConfig,
  });
}

/**
 * PUT the NOC-broadcast config. On success invalidates the config query so the
 * masked DTO (hasApiKey / apiKeyLast4 / configured) reflects the new saved state.
 */
export function useUpdateNocBroadcastConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNocBroadcastPayload) => updateNocBroadcastConfig(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CONFIG_KEY });
    },
  });
}

/** POST /test — envía un mensaje de prueba al canal. No invalida nada. */
export function useTestNocBroadcast() {
  return useMutation({
    mutationFn: () => testNocBroadcast(),
  });
}
