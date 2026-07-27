import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { assistantApi } from '@/api/assistant.api';
import type {
  UpdateAssistantProviderInput,
  AssistantRoutingConfig,
  RecordAssistantEvalInput,
  AssistantRunQuery,
  CreateAssistantIntentInput,
  CreateAssistantProfileInput,
  UpdateAssistantIntentInput,
  UpdateAssistantProfileInput,
} from '@/types/assistant';

export const ASSISTANT_QUERY_KEY = ['assistant'] as const;

/**
 * ai-assistant-multiagent — hooks del asistente IA.
 *
 * Los catálogos tienen `staleTime` largo: son datos que sólo cambian cuando alguien toca
 * código (las fuentes y acciones se registran en el backend, no se crean desde la UI). Los
 * perfiles e intenciones, en cambio, se editan seguido, así que se invalidan en cada mutación.
 */

/**
 * Catálogos de fuentes y acciones. El SET de piezas cambia con un deploy (se registran en
 * código), pero desde que existe el toggle de fuentes su campo `enabled` cambia en runtime.
 * El cache largo se sostiene porque la mutación invalida esta query; lo único que se demora
 * hasta 5 min es ver un toggle hecho por OTRA sesión, que para una config que se toca cada
 * varios meses es aceptable.
 */
export function useAssistantCatalogs() {
  return useQuery({
    queryKey: [...ASSISTANT_QUERY_KEY, 'catalogs'],
    queryFn: () => assistantApi.getCatalogs(),
    staleTime: 5 * 60_000,
  });
}

export function useAssistantProfiles() {
  return useQuery({
    queryKey: [...ASSISTANT_QUERY_KEY, 'profiles'],
    queryFn: () => assistantApi.listProfiles(),
    staleTime: 30_000,
  });
}

export function useAssistantProfile(id: string | null) {
  return useQuery({
    queryKey: [...ASSISTANT_QUERY_KEY, 'profile', id],
    queryFn: () => assistantApi.getProfile(id as string),
    enabled: id !== null,
    staleTime: 15_000,
  });
}

/** OBS-1 — historial. `keepPreviousData` para que la tabla no parpadee al cambiar de filtro. */
export function useAssistantRuns(query: AssistantRunQuery = {}) {
  return useQuery({
    queryKey: [...ASSISTANT_QUERY_KEY, 'runs', query],
    queryFn: () => assistantApi.listRuns(query),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Invalida TODO el namespace del asistente tras una mutación.
 *
 * Es a propósito más ancho que lo estrictamente necesario: editar una intención cambia el
 * detalle del perfil, y habilitar una acción puede cambiar la lista. Invalidar de más produce
 * un refetch; invalidar de menos deja la pantalla mintiendo, que es mucho peor cuando lo que
 * se muestra es la configuración de un bot que le habla a clientes.
 */
function useAssistantInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ASSISTANT_QUERY_KEY });
}

export function useCreateAssistantProfile() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: (input: CreateAssistantProfileInput) => assistantApi.createProfile(input),
    onSuccess: invalidate,
  });
}

export function useUpdateAssistantProfile() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssistantProfileInput }) =>
      assistantApi.updateProfile(id, input),
    onSuccess: invalidate,
  });
}

export function useCreateAssistantIntent() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: ({ profileId, input }: { profileId: string; input: CreateAssistantIntentInput }) =>
      assistantApi.createIntent(profileId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateAssistantIntent() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssistantIntentInput }) =>
      assistantApi.updateIntent(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteAssistantIntent() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: (id: string) => assistantApi.deleteIntent(id),
    onSuccess: invalidate,
  });
}

/**
 * EVAL-1 — historial de corridas. `staleTime` corto: destrabar una acción de riesgo tiene que
 * verse enseguida, si no el operador registra el eval y sigue viendo la acción bloqueada.
 */
export function useAssistantEvals() {
  return useQuery({
    queryKey: [...ASSISTANT_QUERY_KEY, 'evals'],
    queryFn: () => assistantApi.listEvals(),
    staleTime: 30_000,
  });
}

export function useRecordAssistantEval() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: (input: RecordAssistantEvalInput) => assistantApi.recordEval(input),
    // Invalida TODO el asistente, no sólo los evals: registrar una corrida cambia qué acciones
    // se pueden habilitar, y esa lista vive en el perfil.
    onSuccess: invalidate,
  });
}

export function useSetAssistantDataSource() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      assistantApi.setDataSourceEnabled(key, enabled),
    onSuccess: invalidate,
  });
}

/**
 * RTR-0 — el ruteo. `staleTime` corto igual que el proveedor: se edita poco pero decide si el
 * bot contesta o no, así que verlo desactualizado es peor que un refetch de más.
 */
export function useAssistantRouting() {
  return useQuery({
    queryKey: [...ASSISTANT_QUERY_KEY, 'routing'],
    queryFn: () => assistantApi.getRouting(),
    staleTime: 30_000,
  });
}

export function useUpdateAssistantRouting() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: (input: AssistantRoutingConfig) => assistantApi.updateRouting(input),
    onSuccess: invalidate,
  });
}

/** Credenciales del proveedor (enmascaradas). Cache corto: se edita poco pero importa verla fresca. */
export function useAssistantProvider() {
  return useQuery({
    queryKey: [...ASSISTANT_QUERY_KEY, 'provider'],
    queryFn: () => assistantApi.getProvider(),
    staleTime: 30_000,
  });
}

export function useUpdateAssistantProvider() {
  const invalidate = useAssistantInvalidation();
  return useMutation({
    mutationFn: (input: UpdateAssistantProviderInput) => assistantApi.updateProvider(input),
    onSuccess: invalidate,
  });
}

/**
 * "Probar conexión". NO invalida nada: probar no cambia configuración, y un refetch acá
 * borraría el resultado que el operador está leyendo.
 */
export function useTestAssistantProvider() {
  return useMutation({ mutationFn: () => assistantApi.testProvider() });
}
