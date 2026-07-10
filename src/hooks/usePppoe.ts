import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pppoeApi } from '@/api/pppoe.api';
import type { CreatePppoeBody, UpdatePppoeBody, PppoeCredentials, CreateStandalonePppoeBody, RenamePppoeResult, BulkChangePlanResult, PppoeIdsResult, TransferPppoeMode, TransferPppoeResult } from '@/api/pppoe.api';
import type {
  EnforcementAction,
  EnforcementTarget,
  EnforcementPreview,
  BulkEnforcementStarted,
  ServiceCutBatch,
  PppoeServiceDto,
} from '@/types/pppoe';
import type { PppoeServiceListFilter } from '@/types/internetService';

/**
 * Hooks del módulo Cortes PPPoE (Fase C).
 *
 * Patrón de job async = espejo de useCancelTvStatus (#10): la mutation dispara el
 * batch (202) y un useQuery con `refetchInterval` poolea el estado, devolviendo
 * 2000ms mientras corre y `false` al llegar a un estado terminal (done/failed).
 */

const ROOT = ['pppoe'] as const;
export const batchKey = (jobId: string) => [...ROOT, 'batch', jobId] as const;
/** Clave de la lista de PPPoE huérfanos (sin contrato) — adopción de inventario. */
export const unassignedKey = () => [...ROOT, 'unassigned'] as const;
/** Clave de las credenciales reveladas bajo demanda de un PPPoE. */
export const credentialsKey = (id: string) => [...ROOT, 'credentials', id] as const;

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

/**
 * Corte individual de un PPPoE desde la ficha del contrato.
 * A diferencia de useEnforcePppoe, acepta `reason` en las variables e invalida
 * `['contract-pppoe', contractId]` en éxito para que el panel refleje el nuevo
 * enforcedState sin recargar la página.
 */
