import type { ReportsDateRange } from '@/types/messagingReports';

/**
 * Helpers de rango para el dashboard de Informes.
 *
 * Regla del contrato BE: `from`/`to` son UTC ISO y el rango es `[from, to)`
 * (semiabierto). Todos los límites se alinean a la MEDIANOCHE de Buenos Aires.
 * Argentina no observa DST desde 2009 (offset fijo UTC-3), así que medianoche
 * AR = 03:00 UTC del mismo día. Construimos el ISO con el offset `-03:00`
 * explícito y dejamos que `Date` lo normalice a UTC — cero dependencias de tz.
 */

export const AR_TZ = 'America/Argentina/Buenos_Aires';
const AR_OFFSET = '-03:00';
export const DAY_MS = 24 * 60 * 60 * 1000;

export type RangePreset = '7d' | '30d' | 'custom';

/** Fecha de calendario AR (`YYYY-MM-DD`) de un instante dado. */
export function arCalendarDate(instant: Date): string {
  // en-CA formatea como YYYY-MM-DD; timeZone hace la conversión a hora AR.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** UTC ISO de la medianoche AR (00:00 -03:00) de una fecha de calendario AR. */
export function arMidnightUtcISO(arDate: string): string {
  return new Date(`${arDate}T00:00:00.000${AR_OFFSET}`).toISOString();
}

/** Suma `n` días de calendario a una fecha `YYYY-MM-DD` (aritmética UTC pura). */
export function addCalendarDays(arDate: string, n: number): string {
  const d = new Date(`${arDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Preset relativo INCLUSIVO de hoy: `7d` = hoy + 6 días previos, `30d` = hoy +
 * 29 previos. `to` es la medianoche AR de MAÑANA (exclusivo, cubre todo hoy);
 * `from` es la medianoche AR del primer día de la ventana.
 */
export function presetRange(preset: '7d' | '30d', now: Date = new Date()): ReportsDateRange {
  const todayAr = arCalendarDate(now);
  const span = preset === '7d' ? 7 : 30;
  const to = arMidnightUtcISO(addCalendarDays(todayAr, 1));
  const from = arMidnightUtcISO(addCalendarDays(todayAr, 1 - span));
  return { from, to };
}

/**
 * Rango custom a partir de dos fechas de calendario AR (`YYYY-MM-DD`), INCLUSIVO
 * de ambos extremos: `to` es la medianoche AR del día SIGUIENTE a `toDate`.
 */
export function customRange(fromDate: string, toDate: string): ReportsDateRange {
  return {
    from: arMidnightUtcISO(fromDate),
    to: arMidnightUtcISO(addCalendarDays(toDate, 1)),
  };
}
