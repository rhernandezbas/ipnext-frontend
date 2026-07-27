/**
 * journeyRequiresAudit — espejo EXACTO del gate dinámico del backend.
 *
 * El BE sirve la jornada de hoy/ayer con `technicians.location_read` y cualquier
 * día anterior con `technicians.location_audit` (OPERATIONAL_JOURNEY_DAYS = 1).
 * Si el FE se desalinea, o pide y come un 403, o esconde algo que sí puede ver.
 */
import { describe, it, expect } from 'vitest';
import {
  isBeyondJourneyRetention,
  isFutureDay,
  journeyRequiresAudit,
} from '@/hooks/useTechnicianLocation';

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

/**
 * isBeyondJourneyRetention — espejo del BORRADO DURO del backend.
 *
 * `IngestTeamLocations` corre `repo.purgeOlderThan(now - 12 meses)` en CADA ingest y
 * `PrismaTeamLocationRepository.purgeOlderThan` es un `deleteMany`, no un flag. Más
 * atrás de esa ventana `findByTeamOnDay` devuelve `[]` y el BE contesta 200 con
 * `pointCount: 0` — indistinguible de "la cuadrilla no registró nada ese día".
 *
 * Sin este espejo el panel le ofrece al auditor causas sobre la CONDUCTA del técnico
 * ("la app pudo estar cerrada") para un hueco que produjo la política de retención.
 *
 * Dos decisiones deliberadas:
 *
 *  · **Fail-OPEN** (día que no parsea → `false`). Afirmar "el dato se borró" sobre un
 *    día que no se pudo ubicar en el calendario sería inventar una causa: exactamente
 *    el defecto que esto viene a matar. Mismo criterio que `isFutureDay`.
 *  · **El día del corte NO cuenta como purgado.** El cutoff del BE lleva hora, así que
 *    ese día está purgado A MEDIAS. Marcarlo entero como borrado afirmaría de más.
 */
describe('isBeyondJourneyRetention', () => {
  it('hoy y ayer están dentro del horizonte', () => {
    expect(isBeyondJourneyRetention(TODAY, TODAY)).toBe(false);
    expect(isBeyondJourneyRetention('2026-07-25', TODAY)).toBe(false);
  });

  it('el día del corte NO se da por purgado (el cutoff del BE lleva hora)', () => {
    expect(isBeyondJourneyRetention('2025-07-26', TODAY)).toBe(false);
  });

  it('el día anterior al corte SÍ está fuera del horizonte', () => {
    expect(isBeyondJourneyRetention('2025-07-25', TODAY)).toBe(true);
  });

  it('un día de hace tres años está fuera del horizonte', () => {
    expect(isBeyondJourneyRetention('2023-01-15', TODAY)).toBe(true);
  });

  /**
   * El hallazgo 4.4 del BE, del lado del FE: restar 12 meses con `setUTCMonth` sobre
   * un 29 de febrero da "29 de febrero" de un año NO bisiesto, que JS normaliza al 1
   * de marzo — un corte en el FUTURO del pretendido. Con ese corte corrido el panel
   * declararía "ya se borró" un día que el BE todavía tiene y sirve.
   */
  it('no desborda desde un 29 de febrero: el corte se acota al último día real del mes', () => {
    expect(isBeyondJourneyRetention('2027-02-28', '2028-02-29')).toBe(false);
    expect(isBeyondJourneyRetention('2027-02-27', '2028-02-29')).toBe(true);
  });

  it('un día inválido NO se marca como purgado (fail-open: no se inventa una causa)', () => {
    expect(isBeyondJourneyRetention('', TODAY)).toBe(false);
    expect(isBeyondJourneyRetention('no-es-fecha', TODAY)).toBe(false);
    expect(isBeyondJourneyRetention(TODAY, 'no-es-fecha')).toBe(false);
  });

  it('un día futuro no está "fuera del horizonte": de ese caso se ocupa isFutureDay', () => {
    expect(isBeyondJourneyRetention('2099-01-01', TODAY)).toBe(false);
  });
});
