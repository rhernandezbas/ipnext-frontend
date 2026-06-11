/** Live UISP info joined from the mirror (batch, no N+1). null = not linked to any UISP site. */
export interface NetworkSiteUispInfo {
  status: string;
  deviceCount: number;
  outageCount: number;
  lastSyncAt: string; // ISO string over the wire
  missingSince: string | null; // ISO string or null
}

export interface NetworkSite {
  id: string;
  name: string;
  address: string;
  city: string;
  coordinates: { lat: number; lng: number } | null;
  type: 'pop' | 'nodo' | 'datacenter' | 'tower' | 'other';
  status: 'active' | 'inactive' | 'maintenance';
  deviceCount: number;
  clientCount: number;
  uplink: string;
  parentSiteId: string | null;
  description: string;
  /** IClass mapping code — used by the IClass integration to identify this node. */
  iclassNodeCode: string | null;
  /**
   * Patch-only: the catalog node uuid to assign. Never returned by GET.
   * On PUT the BE resolves it to `iclassNodeCode` + `city`; `null` clears the link.
   */
  iclassNodeId?: string | null;
  /** Optional link to a UISP mirror site (uispId TEXT). null = not linked. */
  uispSiteId: string | null;
  /** UISP live info joined from mirror. Present when API returns enriched list. */
  uisp?: NetworkSiteUispInfo | null;
}
