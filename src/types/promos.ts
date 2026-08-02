/**
 * promos-admin — espejo del contrato de `/api/promos` (BE en PROD, verificado
 * con curl contra prod, ver proposal). El `segment` REUSA `CampaignSegment`
 * (mismo dominio "estados + deuda + nodo/AP" que Bulk Messaging) — un solo
 * shape, un solo builder (`SegmentBuilder`), sin desincronización entre los
 * dos constructores de segmento del ecosistema.
 *
 * `PromoSegmentDto` es el shape que el BE devuelve en el GET (balance/nodo/AP
 * en `null` cuando no hay filtro, NO `undefined` — a diferencia de
 * `CampaignSegment`, que los omite/marca `undefined`). Los adapters de
 * `PromoFormModal` convierten `null → undefined` al precargar el
 * `SegmentBuilder` (mismo criterio nullish-coalescing que ya usa
 * `SegmentBuilder` internamente para sus inputs de deuda).
 */
export interface PromoSegmentDto {
  statuses: string[];
  balanceMin: number | null;
  balanceMax: number | null;
  networkSiteId: string | null;
  accessPointId: string | null;
}

export interface PromoAdminDto {
  id: string;
  title: string;
  summary: string;
  body: string;
  /**
   * READ-ONLY, siempre `null` — el BE NO tiene endpoint para subir ni servir
   * la imagen; setearla produciría una imagen ROTA en la app del cliente. NO
   * agregar un campo de imagen al form sin la rebanada completa (upload +
   * storage + endpoint de servido) — ver el mismo comentario en
   * `promos.api.ts` (`CreatePromoInput`/`UpdatePromoInput`).
   */
  imageStorageKey: string | null;
  ctaLabel: string;
  ticketAreaId: string | null;
  segment: PromoSegmentDto;
  startsAt: string;
  endsAt: string;
  /** `null` = borrador (el cliente NO la ve en la app). Con fecha = publicada. */
  publishedAt: string | null;
  archivedAt: string | null;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Los 4 estados derivados que ve el operador — NO existen como campo propio del BE, se derivan de publishedAt/archivedAt/fechas. Ver `src/utils/promoStatus.ts`. */
export type PromoStatus = 'draft' | 'published' | 'expired' | 'archived';
