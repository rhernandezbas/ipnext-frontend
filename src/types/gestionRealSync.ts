/**
 * Gestión Real client-sync configuration — mirrors the backend DTO exactly.
 *
 *   GET  /gestion-real/sync/config → { intervalMs, estados }
 *   PUT  /gestion-real/sync/config → partial { intervalMs?, estados? }
 *
 * The interval-preset helpers are the one genuinely shared, stable unit with the
 * ingest tab, so we RE-EXPORT them from `gestionRealIngest.ts` (no local copy).
 */
export {
  INTERVAL_PRESETS_MIN,
  minutesToMs,
  msToMinutes,
  resolveIntervalPreset,
} from './gestionRealIngest';

/** Sync configuration — mirrors the backend DTO exactly. */
export interface SyncConfigDTO {
  intervalMs: number;
  estados: string[];
}

/** Partial body accepted by `PUT /gestion-real/sync/config`. */
export type UpdateSyncConfigPayload = Partial<Pick<SyncConfigDTO, 'intervalMs' | 'estados'>>;

/** A selectable client state. `value` matches the backend whitelist. */
export interface EstadoCatalogEntry {
  value: string;
  label: string;
}

/**
 * The estados whitelist is `["1","2","3","4","6"]` (note: no "5"). This catalog
 * is the single source of truth so the UI only ever offers whitelisted values.
 */
export const ESTADOS_CATALOG: readonly EstadoCatalogEntry[] = [
  { value: '1', label: 'Activo' },
  { value: '2', label: 'Deudor' },
  { value: '3', label: 'Inactivo' },
  { value: '4', label: 'Incobrable' },
  { value: '6', label: 'Baja' },
] as const;

/**
 * Set-equality for estados: same length and every element present, regardless of
 * order. Used for dirty-comparison so re-checking back to the original state
 * correctly reports "clean".
 */
export function estadosEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every(v => setB.has(v));
}
