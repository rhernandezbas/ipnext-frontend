import type { ReportsDateRange, ResolutionDay } from '@/types/messagingReports';
import { arCalendarDate } from './range';

/**
 * Rellena los días faltantes del rango con `count: 0` para producir un eje
 * temporal CONTINUO y ascendente (el BE solo devuelve días con `count > 0`).
 *
 * El rango es `[from, to)`: iteramos las fechas de calendario AR desde la de
 * `from` hasta la de `to` EXCLUSIVE. Un día que el BE reportó pero cae fuera del
 * rango se descarta (defensivo).
 */
export function fillResolutionDays(range: ReportsDateRange, days: ResolutionDay[]): ResolutionDay[] {
  const byDate = new Map(days.map((d) => [d.date, d.count]));

  const startAr = arCalendarDate(new Date(range.from));
  const endArExclusive = arCalendarDate(new Date(range.to));

  const out: ResolutionDay[] = [];
  const cursor = new Date(`${startAr}T00:00:00.000Z`);
  const end = new Date(`${endArExclusive}T00:00:00.000Z`);

  while (cursor.getTime() < end.getTime()) {
    const date = cursor.toISOString().slice(0, 10);
    out.push({ date, count: byDate.get(date) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}
