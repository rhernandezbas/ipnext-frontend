import axiosClient from './axios-client';
import type {
  AssistantConnectionTest,
  AssistantProviderConfig,
  UpdateAssistantProviderInput,
  AssistantCatalogs,
  AssistantIntent,
  AssistantProfile,
  AssistantProfileWithIntents,
  AssistantRunPage,
  AssistantRunQuery,
  CreateAssistantIntentInput,
  CreateAssistantProfileInput,
  UpdateAssistantIntentInput,
  UpdateAssistantProfileInput,
} from '@/types/assistant';

const BASE = '/assistant';

/**
 * ai-assistant-multiagent — cliente del API de configuración del asistente.
 *
 * ⚠️ **El BE envuelve TODO en `{data}`** — de ahí el `.then(r => r.data.data)`. Los tests
 * mockeados no cazan un mismatch de envelope: devuelven el shape que uno les dice, así que
 * ambos lados quedan verdes y la pantalla renderiza vacío. Ya pasó en este repo; el desenvuelto
 * se escribe explícito y una sola vez, acá.
 */
export const assistantApi = {
  /** Catálogos de fuentes y acciones — llenan los checkboxes del editor. */
  getCatalogs: (): Promise<AssistantCatalogs> =>
    axiosClient.get<{ data: AssistantCatalogs }>(`${BASE}/catalogs`).then(r => r.data.data),

  listProfiles: (): Promise<AssistantProfile[]> =>
    axiosClient.get<{ data: AssistantProfile[] }>(`${BASE}/profiles`).then(r => r.data.data),

  getProfile: (id: string): Promise<AssistantProfileWithIntents> =>
    axiosClient
      .get<{ data: AssistantProfileWithIntents }>(`${BASE}/profiles/${id}`)
      .then(r => r.data.data),

  /**
   * `null` cuando el área no tiene agente — es 200, NO 404. Que un área no tenga agente es el
   * estado normal de casi todas; tratarlo como error obligaría a un `catch` que después se
   * come errores de verdad.
   */
  getProfileByArea: (areaId: string): Promise<AssistantProfileWithIntents | null> =>
    axiosClient
      .get<{ data: AssistantProfileWithIntents | null }>(`${BASE}/profiles/by-area/${areaId}`)
      .then(r => r.data.data),

  createProfile: (input: CreateAssistantProfileInput): Promise<AssistantProfile> =>
    axiosClient.post<{ data: AssistantProfile }>(`${BASE}/profiles`, input).then(r => r.data.data),

  updateProfile: (id: string, input: UpdateAssistantProfileInput): Promise<AssistantProfile> =>
    axiosClient
      .patch<{ data: AssistantProfile }>(`${BASE}/profiles/${id}`, input)
      .then(r => r.data.data),

  createIntent: (profileId: string, input: CreateAssistantIntentInput): Promise<AssistantIntent> =>
    axiosClient
      .post<{ data: AssistantIntent }>(`${BASE}/profiles/${profileId}/intents`, input)
      .then(r => r.data.data),

  updateIntent: (id: string, input: UpdateAssistantIntentInput): Promise<AssistantIntent> =>
    axiosClient
      .patch<{ data: AssistantIntent }>(`${BASE}/intents/${id}`, input)
      .then(r => r.data.data),

  deleteIntent: (id: string): Promise<void> =>
    axiosClient.delete(`${BASE}/intents/${id}`).then(() => undefined),

  /** Credenciales del proveedor — SIEMPRE enmascaradas (la key nunca baja al navegador). */
  getProvider: (): Promise<AssistantProviderConfig> =>
    axiosClient.get<{ data: AssistantProviderConfig }>(`${BASE}/provider`).then(r => r.data.data),

  updateProvider: (input: UpdateAssistantProviderInput): Promise<AssistantProviderConfig> =>
    axiosClient
      .put<{ data: AssistantProviderConfig }>(`${BASE}/provider`, input)
      .then(r => r.data.data),

  /** La prueba corre EN EL SERVIDOR: acá sólo se dispara y se lee el resultado. */
  testProvider: (): Promise<AssistantConnectionTest> =>
    axiosClient
      .post<{ data: AssistantConnectionTest }>(`${BASE}/provider/test`)
      .then(r => r.data.data),

  /** OBS-1 — historial de corridas. Filtrable por outcome para aislar `rejected_numbers`. */
  listRuns: (query: AssistantRunQuery = {}): Promise<AssistantRunPage> =>
    axiosClient
      .get<{ data: AssistantRunPage }>(`${BASE}/runs`, { params: query })
      .then(r => r.data.data),
};
