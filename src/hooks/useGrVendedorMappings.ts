import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grVendedorMappingsApi } from '@/api/grVendedorMappings.api';

const MAPPINGS_KEY = ['gr-vendedor-mappings'] as const;
const VENDEDORES_KEY = ['gr-vendedores'] as const;

/**
 * Lista los usuarios con su vendedor de Gestión Real mapeado (o null si sin mapeo).
 * Gate: recapture.assign
 */
export function useGrVendedorMappings() {
  return useQuery({
    queryKey: MAPPINGS_KEY,
    queryFn: grVendedorMappingsApi.list,
    staleTime: 60_000,
  });
}

/**
 * Catálogo de nombres de vendedor distintos de Gestión Real (para el dropdown).
 * Gate: recapture.assign
 *
 * `enabled` evita el 403: GET /vendedores exige `recapture.assign` en el BE, así
 * que un agente sin ese permiso NO debe dispararlo. El default `true` preserva
 * los call sites ya gateados aguas arriba (p.ej. settings de admin).
 */
export function useGrVendedores(enabled = true) {
  return useQuery({
    queryKey: VENDEDORES_KEY,
    queryFn: grVendedorMappingsApi.listVendedores,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/**
 * Cambia (o borra con null) el mapeo usuario → vendedor GR.
 * Invalida la lista de mapeos al éxito.
 * Gate: recapture.assign
 */
export function useSetGrVendedorMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, grVendedorName }: { userId: string; grVendedorName: string | null }) =>
      grVendedorMappingsApi.setMapping(userId, grVendedorName),
    onSuccess: () => qc.invalidateQueries({ queryKey: MAPPINGS_KEY }),
  });
}
