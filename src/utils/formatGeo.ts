/**
 * Formateo de magnitudes geo/temporales del módulo de cuadrillas (`iclass-gps-audit`).
 *
 * Todo degrada a "—" en vez de a `NaN`, `null` o string vacío: en una pantalla que
 * sirve de evidencia sobre una persona, una celda vacía se lee como "no estuvo" y
 * una celda con "—" se lee como "no hay dato". No es lo mismo.
 *
 * Los separadores son los de es-AR (coma decimal) pero se arman a mano en vez de
 * con `toLocaleString`, para que el resultado no dependa del ICU del host.
 */

/** Placeholder de dato ausente. Mismo que `formatDate.ts`. */
const EMPTY = '—';

const comma = (n: number, decimals: number): string => n.toFixed(decimals).replace('.', ',');

/**
 * Distancia en metros → "320 m" / "2,2 km".
 * Bajo 1 km se muestra en metros enteros: la precisión GPS no da para decimales.
 */
export function formatMeters(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return EMPTY;
  if (Math.abs(meters) < 1000) return `${Math.round(meters)} m`;
  return `${comma(meters / 1000, 1)} km`;
}

/** Precisión (radio) del fix GPS → "±12 m". */
export function formatAccuracy(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return EMPTY;
  return `±${Math.round(meters)} m`;
}

/**
 * Antigüedad en minutos → "hace 4 min" / "hace 3 h 20 min" / "hace 2 días".
 * Se usa para que una posición vieja NUNCA pueda leerse como actual.
 */
export function formatMinutesElapsed(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return EMPTY;
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `hace ${total} min`;

  const hours = Math.floor(total / 60);
  if (hours < 24) {
    const rest = total % 60;
    return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest} min`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

/**
 * Duración en minutos (fraccionaria) → "2m 16s" / "45s" / "1h 05m".
 * El pre-filtro de cierres trabaja con tramos de pocos minutos: redondear a
 * minutos enteros borraría justo la información que lo hace útil.
 */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return EMPTY;
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins < 60) return `${mins}m ${String(secs).padStart(2, '0')}s`;

  const hours = Math.floor(mins / 60);
  return `${hours}h ${String(mins % 60).padStart(2, '0')}m`;
}

/** Cantidad de minutos "sueltos" → "7 min". Devuelve "—" si no hay dato. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return EMPTY;
  const rounded = Math.round(minutes * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : comma(rounded, 1)} min`;
}
