import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listOwnershipCases, listRecentBajas, updateOwnershipCase } from '@/api/actions.api';
import type {
  OwnershipCasesQuery,
  RecentBajasQuery,
  UpdateOwnershipCaseBody,
} from '@/types/actions';

/**
 * actions-worklist F2 — hooks del worklist de Acciones.
 *
 * Query keys:
 *   ['actions','ownership', query] — casos de titularidad (checks AUTO del BE)
 *   ['actions','bajas', query]     — bajas recientes con retiro-check
 *
 * Toda mutación invalida la RAÍZ ['actions'] en onSettled: un PATCH puede
 * flipear el caso a done (contador de pendientes) y hasta un error deja el
 * estado en duda — siempre re-leemos.
 */

export const ACTIONS_ROOT = ['actions'] as const;

export function ownershipCasesKey(query: OwnershipCasesQuery) {
  return [...ACTIONS_ROOT, 'ownership', query] as const;
}

export function recentBajasKey(query: RecentBajasQuery) {
  return [...ACTIONS_ROOT, 'bajas', query] as const;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useOwnershipCases(query: OwnershipCasesQuery) {
  return useQuery({
    queryKey: ownershipCasesKey(query),
    queryFn: () => listOwnershipCases(query),
    staleTime: 30_000,
  });
}

export function useRecentBajas(query: RecentBajasQuery) {
  return useQuery({
    queryKey: recentBajasKey(query),
    queryFn: () => listRecentBajas(query),
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useUpdateOwnershipCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOwnershipCaseBody }) =>
      updateOwnershipCase(id, body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ACTIONS_ROOT });
    },
  });
}
