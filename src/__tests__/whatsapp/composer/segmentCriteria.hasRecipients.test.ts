/**
 * hasRecipients (manual-recipients-fe T2, CRIT-1) — el gate de "hay
 * destinatarios" del composer, que ahora combina el segmento por estado con la
 * lista manual: una lista manual no vacía cuenta como criterio aunque el
 * segmento esté vacío. `hasSegmentCriteria` (usado por `SegmentBuilder` para su
 * propio hint) NO se toca.
 */
import { describe, it, expect } from 'vitest';
import { hasRecipients, hasSegmentCriteria } from '@/pages/whatsapp/BulkMessagingPage/components/composer/segmentCriteria';
import type { CampaignSegment } from '@/types/messagingBulk';

const EMPTY: CampaignSegment = { statuses: [] };

describe('hasRecipients', () => {
  it('true con sólo lista manual (segmento vacío)', () => {
    expect(hasRecipients(EMPTY, ['a'])).toBe(true);
  });

  it('false con vacío total (segmento vacío + lista vacía)', () => {
    expect(hasRecipients(EMPTY, [])).toBe(false);
  });

  it('true con sólo segmento (lista manual vacía)', () => {
    expect(hasRecipients({ statuses: ['late'] }, [])).toBe(true);
  });

  it('true con ambos (segmento + lista manual)', () => {
    expect(hasRecipients({ statuses: ['late'] }, ['a'])).toBe(true);
  });

  it('un balance efectivo también cuenta como criterio', () => {
    expect(hasRecipients({ statuses: [], balanceMin: 100 }, [])).toBe(true);
  });
});

describe('hasRecipients — 3er parámetro CSV (bulk-csv-recipients CSV-FE-5)', () => {
  it('true con SÓLO CSV cargado (segmento vacío, sin manuales)', () => {
    expect(hasRecipients(EMPTY, [], true)).toBe(true);
  });

  it('false sin CSV (3er parámetro explícito false), igual que antes', () => {
    expect(hasRecipients(EMPTY, [], false)).toBe(false);
  });

  it('sin pasar el 3er parámetro, se comporta EXACTAMENTE igual que antes (backcompat)', () => {
    expect(hasRecipients(EMPTY, [])).toBe(false);
    expect(hasRecipients({ statuses: ['late'] }, [])).toBe(true);
  });

  it('true con las 3 fuentes combinadas', () => {
    expect(hasRecipients({ statuses: ['late'] }, ['a'], true)).toBe(true);
  });
});

describe('hasSegmentCriteria (intacto)', () => {
  it('sigue sin conocer la lista manual: segmento vacío → false', () => {
    expect(hasSegmentCriteria(EMPTY)).toBe(false);
  });

  it('segmento con estado → true', () => {
    expect(hasSegmentCriteria({ statuses: ['late'] })).toBe(true);
  });
});
