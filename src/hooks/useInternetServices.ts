import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pppoeApi } from '@/api/pppoe.api';
import type {
  PppoeServiceListResult,
  PppoeServiceListFilter,
  InternetServiceEvent,
  InternetActivationHistoryFilter,
} from '@/types/internetService';

/**
 * Hooks de la página "Historial de servicios de Internet" (#internet-history).
 * Espejo de los hooks de TV (useGigared.ts), pero la lista es PAGINADA server-side
 * (el endpoint devuelve { data, total, page, limit }) en vez de client-side.
 *
 * Claves de query:
 *   ['pppoe','list', filter]                 — lista paginada de servicios
 *   ['pppoe','activation-history', filter]   — historial de activaciones
 */

const ROOT = ['pppoe'] as const;
export const listKey = (filter: PppoeServiceListFilter) => [...ROOT, 'list', filter] as const;
export const internetActivationHistoryKey = (filter: InternetActivationHistoryFilter) =>
  [...ROOT, 'activation-history', filter] as const;

/**
 * Lista paginada de servicios de Internet. Cacheada por la forma del filtro.
 * `keepPreviousData` evita el flicker al cambiar de página (mantiene la página
 * anterior visible mientras carga la siguiente — patrón de tablas paginadas).
 */
export function useAllPppoe(filter: PppoeServiceListFilter) {
  return useQuery<PppoeServiceListResult>({
    queryKey: listKey(filter),
    queryFn: () => pppoeApi.list(filter),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * Historial de activaciones de Internet (alta/baja/reactivación), newest-first.
 * `enabled` ata el fetch al estado del modal para no pegarle al BE estando cerrado.
 * staleTime corto (30s): el operador entra acá a auditar acciones recientes.
 */
export function useInternetActivationHistory(
  filter: InternetActivationHistoryFilter,
  enabled = true,
) {
  return useQuery<InternetServiceEvent[]>({
    queryKey: internetActivationHistoryKey(filter),
    queryFn: () => pppoeApi.activationHistory(filter),
    staleTime: 30_000,
    enabled,
  });
}
