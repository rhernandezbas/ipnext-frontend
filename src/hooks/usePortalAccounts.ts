import { useQuery } from '@tanstack/react-query';
import { portalAccountsApi } from '@/api/portalAccounts.api';

export const portalAccountsSummaryKey = ['portal-accounts', 'summary'] as const;

/**
 * gestion-app — SÓLO el total de cuentas del portal, para la portada.
 *
 * `limit: 1` a propósito: la portada muestra un número, no una lista.
 *
 * `retry: false`: este endpoint exige `portal.manage`, un permiso MÁS fuerte
 * que el `portal.read` que gatea la portada. Un operador con `portal.read`
 * solo recibe 403 — reintentar tres veces un 403 no lo convierte en un 200,
 * sólo demora la degradación de la tarjeta.
 */
export function usePortalAccountsSummary() {
  return useQuery({
    queryKey: portalAccountsSummaryKey,
    queryFn: () => portalAccountsApi.list({ page: 1, limit: 1 }),
    staleTime: 60_000,
    retry: false,
  });
}
