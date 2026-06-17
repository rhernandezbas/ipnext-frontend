import { useQuery, useMutation } from '@tanstack/react-query';
import { pppoeApi } from '@/api/pppoe.api';
import type {
  EnforcementAction,
  EnforcementTarget,
  EnforcementPreview,
  BulkEnforcementStarted,
  ServiceCutBatch,
  PppoeServiceDto,
} from '@/types/pppoe';

/**
 * Hooks del módulo Cortes PPPoE (Fase C).
 *
 * Patrón de job async = espejo de useCancelTvStatus (#10): la mutation dispara el
 * batch (202) y un useQuery con `refetchInterval` poolea el estado, devolviendo
 * 2000ms mientras corre y `false` al llegar a un estado terminal (done/failed).
 */

const ROOT = ['pppoe'] as const;
export const batchKey = (jobId: string) => [...ROOT, 'batch', jobId] as const;

/** Preview del corte (mutation: SIN cache — es un cálculo on-demand, sin efectos). */
export function usePreviewEnforcement() {
  return useMutation<EnforcementPreview, unknown, { action: EnforcementAction; target: EnforcementTarget }>({
    mutationFn: (body) => pppoeApi.preview(body),
  });
}

/**
 * Dispara el batch masivo. Resuelve { status: 202, data: { jobId, total } }.
 * Un 409 (ENFORCEMENT_IN_PROGRESS) lo lanza axios → el caller lo detecta por
 * `error.response.status === 409`. NO invalida nada acá: el efecto se sigue por el poll.
 */
export function useStartBulkEnforcement() {
  return useMutation<
    { status: number; data: BulkEnforcementStarted },
    unknown,
    { action: EnforcementAction; target: EnforcementTarget }
  >({
    mutationFn: (body) => pppoeApi.startBulk(body),
  });
}

/**
 * Poolea el estado del batch cada 2s mientras `pending`/`running`; corta el poll
 * (false) al llegar a `done`/`failed`. `enabled` se ata a tener un jobId activo.
 */
export function useBulkEnforcementStatus(jobId: string | null, enabled: boolean) {
  return useQuery<ServiceCutBatch>({
    queryKey: batchKey(jobId ?? ''),
    queryFn: () => pppoeApi.getBatch(jobId as string),
    enabled: enabled && !!jobId,
    // gcTime corto: al hacer "Nuevo corte" la entrada del batch viejo se libera sola
    // (evita acumular result[] grandes en cache durante una jornada de cortes).
    gcTime: 60_000,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === 'done' || s === 'failed') return false;
      return 2000;
    },
  });
}

/** Corte individual de un PPPoE (reduce/block/restore). */
export function useEnforcePppoe() {
  return useMutation<PppoeServiceDto, unknown, { id: string; action: EnforcementAction }>({
    mutationFn: ({ id, action }) => pppoeApi.enforce(id, action),
  });
}
