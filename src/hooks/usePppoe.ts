import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pppoeApi } from '@/api/pppoe.api';
import type { CreatePppoeBody, UpdatePppoeBody, PppoeCredentials, CreateStandalonePppoeBody, RenamePppoeResult } from '@/api/pppoe.api';
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

/**
 * Fija una IP estática en el PPPoE (ipMode='fixed').
 * En éxito invalida la lista del contrato y los contratos del cliente para
 * reflejar el nuevo ipMode + remoteAddress sin recargar la página.
 * Errores: 422 IP inválida, 409 IP ya tomada, 502 router/orquestador caído.
 */
export function usePinPppoeIp(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string; ip: string }>({
    mutationFn: ({ id, ip }) => pppoeApi.pinIp(id, ip),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

/**
 * Libera la IP fija del PPPoE (ipMode='pool').
 * En éxito invalida la lista del contrato y los contratos del cliente.
 * Errores: 409 si el NAS no tiene pool configurado, 502 router/orquestador caído.
 */
export function useUnpinPppoeIp(contractId: string, clientId: string | number) {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string }>({
    mutationFn: ({ id }) => pppoeApi.unpinIp(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-pppoe', contractId] });
      qc.invalidateQueries({ queryKey: ['client-contracts', String(clientId)] });
    },
  });
}

// ── Hooks globales de gestión PPPoE (Phase 5) ────────────────────────────────
// Invalidan el prefijo ['pppoe', 'list'] que cubre TODAS las variantes de filtro
// de useAllPppoe (keyFactory de useInternetServices).

/** Clave-prefijo para invalidar TODAS las queries de lista de PPPoE. */
const GLOBAL_LIST_KEY = ['pppoe', 'list'] as const;

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
 * Mueve un PPPoE a otro router (NAS).
 * Variante global: invalida la lista global.
 */
export function useMovePppoeGlobal() {
  const qc = useQueryClient();
  return useMutation<PppoeServiceDto, unknown, { id: string; nasId: string }>({
    mutationFn: ({ id, nasId }) => pppoeApi.move(id, nasId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GLOBAL_LIST_KEY });
      // F7: un PPPoE movido puede ser huérfano — el picker de adopción debe quedar fresco
      qc.invalidateQueries({ queryKey: unassignedKey() });
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
