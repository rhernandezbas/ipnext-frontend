import type { TrafficCell } from '@/types/messagingReports';

/**
 * Helpers del heatmap de tráfico (día de semana × hora).
 *
 * Escala SECUENCIAL de un solo tono (azul, método dataviz): el nivel 0 es la
 * celda VACÍA/neutra (sin dato) y los niveles 1..HEAT_LEVELS mapean count>0 de
 * claro→oscuro. La grilla es `[dow][hour]`, con `dow` 0=domingo..6=sábado y
 * `hour` 0..23 tal cual los agrupa el BE en hora AR (NO reconvertir).
 */

export const HEAT_LEVELS = 5;

/** Etiquetas de día; el índice ES el `dow` (0=Dom .. 6=Sáb, orden del BE). */
export const DOW_LABELS_AR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

export const DOW_FULL_AR = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/**
 * Nivel de color de una celda: 0 si no hay tráfico (o `max<=0`), si no
 * `1..HEAT_LEVELS` proporcional a `count/max` (el máximo cae en el nivel tope).
 */
export function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const level = Math.ceil((count / max) * HEAT_LEVELS);
  return Math.min(HEAT_LEVELS, Math.max(1, level));
}

/** Máximo `count` de las celdas (0 si no hay). */
export function maxCount(cells: TrafficCell[]): number {
  return cells.reduce((m, c) => (c.count > m ? c.count : m), 0);
}

/** Grilla 7×24 `[dow][hour]` = count (o `null` si no hay celda para ese slot). */
export function buildHeatGrid(cells: TrafficCell[]): (number | null)[][] {
  const grid: (number | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => null as number | null),
  );
  for (const c of cells) {
    if (c.dow < 0 || c.dow > 6 || c.hour < 0 || c.hour > 23) continue;
    grid[c.dow][c.hour] = c.count;
  }
  return grid;
}
