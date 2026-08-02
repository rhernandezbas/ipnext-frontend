import axiosClient from './axios-client';
import type { StoreOrderDto, StoreProductDto } from '@/types/store';

const BASE = '/store';

/**
 * store-admin — payload de crear/editar un producto. `""` de campos
 * opcionales viaja como `null` (normalizado en `ProductFormModal`, mismo
 * criterio que `ticketAreaId` en `promos.api.ts`) — no hay zod real del BE
 * contra el cual verificar (worktree `store-be` sin diff contra `main` al
 * momento de construir esto), se sigue el contrato del proposal tal cual.
 */
export interface CreateStoreProductInput {
  title: string;
  summary: string;
  description: string;
  priceArs: number;
  maxInstallments: number;
  warrantyText: string;
  badge?: string | null;
  ticketAreaId?: string | null;
  sortOrder: number;
  /** Default `false` en el BE (borrador) — se manda explícito en creación. */
  active?: boolean;
}

/**
 * PATCH parcial. `archivedAt` viaja acá también — NO hay endpoint dedicado de
 * archive: archivar = `PATCH {archivedAt: <ISO>}`, desarchivar = `PATCH
 * {archivedAt: null}` (mismo contrato que promos/publish-archive).
 */
export type UpdateStoreProductInput = Partial<CreateStoreProductInput> & {
  archivedAt?: string | null;
};

export const storeApi = {
  listProducts: () => axiosClient.get<StoreProductDto[]>(`${BASE}/products`).then((r) => r.data),

  createProduct: (data: CreateStoreProductInput) =>
    axiosClient.post<StoreProductDto>(`${BASE}/products`, data).then((r) => r.data),

  updateProduct: (id: string, data: UpdateStoreProductInput) =>
    axiosClient.patch<StoreProductDto>(`${BASE}/products/${id}`, data).then((r) => r.data),

  /**
   * POST /store/products/:id/image — multipart, campo `file` (contrato del
   * proposal). Solo imagen, hasta 8MB — validado local ANTES (ver
   * `validateStoreProductImage`) Y por el BE.
   */
  uploadProductImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return axiosClient
      .post<StoreProductDto>(`${BASE}/products/${id}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  deleteProductImage: (id: string) =>
    axiosClient.delete<StoreProductDto>(`${BASE}/products/${id}/image`).then((r) => r.data),

  listOrders: () => axiosClient.get<StoreOrderDto[]>(`${BASE}/orders`).then((r) => r.data),
};
