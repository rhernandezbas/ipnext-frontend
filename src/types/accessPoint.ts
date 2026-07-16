/**
 * contract-node-ap-auto-assign (Fase B) — catálogo de Access Points asignables a mano por el
 * picker manual del contrato. Espeja `AccessPointOptionDto` del BE
 * (`src/application/dto/accessPoint.dto.ts`): los AP retirados (`missingSince != null`) ya
 * vienen filtrados por `GET /api/access-points` — el FE nunca los ve en este catálogo.
 */
export interface AccessPointOption {
  id: string;
  name: string;
  /** N1 (review) — algunos AP del catálogo (equipos no-Ubiquiti, altas manuales) no traen MAC. */
  mac: string | null;
  /** Nodo (NetworkSite) al que pertenece el AP. null = AP sin nodo linkeado. */
  networkSiteId: string | null;
}
