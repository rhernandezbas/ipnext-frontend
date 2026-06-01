/**
 * Gestión Real ingest configuration — mirrors the backend DTO exactly.
 */
export interface IngestConfigDTO {
  intervalMs: number;
  windowMonths: number;
  fiberProjectId: string | null;
  wirelessProjectId: string | null;
  /** Which GR installation-order state to ingest. One of PEND/CONF/CERR/ANUL. */
  sourceEstado: string;
}

/**
 * Last ingest run status counters — mirrors the backend DTO exactly.
 */
export interface IngestStatusDTO {
  lastRunAt: string | null;
  created: number;
  skippedDuplicate: number;
  skippedUnmirrored: number;
  unclassified: number;
}

/**
 * A task that requires manual review (unclassified ingest). Mirrors the backend DTO.
 */
export interface NeedsReviewTaskDTO {
  id: string;
  title: string;
  description: string | null;
  grOrdenId: string | null;
  projectId: string | null;
  customerId: string | null;
  serviceId: string | null;
  address: string | null;
  category: string;
  priority: string;
  stageId: string;
  createdAt: string;
}

/** Partial body accepted by `PUT /gestion-real-ingest/config`. */
export type UpdateIngestConfigPayload = Partial<
  Pick<
    IngestConfigDTO,
    'intervalMs' | 'windowMonths' | 'fiberProjectId' | 'wirelessProjectId' | 'sourceEstado'
  >
>;

/** Settled interval presets, in minutes. */
export const INTERVAL_PRESETS_MIN = [3, 5, 15, 30, 60] as const;

/**
 * GR installation-order states selectable as the ingest source, with Spanish
 * labels for the UI. Mirrors the backend's valid `sourceEstado` values.
 */
export const GR_ESTADO_OPTIONS = [
  { value: 'PEND', label: 'Pendiente' },
  { value: 'CONF', label: 'Confirmada' },
  { value: 'CERR', label: 'Cerrada' },
  { value: 'ANUL', label: 'Anulada' },
] as const;

/** Convert minutes to milliseconds. */
export const minutesToMs = (min: number): number => min * 60_000;

/** Convert milliseconds to the nearest whole minute. */
export const msToMinutes = (ms: number): number => Math.round(ms / 60_000);

/**
 * Resolve a loaded `intervalMs` to a preset selection. When the value does not
 * map to a known preset, `isPreset` is false so the UI can render a graceful
 * custom option instead of crashing or silently dropping the value.
 */
export function resolveIntervalPreset(intervalMs: number): { minutes: number; isPreset: boolean } {
  const minutes = msToMinutes(intervalMs);
  const isPreset = (INTERVAL_PRESETS_MIN as readonly number[]).includes(minutes);
  return { minutes, isPreset };
}
