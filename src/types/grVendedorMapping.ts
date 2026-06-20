/**
 * Wire shapes for the agente↔vendedor (Gestión Real) mapping endpoints
 * (Fase 2b, cartera "Mis clientes"). GR is slated for deprecation, so these
 * types live isolated from the core RBAC user types — deletable as a unit.
 *
 * Base path: /api/admin/gr
 */

/** Item of GET /admin/gr/vendedor-mappings (and PATCH response). */
export interface VendedorMappingItem {
  userId: string;
  userName: string;
  userLogin: string;
  grVendedorName: string | null;
}
