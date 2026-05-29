/**
 * Gestión Real ingest configuration — mirrors the backend DTO exactly.
 */
export interface IngestConfigDTO {
  intervalMs: number;
  windowMonths: number;
  fiberProjectId: string | null;
  wirelessProjectId: string | null;
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
  Pick<IngestConfigDTO, 'intervalMs' | 'windowMonths' | 'fiberProjectId' | 'wirelessProjectId'>
>;

/** Settled interval presets, in minutes. */
export const INTERVAL_PRESETS_MIN = [3, 5, 15, 30, 60] as const;

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