export function useEnforcePppoeForContract(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string; action: EnforcementAction; reason?: string }>({
    mutationFn: ({ id, action, reason }) => pppoeApi.enforce(id, action, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

// ── Hooks de gestión PPPoE por contrato ─────────────────────────────────────────

/** Lista los PPPoE asociados a un contrato. */
export function useContractPppoe(contractId: string) {
  return useQuery<PppoeServiceDto[]>({
    queryKey: ['contract-pppoe', contractId],
    queryFn: () => pppoeApi.listByContract(contractId),
    enabled: !!contractId,
  });
}

/** Crea un PPPoE en un contrato. Invalida la lista del contrato + contratos del cliente. */
export function useCreatePppoe(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, CreatePppoeBody>({
    mutationFn: (body) => pppoeApi.create(contractId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

/** Edita profile/password/remoteAddress/status de un PPPoE. */
export function useUpdatePppoe(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string; body: UpdatePppoeBody }>({
    mutationFn: ({ id, body }) => pppoeApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

/** Mueve un PPPoE a otro router (NAS). */
export function useMovePppoe(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string; nasId: string }>({
    mutationFn: ({ id, nasId }) => pppoeApi.move(id, nasId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

/** Da de baja un PPPoE (DELETE en el router). Invalida lista del contrato + contratos del cliente. */
export function useDeactivatePppoe(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => pppoeApi.deactivate(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

/**
 * Variables de useTransferPppoe. `targetClientId` NO viaja en el wire — solo
 * alimenta la invalidación de los caches del cliente destino.
 */
export interface TransferPppoeVariables {
  id: string;
  targetClientId: string;
  targetContractId: string;
  mode: TransferPppoeMode;
  reason?: string;
  newPppoe?: CreatePppoeBody;
}

/**
 * service-transfer W4 — transfiere el PPPoE del contrato ORIGEN a un contrato
 * de otro cliente. Invalidación de AMBOS lados en onSettled (no onSuccess):
 * un 207 parcial (recreate: nuevo vivo, viejo pendiente de borrar) y hasta un
 * error duro pueden dejar estado aplicado a medias — SIEMPRE re-leemos los
 * PPPoE y contratos de origen y destino, la lista global, los huérfanos y el
 * historial por contrato (los eventos transfer-out/in caen ahí).
 */
export function useTransferPppoe(sourceContractId: string, sourceClientId: string | number) {
  const qc = useQueryClient();
  return useMutation<TransferPppoeResult, unknown, TransferPppoeVariables>({
    mutationFn: ({ id, targetContractId, mode, reason, newPppoe }) =>
      pppoeApi.transfer(id, {
        targetContractId,
        mode,
        ...(reason !== undefined ? { reason } : {}),
        ...(newPppoe !== undefined ? { newPppoe } : {}),
      }),
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', sourceContractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(sourceClientId)] });
      if (variables) {
        qc.invalidateQueries({ queryKey: ['contract-pppoe', variables.targetContractId] });
        qc.invalidateQueries({ queryKey: ['client-contracts', String(variables.targetClientId)] });
      }
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
      qc.invalidateQueries({ queryKey: unassignedKey() });
      qc.invalidateQueries({ queryKey: ['contract-service-history'] });
    },
  });
}

// ── Hooks de adopción de inventario PPPoE ───────────────────────────────────────

/**
 * Lista los PPPoE huérfanos (ingeridos del router, sin contrato). `enabled` ata
 * el fetch a que la sección de adopción esté abierta para no pegarle al BE de más.
 */
export function useUnassignedPppoe(enabled = true) {
  return useQuery<PppoeServiceDto[]>({
    queryKey: unassignedKey(),
    queryFn: () => pppoeApi.listUnassigned(),
    enabled,
  });
}

/**
 * Asocia un PPPoE huérfano a un contrato. En éxito invalida la lista de huérfanos,
 * la del contrato y los contratos del cliente (el chip INTERNET aparece). Un 409
 * (ya asociado a otro contrato) lo lanza axios → el caller lo detecta por status.
 */
export function useAssociatePppoe(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string }>({
    mutationFn: ({ id }) => pppoeApi.associate(id, contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: unassignedKey() });
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

/**
 * Desasocia un PPPoE de un contrato: lo devuelve al inventario de huérfanos
 * (contractId = null) SIN darlo de baja en el router. Invalida la lista del
 * contrato, la lista de huérfanos y los contratos del cliente.
 */
export function useDeassociatePppoe(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<void, unknown, { pppoeId: string; reason?: string }>({
    mutationFn: ({ pppoeId, reason }) => pppoeApi.deassociate(contractId, pppoeId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: unassignedKey() });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

/**
 * Lectura LAZY de las credenciales de un PPPoE. `enabled` deja que el panel las
 * pida solo cuando el operador revela el password (click en el ojo), nunca eager.
 * Es la única vía para obtener el password (el DTO de lista/detalle no lo trae).
 */
export function usePppoeCredentials(id: string, enabled: boolean) {
  return useQuery<PppoeCredentials>({
    queryKey: credentialsKey(id),
    queryFn: () => pppoeApi.credentials(id),
    enabled: enabled && id !== '',
    staleTime: 60_000,
  });
}

/** Clave del caller-id (MAC de sesión RADIUS activa) de un PPPoE. */
export const callerIdKey = (id: string) => [...ROOT, 'caller-id', id] as const;

/**
 * Devuelve el caller-id (MAC del dispositivo conectado) de la sesión RADIUS activa.
 * Retorna `{ callerId: string | null }` — null = sin sesión activa (no es error).
 * Query habilitado solo cuando `pppoeId` no es null (panel PPPoE activo abierto).
 * Degradación silenciosa: si falla, `isError=true` → el panel muestra "—" y sigue funcional.
 */
export function usePppoeCallerId(pppoeId: string | null) {
  return useQuery<{ callerId: string | null }>({
    queryKey: callerIdKey(pppoeId ?? ''),
    queryFn: () => pppoeApi.getCallerId(pppoeId as string),
    enabled: !!pppoeId,
    staleTime: 30_000,
  });
}

// ── Hooks globales de gestión PPPoE (Phase 5) ────────────────────────────────
// Invalidan el prefijo ['pppoe', 'list'] que cubre TODAS las variantes de filtro
// de useAllPppoe (keyFactory de useInternetServices).

/** Clave-prefijo para invalidar TODAS las queries de lista de PPPoE. */
export const GLOBAL_LIST_KEY = ['pppoe', 'list'] as const;

/**
 * Crea un PPPoE standalone (sin contrato obligatorio).
 * Invalida la lista global al tener éxito.
 * F7: también invalida unassigned para que el picker de adopción en InternetPanel quede fresco.
 */
export function useCreatePppoeStandalone() {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, CreateStandalonePppoeBody>({
    mutationFn: (body) => pppoeApi.createStandalone(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
      qc.invalidateQueries({ queryKey: unassignedKey() });
    },
  });
}

/**
 * Renombra un PPPoE (recrea el secret RADIUS). Invalida la lista global.
 * Si response.status === 'partial', el caller debe mostrar el mensaje de advertencia.
 */
export function useRenamePppoe() {
  const qc = useQueryClient();
  return useMutation<RenamePppoeResult, unknown, { id: string; newUsername: string }>({
    mutationFn: ({ id, newUsername }) => pppoeApi.rename(id, newUsername),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
      // F7: un PPPoE renombrado puede ser huérfano — el picker de adopción debe quedar fresco
      qc.invalidateQueries({ queryKey: unassignedKey() });
    },
  });
}

/**
 * Edita profile/password/remoteAddress/status de un PPPoE.
 * Variante global: invalida la lista global (no solo el contrato).
 */
export function useUpdatePppoeGlobal() {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string; body: UpdatePppoeBody }>({
    mutationFn: ({ id, body }) => pppoeApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
      // F7: un PPPoE editado puede ser huérfano — el picker de adopción debe quedar fresco
      qc.invalidateQueries({ queryKey: unassignedKey() });
    },
  });
}

/**
 * Mueve un PPPoE a otro NAS (radius-aware: el BE reasigna IP nueva + kick).
 * Variante global: invalida la lista global — así la fila refleja el NAS y la
 * IP nuevos SIN reload (REQ-FE-1 S9.2).
 * `force: true` = confirmación explícita del operador ante el 409
 * PPPOE_MOVE_PUBLIC_IP (flujo en 2 pasos del modal, S9.3).
 */
export function useMovePppoeGlobal() {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string; nasId: string; force?: boolean }>({
    mutationFn: ({ id, nasId, force }) => pppoeApi.move(id, nasId, force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
      // F7: un PPPoE movido puede ser huérfano — el picker de adopción debe quedar fresco
      qc.invalidateQueries({ queryKey: unassignedKey() });
    },
    // El tab "Movimientos NAS" (usePppoeNasMoveEvents, prefijo ['pppoe-nas-move-events'])
    // tiene el staleTime global de 5min. onSettled (no onSuccess): los moves FALLIDOS en fase
    // de asignación TAMBIÉN persisten fila en el BE (failed_no_free_ip/failed_orchestrator/
    // failed_db) — el intento fallido debe aparecer en la auditoría al toque, no 5' después.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pppoe-nas-move-events'] });
    },
  });
}

/**
 * Da de baja un PPPoE (DELETE en el router).
 * Variante global: invalida la lista global.
 * F7: también invalida unassigned — un PPPoE dado de baja pasa a ser huérfano
 * y el picker de adopción de InternetPanel debe verlo fresco.
 */
export function useDeactivatePppoeGlobal() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => pppoeApi.deactivate(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
      qc.invalidateQueries({ queryKey: unassignedKey() });
    },
  });
}

/**
 * Fetch on-demand (imperativo) de los ids que matchean el filtro vigente —
 * alimenta el botón "Seleccionar los N del filtro" (pppoe-bulk-select-filter v2).
 * GET /pppoe/ids — gated `pppoe.manage`. `useMutation` (NO `useQuery` cacheado):
 * expone `isPending`/`isError` para el botón mientras trae cientos de ids.
 * Es una LECTURA — no invalida nada en éxito.
 */
export function useListPppoeIds() {
  return useMutation<PppoeIdsResult, unknown, PppoeServiceListFilter>({
    mutationFn: (filter) => pppoeApi.listIds(filter),
  });
}

/**
 * Cambia el plan de múltiples PPPoEs (bulk, best-effort).
 * POST /api/pppoe/bulk/change-plan — gated `pppoe.manage` en el BE.
 * En éxito invalida la lista global para que la tabla refleje los nuevos planes.
 * NO invalida unassigned: el bulk no cambia el contractId ni el estado del servicio.
 *
 * Camino N<=200 (un solo request) — para el envío en LOTES (N>200) usar
 * `useBulkChangePppoePlanBatch` en su lugar (W4, pppoe-bulk-select-filter v2).
 */
export function useBulkChangePppoePlan() {
  const qc = useQueryClient();
  return useMutation<
    BulkChangePlanResult,
    unknown,
    { ids: string[]; profile: string; reason?: string }
  >({
    mutationFn: ({ ids, profile, reason }) => pppoeApi.bulkChangePlan(ids, profile, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
    },
  });
}

/**
 * Variante de `useBulkChangePppoePlan` SIN invalidación por request — misma
 * mutationFn, mismo endpoint. Uso exclusivo del camino de envío en LOTES
 * (N>200, `runPppoeBulkBatches`): invalidar en el `onSuccess` de cada lote
 * dispararía hasta N refetches de la lista global A MITAD de una corrida de
 * cientos de servicios. El caller (PppoeManagementTab) invalida
 * `GLOBAL_LIST_KEY` UNA sola vez al terminar la corrida completa (completa
 * o cortada), después del último lote enviado.
 * El camino N<=200 sigue usando `useBulkChangePppoePlan` — intacto.
 */
export function useBulkChangePppoePlanBatch() {
  return useMutation<
    BulkChangePlanResult,
    unknown,
    { ids: string[]; profile: string; reason?: string }
  >({
    mutationFn: ({ ids, profile, reason }) => pppoeApi.bulkChangePlan(ids, profile, reason),
  });
}
