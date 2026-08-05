import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { portalAccountsApi } from '@/api/portalAccounts.api';
import type {
  CreatePortalAccountInput,
  SetPortalAccountStatusInput,
} from '@/types/portalAccount';

/** Raíz común de todas las queries de cuentas del portal (lista + portada). */
export const portalAccountsRootKey = ['portal-accounts'] as const;
export const portalAccountsSummaryKey = ['portal-accounts', 'summary'] as const;

export function portalAccountsListKey(page: number, limit: number) {
  return ['portal-accounts', 'list', page, limit] as const;
}

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

/**
 * Lista paginada de cuentas para la PÁGINA de Usuarios de la app.
 *
 * `enabled` lo ata el caller al permiso `portal.manage`: el endpoint exige ese
 * permiso, así que un operador con sólo `portal.read` NO debe disparar la
 * llamada (sería un 403 garantizado). `retry: false` por el mismo motivo que
 * la portada.
 */
export function usePortalAccountsList(page: number, limit: number, enabled = true) {
  return useQuery({
    queryKey: portalAccountsListKey(page, limit),
    queryFn: () => portalAccountsApi.list({ page, limit }),
    enabled,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

/**
 * Invalida TODO el árbol de cuentas del portal — lista Y portada. Una mutación
 * cambia el total, así que la tarjeta "Cuentas de la app" del Resumen tiene que
 * refrescarse junto con la tabla: misma fuente, mismo número.
 */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: portalAccountsRootKey });
}

/** CREATE — devuelve la cuenta + contraseña en texto plano (mostrar una vez). */
export function useCreatePortalAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePortalAccountInput) => portalAccountsApi.create(input),
    onSuccess: () => invalidateAll(qc),
  });
}

/** PATCH estado (habilitar / deshabilitar). Deshabilitar revoca sesiones. */
export function useSetPortalAccountStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: SetPortalAccountStatusInput) =>
      portalAccountsApi.setStatus(id, status),
    onSuccess: () => invalidateAll(qc),
  });
}

/** Regenerar contraseña — devuelve la nueva en texto plano (mostrar una vez). */
export function useRegeneratePortalPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalAccountsApi.regeneratePassword(id),
    onSuccess: () => invalidateAll(qc),
  });
}

/** DELETE — borra la cuenta. */
export function useDeletePortalAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalAccountsApi.remove(id),
    onSuccess: () => invalidateAll(qc),
  });
}
