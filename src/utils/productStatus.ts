import type { StoreProductDto, StoreProductStatus } from '@/types/store';

/**
 * store-admin — deriva el estado visible de un producto. NO es un campo
 * propio del BE: se deriva de `active`/`archivedAt` (mismo criterio que
 * `derivePromoStatus`, ver `promoStatus.ts`). Orden de prioridad:
 *
 *  1. `archivedAt` seteado → 'archived' (acción explícita del operador, pisa
 *     `active` — un producto archivado NO "vuelve" a activo por más que
 *     `active` siga en `true` en el registro).
 *  2. `active === false` → 'draft'.
 *  3. cualquier otro caso → 'active'.
 */
export function deriveProductStatus(
  product: Pick<StoreProductDto, 'active' | 'archivedAt'>,
): StoreProductStatus {
  if (product.archivedAt) return 'archived';
  if (!product.active) return 'draft';
  return 'active';
}

export const PRODUCT_STATUS_LABELS: Record<StoreProductStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  archived: 'Archivado',
};
