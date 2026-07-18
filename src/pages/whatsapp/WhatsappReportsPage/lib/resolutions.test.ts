import { describe, it, expect } from 'vitest';
import { fillResolutionDays } from './resolutions';
import type { ResolutionDay } from '@/types/messagingReports';

describe('fillResolutionDays', () => {
  // 7d: AR days 07-12 .. 07-18 inclusive (07-19 exclusivo)
  const RANGE = { from: '2026-07-12T03:00:00.000Z', to: '2026-07-19T03:00:00.000Z' };

  it('rellena TODOS los días del rango, los faltantes con 0', () => {
    const days: ResolutionDay[] = [
      { date: '2026-07-14', count: 3 },
      { date: '2026-07-18', count: 5 },
    ];
    const filled = fillResolutionDays(RANGE, days);
    expect(filled).toEqual([
      { date: '2026-07-12', count: 0 },
      { date: '2026-07-13', count: 0 },
      { date: '2026-07-14', count: 3 },
      { date: '2026-07-15', count: 0 },
      { date: '2026-07-16', count: 0 },
      { date: '2026-07-17', count: 0 },
      { date: '2026-07-18', count: 5 },
    ]);
  });

  it('produce un eje continuo y ascendente aún sin datos', () => {
    const filled = fillResolutionDays(RANGE, []);
    expect(filled).toHaveLength(7);
    expect(filled.every((d) => d.count === 0)).toBe(true);
    // ascendente
    const dates = filled.map((d) => d.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('ignora días fuera del rango (defensivo)', () => {
    const filled = fillResolutionDays(RANGE, [{ date: '2026-08-01', count: 99 }]);
    expect(filled.every((d) => d.count === 0)).toBe(true);
  });
});
