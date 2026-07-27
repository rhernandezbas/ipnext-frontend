/**
 * journeyRequiresAudit — espejo EXACTO del gate dinámico del backend.
 *
 * El BE sirve la jornada de hoy/ayer con `technicians.location_read` y cualquier
 * día anterior con `technicians.location_audit` (OPERATIONAL_JOURNEY_DAYS = 1).
 * Si el FE se desalinea, o pide y come un 403, o esconde algo que sí puede ver.
 */
import { describe, it, expect } from 'vitest';
import { isFutureDay, journeyRequiresAudit } from '@/hooks/useTechnicianLocation';

const TODAY = '2026-07-26';

describe('journeyRequiresAudit', () => {
  it('hoy NO requiere auditoría', () => {
    expect(journeyRequiresAudit('2026-07-26', TODAY)).toBe(false);
  });

  it('ayer NO requiere auditoría', () => {
    expect(journeyRequiresAudit('2026-07-25', TODAY)).toBe(false);
  });

  it('anteayer SÍ requiere auditoría', () => {
    expect(journeyRequiresAudit('2026-07-24', TODAY)).toBe(true);
  });

  it('un día de hace un año requiere auditoría', () => {
    expect(journeyRequiresAudit('2025-07-26', TODAY)).toBe(true);
  });

  it('cruza el borde de mes sin romperse', () => {
    expect(journeyRequiresAudit('2026-06-30', '2026-07-01')).toBe(false);
    expect(journeyRequiresAudit('2026-06-29', '2026-07-01')).toBe(true);
  });

  it('un día inválido se trata como que requiere auditoría (fail-closed)', () => {
    expect(journeyRequiresAudit('', TODAY)).toBe(true);
    expect(journeyRequiresAudit('no-es-fecha', TODAY)).toBe(true);
  });

  it('un día FUTURO no requiere auditoría — y por eso hace falta la otra guarda', () => {
    // daysBack negativo: el gate de permiso lo deja pasar. No es un bug de esta
    // función (el permiso no es lo que falla ahí), es la razón por la que existe
    // `isFutureDay`: sin ella el query salía y comía el 400 del BE.
    expect(journeyRequiresAudit('2026-07-27', TODAY)).toBe(false);
  });
});

/**
 * isFutureDay — espejo del `400 day no puede ser una fecha futura` del backend
 * (`technicianLocation.routes.ts`). Un 400 llega al FE como error genérico: "No
 * se pudo cargar la jornada" + un Reintentar que nunca va a funcionar. Se ataja
 * antes de salir.
 */
describe('isFutureDay', () => {
  it('hoy NO es futuro', () => {
    expect(isFutureDay(TODAY, TODAY)).toBe(false);
  });

  it('ayer NO es futuro', () => {
    expect(isFutureDay('2026-07-25', TODAY)).toBe(false);
  });

  it('mañana SÍ es futuro', () => {
    expect(isFutureDay('2026-07-27', TODAY)).toBe(true);
  });

  it('cruza el borde de mes y de año', () => {
    expect(isFutureDay('2026-08-01', '2026-07-31')).toBe(true);
    expect(isFutureDay('2027-01-01', '2026-12-31')).toBe(true);
    expect(isFutureDay('2026-12-31', '2027-01-01')).toBe(false);
  });

  it('un día inválido NO se marca como futuro: de ese caso se ocupa el fail-closed del permiso', () => {
    expect(isFutureDay('', TODAY)).toBe(false);
    expect(isFutureDay('no-es-fecha', TODAY)).toBe(false);
  });
});
