// Tipos del módulo Cortes PPPoE (Fase C del backend pppoe-service).
// Contrato BE↔FE explícito campo por campo (lección W6: no asumir, espejar el DTO real).

export type EnforcementAction = 'reduce' | 'block' | 'restore';
export type EnforcedState = 'active' | 'reduced' | 'blocked';

/**
 * Objetivo de un corte masivo / preview:
 *   'debtors'           → deudores (Client.status='late')
 *   { clientStatus }    → cualquier estado (ej. 'baja')
 *   { pppoeIds: [...] } → lista explícita de PPPoE
 */
export type EnforcementTarget =
  | 'debtors'
  | { clientStatus: string }
  | { pppoeIds: string[] };

export interface EnforcementPreviewSample {
  id: string;
  username: string;
  nasId: string;
  contractId: string | null;
  enforcedState: EnforcedState;
}

/** Respuesta de POST /pppoe/enforce/preview — impacto SIN ejecutar. */
export interface EnforcementPreview {
  total: number;
  byRouter: Record<string, number>; // nasId → cantidad
  sample: EnforcementPreviewSample[];
}

/** Respuesta 202 de POST /pppoe/enforce/bulk. */
export interface BulkEnforcementStarted {
  jobId: string;
  total: number;
}

export type ServiceCutBatchStatus = 'pending' | 'running' | 'done' | 'failed';

export interface ServiceCutItem {
  pppoeId: string;
  ok: boolean;
  error?: string;
}

/** Respuesta de GET /pppoe/enforce/bulk/:id — estado poleable del batch. */
export interface ServiceCutBatch {
  id: string;
  action: EnforcementAction;
  status: ServiceCutBatchStatus;
  total: number;
  doneCount: number;
  failedCount: number;
  items: ServiceCutItem[];
  createdAt: string;
  finishedAt: string | null;
}

/** DTO de un PPPoE (sin password — frontera de seguridad del BE). */
export interface PppoeServiceDto {
  id: string;
  username: string;
  profile: string | null;
  remoteAddress: string | null;
  status: string;
  enforcedState: EnforcedState;
  nasId: string;
  contractId: string | null;
  createdAt: string;
  /** Modo de asignación de IP: 'pool' = el NAS asigna desde su pool; 'fixed' = IP fija pinneada. */
  ipMode: 'pool' | 'fixed';
}

// ── Etiquetas UI ──────────────────────────────────────────────────────────────

export const ENFORCEMENT_ACTION_LABELS: Record<EnforcementAction, string> = {
  reduce: 'Reducir',
  block: 'Bloquear',
  restore: 'Restaurar',
};

/** Verbo en infinitivo para los mensajes de confirmación ("vas a {verbo}…"). */
export const ENFORCEMENT_ACTION_VERB: Record<EnforcementAction, string> = {
  reduce: 'reducir',
  block: 'bloquear',
  restore: 'restaurar',
};

export const ENFORCED_STATE_LABELS: Record<EnforcedState, string> = {
  active: 'Activo',
  reduced: 'Reducido',
  blocked: 'Bloqueado',
};
