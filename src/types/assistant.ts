/**
 * ai-assistant-multiagent — contrato BE↔FE del asistente IA conversacional.
 *
 * ⚠️ Estos tipos espejan CAMPO POR CAMPO los DTOs del backend
 * (`application/dto/assistant.dto.ts` + `ListAssistantRuns`). No se derivan ni se infieren:
 * en la Wave 6 del EPIC #38, BE y FE se construyeron en paralelo desde el spec, driftaron, y
 * la página renderizó filas en blanco con toda la suite en verde. El contrato va explícito.
 */

export type AssistantRiskLevel = 'green' | 'yellow' | 'red';

export type AssistantOutcome =
  | 'replied'
  | 'handoff'
  | 'noop'
  | 'rejected_numbers'
  | 'error';

export interface AssistantProfile {
  id: string;
  areaId: string;
  enabled: boolean;
  persona: string;
  handoffMessage: string;
  model: string;
  classifierModel: string | null;
  timeoutMs: number;
  enabledActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssistantIntent {
  id: string;
  profileId: string;
  name: string;
  description: string;
  examples: string[];
  enabled: boolean;
  dataSourceKeys: string[];
  responseGuide: string;
  actionKey: string;
  createdAt: string;
  updatedAt: string;
}

/** El perfil con sus intenciones — lo que devuelve el detalle y el `by-area`. */
export interface AssistantProfileWithIntents extends AssistantProfile {
  intents: AssistantIntent[];
}

export interface AssistantDataSource {
  key: string;
  label: string;
  enabled: boolean;
}

export interface AssistantAction {
  key: string;
  label: string;
  riskLevel: AssistantRiskLevel;
}

export interface AssistantCatalogs {
  dataSources: AssistantDataSource[];
  actions: AssistantAction[];
}

/**
 * OBS-1 — una corrida del motor. NO trae `profileId` ni contenido: la auditoría registra QUÉ
 * pasó y POR QUÉ, nunca QUÉ SE DIJO.
 */
export interface AssistantRun {
  id: string;
  areaId: string | null;
  subjectType: 'conversation';
  subjectId: string;
  intentName: string | null;
  dataSources: string[];
  actionKey: string | null;
  outcome: AssistantOutcome;
  reason: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface AssistantRunPage {
  items: AssistantRun[];
  total: number;
}

export interface AssistantRunQuery {
  areaId?: string;
  outcome?: AssistantOutcome;
  subjectId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface CreateAssistantProfileInput {
  areaId: string;
  persona?: string;
  handoffMessage?: string;
  model?: string;
  classifierModel?: string | null;
  timeoutMs?: number;
}

export interface UpdateAssistantProfileInput {
  enabled?: boolean;
  persona?: string;
  handoffMessage?: string;
  model?: string;
  classifierModel?: string | null;
  timeoutMs?: number;
  enabledActions?: string[];
}

export interface CreateAssistantIntentInput {
  name: string;
  description: string;
  examples?: string[];
  enabled?: boolean;
  dataSourceKeys?: string[];
  responseGuide?: string;
  actionKey: string;
}

export type UpdateAssistantIntentInput = Partial<CreateAssistantIntentInput>;

/** Etiqueta y color de cada nivel de riesgo — el chip que la UI pinta. */
export const RISK_LABELS: Record<AssistantRiskLevel, string> = {
  green: 'Bajo',
  yellow: 'Medio',
  red: 'Alto',
};

/**
 * Copys de los outcomes, en el idioma del operador. `rejected_numbers` es el más importante:
 * cada uno es una alucinación sobre plata que NO llegó al cliente.
 */
export const OUTCOME_LABELS: Record<AssistantOutcome, string> = {
  replied: 'Respondió',
  handoff: 'Derivó a humano',
  noop: 'No intervino',
  rejected_numbers: 'Descartó cifra sin respaldo',
  error: 'Error',
};

/**
 * Credenciales del proveedor de IA — SIEMPRE enmascaradas.
 *
 * ⚠️ No existe un campo `apiKey` acá, y no es un olvido: el backend NUNCA la serializa. Todo
 * lo que llega a este tipo se descargó al navegador y es público. Si alguien agrega `apiKey`
 * a este shape, la está publicando.
 */
export interface AssistantProviderConfig {
  /**
   * URL GUARDADA desde esta pantalla. Vacía ⇒ se usa la del deploy. Es lo que edita el form.
   *
   * Ojo: NO es la que está en uso. El form reenvía este valor al guardar, así que si acá
   * viniera la efectiva, guardar la key promovería la URL del deploy a la DB y el env
   * quedaría muerto en silencio.
   */
  baseUrl: string;
  /** URL realmente en uso. Sólo para MOSTRAR (placeholder) — nunca se reenvía. */
  effectiveBaseUrl: string;
  /** ¿Hay una credencial EFECTIVA (de la UI o del deploy)? */
  hasApiKey: boolean;
  /** Últimos 4 de la key guardada desde esta pantalla, o null. */
  apiKeyLast4: string | null;
  /** `db` = cargada acá · `env` = secret del deploy · `none` = el bot está mudo */
  source: 'db' | 'env' | 'none';
}

export interface UpdateAssistantProviderInput {
  baseUrl?: string;
  /** Vacío o ausente PRESERVA la guardada. Para borrarla, `clearApiKey`. */
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface AssistantConnectionTest {
  ok: boolean;
  detail: string;
  latencyMs: number | null;
}

/** Cómo se le explica al operador de dónde sale la credencial en uso. */
export const PROVIDER_SOURCE_LABELS: Record<AssistantProviderConfig['source'], string> = {
  db: 'Cargada desde esta pantalla',
  env: 'Del secret del deploy',
  none: 'Sin credencial — el asistente no puede responder',
};
