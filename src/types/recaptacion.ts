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
  assigneeId?: string;
  unassigned?: boolean;
  page?: number;
  limit?: number;
}

export interface AddContactInput {
  channel: RecaptureContactChannel;
  outcome: RecaptureContactOutcome;
  proposal?: string;
  note?: string;
  nextStepAt?: string;
  advanceStatus?: boolean;
}

/** Paginated result shape from the recapture BE (uses `limit`, not `pageSize`). */
export interface RecapturePaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
