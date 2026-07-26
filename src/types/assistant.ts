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
