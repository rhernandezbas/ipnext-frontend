import { describe, it, expect } from 'vitest';
import {
  arCalendarDate,
  arMidnightUtcISO,
  addCalendarDays,
  presetRange,
  customRange,
  DAY_MS,
} from './range';

describe('range — AR calendar helpers', () => {
  it('arCalendarDate mapea un instante a la fecha AR (offset -3)', () => {
    // 13:00Z = 10:00 AR del mismo día
    expect(arCalendarDate(new Date('2026-07-18T13:00:00.000Z'))).toBe('2026-07-18');
  });

  it('arCalendarDate respeta el cruce de medianoche AR (UTC día 19, AR día 18)', () => {
    // 02:30Z del 19 = 23:30 AR del 18 → sigue siendo el 18 en AR
    expect(arCalendarDate(new Date('2026-07-19T02:30:00.000Z'))).toBe('2026-07-18');
  });

  it('arMidnightUtcISO devuelve la medianoche AR (00:00 -03:00) en UTC', () => {
    // 00:00 AR = 03:00 UTC del mismo día
    expect(arMidnightUtcISO('2026-07-01')).toBe('2026-07-01T03:00:00.000Z');
  });

  it('addCalendarDays suma/resta días de calendario sin romperse en fin de mes', () => {
    expect(addCalendarDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addCalendarDays('2026-07-31', 1)).toBe('2026-08-01');
  });
});

describe('range — presets', () => {
  const NOW = new Date('2026-07-18T13:00:00.000Z'); // AR 10:00 del 18

  it('preset 7d: [from,to) inclusivo de hoy, 7 días de span', () => {
    const { from, to } = presetRange('7d', NOW);
    // to = medianoche AR de mañana (19) → exclusivo, cubre todo hoy
    expect(to).toBe('2026-07-19T03:00:00.000Z');
    // from = medianoche AR de hoy-6 (12)
    expect(from).toBe('2026-07-12T03:00:00.000Z');
    // span exacto = 7 días
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(7 * DAY_MS);
  });

  it('preset 30d: 30 días de span, mismo `to`', () => {
    const { from, to } = presetRange('30d', NOW);
    expect(to).toBe('2026-07-19T03:00:00.000Z');
    expect(from).toBe('2026-06-19T03:00:00.000Z');
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(30 * DAY_MS);
  });

  it('el rango es medianoche-alineado en AR (from/to a las 03:00Z)', () => {
    const { from, to } = presetRange('7d', new Date('2026-07-19T02:30:00.000Z'));
    // AR sigue en el 18 → mismo rango que NOW del 18
    expect(from).toBe('2026-07-12T03:00:00.000Z');
    expect(to).toBe('2026-07-19T03:00:00.000Z');
  });
});

describe('range — custom', () => {
  it('customRange es INCLUSIVO de ambos extremos (to = medianoche del día siguiente)', () => {
    const { from, to } = customRange('2026-07-01', '2026-07-07');
    expect(from).toBe('2026-07-01T03:00:00.000Z');
    // 07-07 inclusive → to = medianoche AR del 08
    expect(to).toBe('2026-07-08T03:00:00.000Z');
  });
});
