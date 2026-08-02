import axiosClient from './axios-client';
import type { CampaignSegment } from '@/types/messagingBulk';
import type { PromoAdminDto } from '@/types/promos';

const BASE = '/promos';

/**
 * promos-admin — payload de crear/editar una promo. `imageStorageKey`
 * DELIBERADAMENTE ausente: el BE lo rechaza a propósito en create/update (no
 * hay endpoint de upload ni de servido todavía) — mandarlo produciría una
 * imagen ROTA en la app del cliente. NO agregar este campo sin la rebanada
 * completa (upload + storage + endpoint de servido).
 */
export interface CreatePromoInput {
  title: string;
  summary: string;
  body: string;
  ctaLabel: string;
  ticketAreaId?: string | null;
  segment: CampaignSegment;
  startsAt: string;
  endsAt: string;
}

/**
 * PATCH parcial. `publishedAt`/`archivedAt` viajan acá también — NO hay
 * endpoints dedicados de publish/archive: publicar = `PATCH {publishedAt:
 * <ISO>}`, archivar = `PATCH {archivedAt: <ISO>}`, desarchivar = `PATCH
 * {archivedAt: null}` (contrato verificado, ver proposal).
 */
export type UpdatePromoInput = Partial<CreatePromoInput> & {
  publishedAt?: string | null;
  archivedAt?: string | null;
};

export interface AudiencePreviewOutput {
  segmentCount: number;
  withAppCount: number;
}

export const promosApi = {
  list: () => axiosClient.get<PromoAdminDto[]>(BASE).then((r) => r.data),
  getById: (id: string) => axiosClient.get<PromoAdminDto>(`${BASE}/${id}`).then((r) => r.data),
  create: (data: CreatePromoInput) => axiosClient.post<PromoAdminDto>(BASE, data).then((r) => r.data),
  update: (id: string, data: UpdatePromoInput) =>
    axiosClient.patch<PromoAdminDto>(`${BASE}/${id}`, data).then((r) => r.data),
  audiencePreview: (segment: CampaignSegment) =>
    axiosClient.post<AudiencePreviewOutput>(`${BASE}/audience-preview`, { segment }).then((r) => r.data),
};
