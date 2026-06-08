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
}
