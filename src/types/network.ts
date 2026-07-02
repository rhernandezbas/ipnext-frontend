export interface IpNetwork {
  id: string;
  network: string;
  gateway: string;
  dns1: string;
  dns2: string;
  description: string;
  partnerId: string | null;
  type: 'static' | 'dhcp' | 'pppoe';
  totalIps: number;
  // null = no disponible: el RADIUS/router no respondió tras reintentos.
  // NO es 0 — una red sin dato no es una red vacía.
  usedIps: number | null;
  freeIps: number | null;
}

export interface IpPool {
  id: string;
  name: string;
  networkId: string;
  rangeStart: string;
  rangeEnd: string;
  type: 'static' | 'dynamic';
  // null = no disponible: el RADIUS/router no respondió tras reintentos.
  // NO es 0 — un pool sin dato no es un pool vacío.
  assignedCount: number | null;
  totalCount: number;
  nasId: string | null;
  // null = sin clasificar; 'cgnat' = CGNAT; 'public' = IP pública.
  ipKind: 'cgnat' | 'public' | null;
}

export interface IpAssignment {
  id: string;
  ip: string;
  username: string;
  contractId: string;
  profile: string | null;
  nasId: string;
  status: string;
  createdAt: string;
}

export interface Ipv6Network {
  id: string;
  network: string;
  description: string;
  delegationPrefix: number;
  type: 'static' | 'dhcpv6' | 'slaac';
  usedPrefixes: number;
  totalPrefixes: number;
  status: 'active' | 'inactive';
}

export interface PaginatedAssignments {
  data: IpAssignment[];
  total: number;
  page: number;
  pageSize: number;
}
