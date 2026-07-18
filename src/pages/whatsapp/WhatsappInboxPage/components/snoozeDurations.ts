/**
 * snoozeDurations (Ola 6 — snooze) — catálogo de duraciones del mini-selector
 * "Posponer" + el cálculo PURO del `snoozedUntil` ISO. El BE (`POST /snooze`)
 * exige una fecha FUTURA: todas las opciones producen un instante posterior a
 * `now` por construcción. "Mañana" ancla a las 9:00 LOCAL del día siguiente
 * (hora de oficina), el resto son offsets simples.
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
/** Hora de oficina a la que despierta un snooze de "Mañana". */
const TOMORROW_HOUR = 9;

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
  const d = new Date(now.getTime());
  switch (id) {
    case '1h':
      d.setTime(now.getTime() + HOUR_MS);
      break;
    case '3h':
      d.setTime(now.getTime() + 3 * HOUR_MS);
      break;
    case 'tomorrow':
      d.setDate(d.getDate() + 1);
      d.setHours(TOMORROW_HOUR, 0, 0, 0);
      break;
    case '1w':
      d.setTime(now.getTime() + 7 * DAY_MS);
      break;
  }
  return d.toISOString();
}
