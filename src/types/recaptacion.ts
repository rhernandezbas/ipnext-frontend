// ── Enums (string unions, exact values from BE) ─────────────────────────────

export type RecaptureLeadSource = 'churned_client' | 'csv';

export type RecaptureLeadStatus =
  | 'nuevo'
  | 'en_gestion'
  | 'contactado'
  | 'interesado'
  | 'recuperado'
  | 'descartado';

export type RecaptureContactChannel =
  | 'llamada'
  | 'whatsapp'
  | 'email'
  | 'sms'
  | 'otro';

export type RecaptureContactOutcome =
  | 'sin_respuesta'
  | 'contactado'
  | 'no_interesado'
  | 'interesado'
  | 'recuperado'
  | 'numero_erroneo';

// ── Spanish display labels ───────────────────────────────────────────────────

export const RECAPTURE_STATUS_LABELS: Record<RecaptureLeadStatus, string> = {
  nuevo:       'Nuevo',
  en_gestion:  'En gestión',
  contactado:  'Contactado',
  interesado:  'Interesado',
  recuperado:  'Recuperado',
  descartado:  'Descartado',
};

export const RECAPTURE_CHANNEL_LABELS: Record<RecaptureContactChannel, string> = {
  llamada:  'Llamada',
  whatsapp: 'WhatsApp',
  email:    'Email',
  sms:      'SMS',
  otro:     'Otro',
};

export const RECAPTURE_OUTCOME_LABELS: Record<RecaptureContactOutcome, string> = {
  sin_respuesta:  'Sin respuesta',
  contactado:     'Contactado',
  no_interesado:  'No interesado',
  interesado:     'Interesado',
  recuperado:     'Recuperado',
  numero_erroneo: 'Número erróneo',
};

export const RECAPTURE_STATUS_COLOR: Record<RecaptureLeadStatus, string> = {
  nuevo:      '#64748b',
  en_gestion: '#2563eb',
  contactado: '#0891b2',
  interesado: '#f59e0b',
  recuperado: '#16a34a',
  descartado: '#dc2626',
};

// ── Technology catalog + visual families ─────────────────────────────────────

/**
 * Closed catalog of technology values the BE emits on each lead. Used both as
 * the filter options and to map each value to a color family. The BE MAY add
 * values over time, so consumers must tolerate unknown strings (→ 'other').
 */
export const RECAPTURE_TECHNOLOGY_CATALOG = [
  'Fiber',
  'FTTH',
  'Wireless',
  'DOCSIS',
  'HFC',
  'Radio',
] as const;

/** Visual family that drives badge color. */
export type RecaptureTechnologyFamily = 'fiber' | 'wireless' | 'cable' | 'other';

/** Catalog value → family. Anything not here resolves to 'other' (neutral). */
export const RECAPTURE_TECHNOLOGY_FAMILY: Record<string, RecaptureTechnologyFamily> = {
  Fiber:    'fiber',
  FTTH:     'fiber',
  Wireless: 'wireless',
  Radio:    'wireless',
  DOCSIS:   'cable',
  HFC:      'cable',
};

/** Resolve a technology value to its color family (defensive for unknowns). */
export function technologyFamily(tech: string): RecaptureTechnologyFamily {
  return RECAPTURE_TECHNOLOGY_FAMILY[tech] ?? 'other';
}

/**
 * Display rank per family. Lower renders first: FIBER first, then WIRELESS,
 * then CABLE, then anything else.
 */
const TECHNOLOGY_FAMILY_RANK: Record<RecaptureTechnologyFamily, number> = {
  fiber:    0,
  wireless: 1,
  cable:    2,
  other:    3,
};

/**
 * Order technologies fiber-first. `Array.prototype.sort` is stable, so values
 * within the same family keep their original order. Pure — returns a new array.
 */
export function orderTechnologies(technologies: string[]): string[] {
  return [...technologies].sort(
    (a, b) => TECHNOLOGY_FAMILY_RANK[technologyFamily(a)] - TECHNOLOGY_FAMILY_RANK[technologyFamily(b)],
  );
}

// ── DTOs (field names must match the BE contract exactly) ────────────────────

export interface RecaptureLeadDto {
  id: string;
  source: RecaptureLeadSource;
  clientId: string | null;
  contactName: string;
  phone: string | null;
  email: string | null;
  status: RecaptureLeadStatus;
  assigneeId: string | null;
  /** Resolved name of the assignee — null when unassigned or not yet loaded. */
  assigneeName: string | null;
  /** Distinct technology values from the catalog. May be empty. */
  technologies: string[];
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecaptureContactDto {
  id: string;
  leadId: string;
  actorId: string;
  channel: RecaptureContactChannel;
  outcome: RecaptureContactOutcome;
  proposal: string | null;
  note: string | null;
  nextStepAt: string | null;
  createdAt: string;
}

/** Detail DTO — RecaptureLeadDto + contacts newest-first */
export interface RecaptureLeadDetailDto extends RecaptureLeadDto {
  contacts: RecaptureContactDto[];
}

// ── API input shapes ─────────────────────────────────────────────────────────

export interface RecaptureLeadsQuery {
  status?: RecaptureLeadStatus | '';
  source?: RecaptureLeadSource;
  assigneeId?: string;
  unassigned?: boolean;
  /** Filter by a single technology value from the catalog. */
  technology?: string;
  page?: number;
  limit?: number;
}

export interface AddContactInput {
  channel: RecaptureContactChannel;
  outcome: RecaptureContactOutcome;
  proposal?: string;
  note?: string;
  nextStepAt?: string;
  /** When provided, the BE will advance the lead to this specific status. */
  advanceStatus?: RecaptureLeadStatus;
}

/** Paginated result shape from the recapture BE (uses `limit`, not `pageSize`). */
export interface RecapturePaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
