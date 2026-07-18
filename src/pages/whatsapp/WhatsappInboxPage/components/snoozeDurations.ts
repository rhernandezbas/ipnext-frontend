import { toArIsoDate, arDayStartUtc } from '@/utils/formatDate';

/**
 * snoozeDurations (Ola 6 — snooze) — catálogo de duraciones del mini-selector
 * "Posponer" + el cálculo PURO del `snoozedUntil` ISO. El BE (`POST /snooze`)
 * exige una fecha FUTURA: todas las opciones producen un instante posterior a
 * `now` por construcción. "Mañana" ancla a las 9:00 de ARGENTINA (UTC-3, hora
 * de oficina) del día siguiente — NO del host/UTC (guard `no-browser-tz`); el
 * resto son offsets de milisegundos sobre el instante, TZ-independientes.
 */

export type SnoozeDurationId = '1h' | '3h' | 'tomorrow' | '1w';

export interface SnoozeDurationDef {
  id: SnoozeDurationId;
  label: string;
}

export const SNOOZE_DURATIONS: readonly SnoozeDurationDef[] = [
  { id: '1h', label: 'En 1 hora' },
  { id: '3h', label: 'En 3 horas' },
  { id: 'tomorrow', label: 'Mañana' },
  { id: '1w', label: 'En 1 semana' },
] as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Hora de oficina a la que despierta un snooze de "Mañana" (en ARGENTINA, UTC-3). */
const TOMORROW_HOUR = 9;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * ¿La conversación está pospuesta AHORA? Un `snoozedUntil` en el pasado (snooze
 * ya vencido) o ausente cuenta como NO pospuesta — el BE lo despierta solo, el
 * FE degrada a "no pospuesta" sin esperar el refetch. Fecha inválida = no
 * pospuesta (defensivo).
 */
export function isFutureSnooze(snoozedUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!snoozedUntil) return false;
  const ts = new Date(snoozedUntil).getTime();
  return Number.isFinite(ts) && ts > now.getTime();
}

export function computeSnoozedUntil(id: SnoozeDurationId, now: Date = new Date()): string {
  switch (id) {
    case '1h':
      return new Date(now.getTime() + HOUR_MS).toISOString();
    case '3h':
      return new Date(now.getTime() + 3 * HOUR_MS).toISOString();
    case '1w':
      return new Date(now.getTime() + 7 * DAY_MS).toISOString();
    case 'tomorrow': {
      // Día AR de `now` (independiente del host) → medianoche AR de ese día
      // (instante UTC) + 24h = medianoche AR de MAÑANA (AR es UTC-3 fijo, sin
      // DST: sumar 24h nunca cruza mal). De ahí derivo el día AR de mañana y
      // construyo las 09:00 AR con el offset -03:00 explícito.
      const tomorrowArDay = toArIsoDate(new Date(arDayStartUtc(toArIsoDate(now)).getTime() + DAY_MS));
      return new Date(`${tomorrowArDay}T${pad2(TOMORROW_HOUR)}:00:00.000-03:00`).toISOString();
    }
  }
}
