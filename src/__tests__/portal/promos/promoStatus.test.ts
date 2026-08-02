/**
 * derivePromoStatus (promos-admin) — deriva Borrador/Publicada/Vencida/Archivada
 * de publishedAt/archivedAt/endsAt contra "ahora" (inyectable para tests
 * determinísticos).
 *
 *  PS-1 publishedAt null → 'draft'
 *  PS-2 publishedAt seteado + endsAt futuro → 'published'
 *  PS-3 publishedAt seteado + endsAt pasado → 'expired'
 *  PS-4 archivedAt seteado → 'archived', PISA cualquier otra condición
 *       (incluido un endsAt vencido — no cae a 'expired')
 */
import { describe, it, expect } from 'vitest';
import { derivePromoStatus } from '@/utils/promoStatus';

const NOW = new Date('2026-08-01T12:00:00.000Z');
const PAST = '2026-07-01T00:00:00.000Z';
const FUTURE = '2026-09-01T00:00:00.000Z';

describe('PS-1: sin publishedAt', () => {
  it('es draft aunque tenga vigencia futura', () => {
    expect(derivePromoStatus({ publishedAt: null, archivedAt: null, endsAt: FUTURE }, NOW)).toBe('draft');
  });
});

describe('PS-2: publicada dentro de vigencia', () => {
  it('es published', () => {
    expect(derivePromoStatus({ publishedAt: PAST, archivedAt: null, endsAt: FUTURE }, NOW)).toBe('published');
  });
});

describe('PS-3: publicada con vigencia vencida', () => {
  it('es expired', () => {
    expect(derivePromoStatus({ publishedAt: PAST, archivedAt: null, endsAt: PAST }, NOW)).toBe('expired');
  });
});

describe('PS-4: archivada pisa todo', () => {
  it('archivedAt seteado es archived aunque publishedAt esté seteado y endsAt esté vencido', () => {
    expect(derivePromoStatus({ publishedAt: PAST, archivedAt: PAST, endsAt: PAST }, NOW)).toBe('archived');
  });

  it('archivedAt seteado es archived incluso sin publishedAt (borrador archivado)', () => {
    expect(derivePromoStatus({ publishedAt: null, archivedAt: PAST, endsAt: FUTURE }, NOW)).toBe('archived');
  });
});
