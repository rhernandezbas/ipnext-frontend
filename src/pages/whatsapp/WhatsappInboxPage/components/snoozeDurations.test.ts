/**
 * snoozeDurations (Ola 6 — snooze) — catálogo de duraciones del mini-selector
 * de "Posponer" + el cálculo PURO del `snoozedUntil` ISO que viaja al BE
 * (`POST /snooze`, que exige fecha FUTURA). Separado del componente para
 * testear el cálculo sin renderizar.
 */
import { describe, it, expect } from 'vitest';
import { SNOOZE_DURATIONS, computeSnoozedUntil, isFutureSnooze } from './snoozeDurations';
import { arHour, arMinute, toArIsoDate } from '@/utils/formatDate';

describe('SNOOZE_DURATIONS — catálogo del selector', () => {
  it('expone 1h / 3h / mañana / 1 semana en ese orden', () => {
    expect(SNOOZE_DURATIONS.map((d) => d.id)).toEqual(['1h', '3h', 'tomorrow', '1w']);
    for (const d of SNOOZE_DURATIONS) {
      expect(d.label.length).toBeGreaterThan(0);
    }
  });
});

describe('computeSnoozedUntil — siempre una fecha FUTURA (contrato BE), anclada a hora ARGENTINA', () => {
  // `now` como INSTANTE UTC fijo (determinista sin importar el TZ del host/CI):
  // 18:30 UTC = 15:30 en Argentina (UTC-3), miércoles 18/07/2026.
  const now = new Date('2026-07-18T18:30:00.000Z');

  it('1h → exactamente una hora después (offset de instante, TZ-independiente)', () => {
    expect(computeSnoozedUntil('1h', now)).toBe(new Date(now.getTime() + 60 * 60 * 1000).toISOString());
  });

  it('3h → exactamente tres horas después', () => {
    expect(computeSnoozedUntil('3h', now)).toBe(new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString());
  });

  it('1 semana → exactamente 7 días después', () => {
    expect(computeSnoozedUntil('1w', now)).toBe(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
  });

  it('mañana → 09:00 de ARGENTINA del día siguiente (15:30 AR del 18 → 09:00 AR del 19 = 12:00 UTC)', () => {
    const result = computeSnoozedUntil('tomorrow', now);
    // 09:00 AR (UTC-3) del 19/07 = 12:00 UTC del 19/07.
    expect(result).toBe('2026-07-19T12:00:00.000Z');
    // Y verificado vía los helpers AR (no getters del host): 09:00 AR, día AR = 19.
    expect(arHour(result)).toBe(9);
    expect(arMinute(result)).toBe(0);
    expect(toArIsoDate(result)).toBe('2026-07-19');
  });

  it('todas las duraciones caen en el FUTURO respecto de `now`', () => {
    for (const d of SNOOZE_DURATIONS) {
      expect(new Date(computeSnoozedUntil(d.id, now)).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

describe('isFutureSnooze — ¿pospuesta ahora?', () => {
  const now = new Date(2026, 6, 18, 15, 30, 0, 0);

  it('null / undefined → false', () => {
    expect(isFutureSnooze(null, now)).toBe(false);
    expect(isFutureSnooze(undefined, now)).toBe(false);
  });

  it('fecha futura → true', () => {
    expect(isFutureSnooze(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(true);
  });

  it('fecha pasada (snooze ya vencido) → false', () => {
    expect(isFutureSnooze(new Date(now.getTime() - 60_000).toISOString(), now)).toBe(false);
  });

  it('fecha inválida → false (defensivo)', () => {
    expect(isFutureSnooze('no-es-fecha', now)).toBe(false);
  });
});
