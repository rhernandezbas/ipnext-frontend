export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'new' | 'baja';

/** A service line attached to a contract (#43). */
export interface ContractService {
  id: string;
  serviceCatalogId: string;
  name: string;
  label: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  createdAt: string;
  // #65 fix wave H3 (SEGURIDAD): las credenciales de TV YA NO viajan en la lista de contratos.
  // La sección "Credenciales Gigared Play" las consume por GET /gigared/customers/:id/tv-credentials.
}

/** A single state-change event in a service's lifecycle (service-history-ledger). */
export interface ServiceEvent {
  id: string;
  /** 'activated' | 'deactivated' | 'reactivated' — maps to Alta / Baja / Reactivación.
   *  'reduced' | 'blocked' | 'restored' — corte individual PPPoE (pppoe-corte-individual).
   *  'modified' — cambio de plan PPPoE (pppoe-plan-change-history). */
  eventType: 'activated' | 'deactivated' | 'reactivated' | 'reduced' | 'blocked' | 'restored' | 'modified';
  /** ISO timestamp of when the event occurred. */
  occurredAt: string;
  /** Display name of the operator who triggered the event. */
  actorName: string;
  /** CIC identifier — only non-null for TV-related events. */
  cic: string | null;
  /**
   * #127 — operator-supplied reason for the state change (required on new events).
   * Null for legacy events (pre-#127) that were created without a reason.
   */
  reason?: string | null;
  /**
   * reason-modal-event-aware — change detail stored by the BE (e.g. old→new plan for
   * 'modified' events: "IP-Air-40-40 → IP-Air-30-10"). Null for all other event types.
   * Optional to avoid breaking existing fixtures that were created before this field was added.
   */
  notes?: string | null;
}

/** One entry in a contract's service history (#73). Includes inactive services. */
export interface ServiceHistoryEntry {
  id: string;
  contractId: string;
  serviceCatalogId: string;
  name: string;
  label: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  tvLogin: string | null;
  createdAt: string;
  deactivatedAt: string | null;
  /**
   * Ordered chronological sequence of state-change events for this service.
   * The BE always sends this array (empty for legacy/pre-ledger services).
   * The UI still guards with Array.isArray() for robustness against stale cache.
   */
  events: ServiceEvent[];
}

/** An entry in the service catalog ABM (#43). */
export interface ServiceCatalogEntry {
  id: string;
  name: string;
  label: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  /** UUID string from Prisma — used verbatim as a path param, no coercion. */
  id: string;
  /** #55 — external Gestión Real contract code (grContratoId). Shown as a mono badge;
   * it is the identity sent to IClass for this contract's tasks. null for non-GR contracts. */
  code?: string | null;
  /** Operator-editable display name; falls back to `plan` when null. */
  name?: string | null;
  type: string;
  plan: string;
  status: CustomerStatus;
  price: number;
  startDate: string;
  endDate: string | null;
  /** Installation IP from GR (#43 drift fix — replaces the old `ipAddress`). */
  ip?: string | null;
  description: string;
  /** Installation address from GR (available after task-service-location change). */
  address?: string | null;
  /** Latitude from GR. Null when GR does not have it. */
  lat?: number | null;
  /** Longitude from GR. Null when GR does not have it. */
  lng?: number | null;
  /** Technology from the ServiceTechnology catalog (e.g. FTTH, HFC). */
  technology?: string | null;
  /** Service lines attached to the contract, eager-loaded with the list (#43). */
  services: ContractService[];
  /**
   * client-geolocation — Prominense-owned GPS coordinates for this contract's
   * installation point. Distinct from the GR lat/lng which are read-only.
   */
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsPlusCode?: string | null;
}

export interface LogEntry {
  id: number;
  date: string;
  type: string;
  message: string;
  adminId: number | null;
  adminName: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  category: string;
  tariffPlan: string | null;
  createdAt: string;
  updatedAt: string;
  contracts: Contract[];
  logs: LogEntry[];
  // Optional fields surfaced by the Postgres adapter (Splynx Customer module)
  city?: string;
  country?: string;
  login?: string;
  splynxId?: string | null;
  grClienteId?: string | null;
  customAttributes?: Record<string, unknown> | null;
  /** Gestión Real balance sync fields (gr-client-balance-sync change). */
  balanceDue?: number | null;
  balanceOverdue?: number | null;
  invoicesQty?: number | null;
  lastBalanceAt?: string | null;
  /**
   * client-geolocation — Prominense-owned GPS coordinates, editable by
   * operators via the "Ubicación" tab. Distinct from any GR address.
   */
  lat?: number | null;
  lng?: number | null;
  plusCode?: string | null;
}

export interface CustomerSummary {
  id: number;
  /** Gestión Real client id — shown as the business id when present. */
  grClienteId?: string | null;
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  category: string;
  tariffPlan: string | null;
  login: string | null;
  ipRanges: string | null;
  accessDevices: number;
  createdAt: string;
}

export interface CreateCustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateCustomerData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** client-geolocation: GPS fields managed by Prominense operators. */
  lat?: number | null;
  lng?: number | null;
  plusCode?: string | null;
}
