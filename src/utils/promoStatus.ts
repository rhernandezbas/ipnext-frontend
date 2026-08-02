import type { PromoAdminDto, PromoStatus } from '@/types/promos';

/**
 * promos-admin — deriva el estado visible de una promo. NO es un campo propio
 * del BE: se deriva de `publishedAt`/`archivedAt` y las fechas de vigencia
 * contra "ahora" (mismo criterio que pidió el proposal). Orden de prioridad:
 *
 *  1. `archivedAt` seteado → 'archived' (acción explícita del operador, pisa
 *     cualquier otra condición — una promo archivada NO vuelve a 'expired'
 *     por más que su `endsAt` haya pasado).
 *  2. `publishedAt` null → 'draft' (el cliente NUNCA la ve en la app).
 *  3. `endsAt` en el pasado → 'expired'.
 *  4. cualquier otro caso → 'published'.
 *
 * `now` es inyectable (default `new Date()`) para tests determinísticos —
 * evita el mismo bug de timezone/reloj real que el guard `no-browser-tz`
 * cubre para el resto del repo (acá no leemos partes locales, solo
 * comparamos instantes, así que no aplica ese guard — pero mantener `now`
 * inyectable es la misma disciplina de testabilidad).
 */
export function derivePromoStatus(promo: Pick<PromoAdminDto, 'publishedAt' | 'archivedAt' | 'endsAt'>, now: Date = new Date()): PromoStatus {
  if (promo.archivedAt) return 'archived';
  if (!promo.publishedAt) return 'draft';
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now.getTime()) return 'expired';
  return 'published';
}

export const PROMO_STATUS_LABELS: Record<PromoStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  expired: 'Vencida',
  archived: 'Archivada',
};
