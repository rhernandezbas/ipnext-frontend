/**
 * journeyRequiresAudit — espejo EXACTO del gate dinámico del backend.
 *
 * El BE sirve la jornada de hoy/ayer con `technicians.location_read` y cualquier
 * día anterior con `technicians.location_audit` (OPERATIONAL_JOURNEY_DAYS = 1).
 * Si el FE se desalinea, o pide y come un 403, o esconde algo que sí puede ver.
 */
import { describe, it, expect } from 'vitest';
import { journeyRequiresAudit } from '@/hooks/useTechnicianLocation';

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
});
