import axiosClient from './axios-client';
import type { VendedorMappingItem } from '@/types/grVendedorMapping';

/**
 * API layer for the agente↔vendedor (Gestión Real) mapping (Fase 2b).
 * Mirrors the IClass technician-teams api shape. GR is slated for deprecation:
 * keep this module self-contained so it can be removed without side effects.
 */
const BASE = '/admin/gr';

export const grVendedorMappingsApi = {
  /** GET /admin/gr/vendedor-mappings — users + their mapped GR vendedor (null if unmapped). */
  list: (): Promise<VendedorMappingItem[]> =>
    axiosClient
      .get<{ items: VendedorMappingItem[] }>(`${BASE}/vendedor-mappings`)
      .then(r => r.data.items),

  /** GET /admin/gr/vendedores — distinct GR vendedor names for the dropdown. */
  listVendedores: (): Promise<string[]> =>
    axiosClient
      .get<{ items: string[] }>(`${BASE}/vendedores`)
      .then(r => r.data.items),

  /** PATCH /admin/gr/vendedor-mappings/:userId — set (string) or clear (null). */
  setMapping: (
    userId: string,
    grVendedorName: string | null,
  ): Promise<VendedorMappingItem> =>
    axiosClient
      .patch<VendedorMappingItem>(`${BASE}/vendedor-mappings/${userId}`, { grVendedorName })
      .then(r => r.data),
};
