import { describe, it, expect } from 'vitest';
import {
  heatLevel,
  buildHeatGrid,
  maxCount,
  HEAT_LEVELS,
  DOW_LABELS_AR,
} from './heatmap';
import type { TrafficCell } from '@/types/messagingReports';

describe('heatLevel', () => {
  it('count 0 (o negativo) → nivel 0 (celda vacía/neutra)', () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(-5, 10)).toBe(0);
  });

  it('max con guard: max<=0 → nivel 0 (no divide por cero)', () => {
    expect(heatLevel(3, 0)).toBe(0);
  });

  it('escala count>0 a 1..HEAT_LEVELS (el máximo = nivel tope)', () => {
    expect(heatLevel(10, 10)).toBe(HEAT_LEVELS);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(5, 10)).toBe(3); // ceil(0.5*5)
    expect(heatLevel(2, 10)).toBe(1); // ceil(1.0)
  });
});

describe('buildHeatGrid', () => {
  it('devuelve una grilla 7x24 con null donde no hay dato', () => {
    const grid = buildHeatGrid([]);
    expect(grid).toHaveLength(7);
    expect(grid.every((row) => row.length === 24)).toBe(true);
    expect(grid.every((row) => row.every((c) => c === null))).toBe(true);
  });

  it('ubica cada celda por dow (0=domingo) y hour', () => {
    const cells: TrafficCell[] = [
      { dow: 0, hour: 0, count: 4 }, // domingo 00h
      { dow: 6, hour: 23, count: 9 }, // sábado 23h
      { dow: 1, hour: 14, count: 7 }, // lunes 14h
    ];
    const grid = buildHeatGrid(cells);
    expect(grid[0][0]).toBe(4);
    expect(grid[6][23]).toBe(9);
    expect(grid[1][14]).toBe(7);
    // el resto sigue vacío
    expect(grid[1][13]).toBeNull();
  });

  it('descarta celdas con dow/hour fuera de rango (defensivo)', () => {
    const grid = buildHeatGrid([{ dow: 9, hour: 30, count: 5 } as TrafficCell]);
    expect(grid.every((row) => row.every((c) => c === null))).toBe(true);
  });
});

describe('maxCount', () => {
  it('devuelve el máximo count (0 si no hay celdas)', () => {
    expect(maxCount([])).toBe(0);
    expect(
      maxCount([
        { dow: 0, hour: 1, count: 3 },
        { dow: 2, hour: 5, count: 8 },
      ]),
    ).toBe(8);
  });
});

describe('DOW_LABELS_AR', () => {
  it('índice = dow, 0=Dom .. 6=Sáb', () => {
    expect(DOW_LABELS_AR).toEqual(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);
  });
});
