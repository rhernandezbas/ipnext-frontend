/**
 * hasSegmentCriteria — helper puro compartido entre `SegmentBuilder` (nota de
 * "elegí al menos un criterio") y `CampaignComposer` (gate de preview
 * automático + gate de "Crear campaña") — F2 apply chunk 2, FIX-1 (fix wave).
 *
 * FIX-1: alineado con el BE (`assertSegmentIsFiltered`), que exige
 * `statuses.length>0 || balanceMin>0 || balanceMax>0`. Un floor de 0 (o
 * negativo/NaN) NO filtra a nadie — el BE lo rechaza con 400 UNFILTERED_SEGMENT.
 * El FE ahora trata `<=0`/negativos/NaN como NO-criterio para no permitir un
 * preview inválido que termina en un dead-end sin explicación.
 *
 *  SC-1 sin statuses ni balances → false
 *  SC-2 con al menos un status → true
 *  SC-3 con balanceMin>0 → true
 *  SC-4 con balanceMax>0 → true
 *  SC-5 balanceMin=0 (floor $0, no filtra) → false  [FIX-1: antes daba true]
 *  SC-6 balanceMin/Max negativo o NaN → false        [FIX-1]
 */
import { describe, it, expect } from 'vitest';
import { hasSegmentCriteria } from '@/pages/whatsapp/BulkMessagingPage/components/composer/segmentCriteria';

describe('SC-1: sin criterio', () => {
  it('statuses vacío y sin balances → false', () => {
    expect(hasSegmentCriteria({ statuses: [] })).toBe(false);
  });
});

describe('SC-2: con status', () => {
  it('al menos un status → true', () => {
    expect(hasSegmentCriteria({ statuses: ['late'] })).toBe(true);
  });
});

describe('SC-3: con balanceMin > 0', () => {
  it('balanceMin=1000 → true', () => {
    expect(hasSegmentCriteria({ statuses: [], balanceMin: 1000 })).toBe(true);
  });

  it('balanceMin=0.01 (mínimo positivo) → true', () => {
    expect(hasSegmentCriteria({ statuses: [], balanceMin: 0.01 })).toBe(true);
  });
});

describe('SC-4: con balanceMax > 0', () => {
  it('balanceMax=5000 → true', () => {
    expect(hasSegmentCriteria({ statuses: [], balanceMax: 5000 })).toBe(true);
  });
});

describe('SC-5: floor $0 no filtra (FIX-1)', () => {
  it('balanceMin=0 → false (todos deben >= $0, no filtra a nadie)', () => {
    expect(hasSegmentCriteria({ statuses: [], balanceMin: 0 })).toBe(false);
  });

  it('balanceMax=0 → false', () => {
    expect(hasSegmentCriteria({ statuses: [], balanceMax: 0 })).toBe(false);
  });
});

describe('SC-6: valores no-positivos o inválidos (FIX-1)', () => {
  it('balanceMin negativo → false', () => {
    expect(hasSegmentCriteria({ statuses: [], balanceMin: -100 })).toBe(false);
  });

  it('balanceMin/Max NaN → false', () => {
    expect(hasSegmentCriteria({ statuses: [], balanceMin: Number.NaN, balanceMax: Number.NaN })).toBe(false);
  });

  it('un status presente rescata aunque el balance sea 0', () => {
    expect(hasSegmentCriteria({ statuses: ['blocked'], balanceMin: 0 })).toBe(true);
  });
});

describe('SC-7: filtro de red nodo/AP (node-segment-fe)', () => {
  // Alineado con el BE: nodo o AP SOLOS ya son un segmento válido (el BE ya
  // no exige estados/deuda si hay nodo/AP). AND con estados/deuda.
  it('networkSiteId solo → true (nodo solo ya filtra)', () => {
    expect(hasSegmentCriteria({ statuses: [], networkSiteId: 'site-1' })).toBe(true);
  });

  it('accessPointId solo → true (AP sin nodo es válido)', () => {
    expect(hasSegmentCriteria({ statuses: [], accessPointId: 'ap-1' })).toBe(true);
  });

  it('nodo + AP → true', () => {
    expect(hasSegmentCriteria({ statuses: [], networkSiteId: 'site-1', accessPointId: 'ap-1' })).toBe(true);
  });

  it('null explícito NO cuenta como criterio (null = limpiar, no filtrar)', () => {
    expect(hasSegmentCriteria({ statuses: [], networkSiteId: null, accessPointId: null })).toBe(false);
  });

  it('string vacío NO cuenta como criterio', () => {
    expect(hasSegmentCriteria({ statuses: [], networkSiteId: '' })).toBe(false);
  });
});
