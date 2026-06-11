/**
 * Gigared TV wire types (#47). Mirror the FROZEN wire contract VERBATIM —
 * the BE builds against the same shapes. snake_case lives ONLY in query params;
 * payloads are camelCase.
 */

// ── Config ────────────────────────────────────────────────────────────────
export interface GigaredConfig {
  configured: boolean;
  apiKeyLast4: string | null;
  baseUrl: string;
  enabled: boolean;
  updatedAt: string | null;
}

/** PUT /config body — apiKey omitted = no change, '' = clear key. */
export interface UpdateGigaredConfigPayload {
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

// ── Account ───────────────────────────────────────────────────────────────
export interface GigaredService {
  id: string;
  name: string;
}

export interface GigaredOtt {
  id: string;
  stationaryLicenses: number;
  mobileLicenses: number;
  registeredDevices: number;
  status: string | null;
}

export interface GigaredAccount {
  cic: string;
  gigaredId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  registrationDate: string | null;
  services: GigaredService[];
  internalId: string | null;
  ott: GigaredOtt | null;
}

// ── Summary ───────────────────────────────────────────────────────────────
export interface GigaredPartnerService extends GigaredService {
  qtyAvailable: number;
  qtyUsed: number;
  qtyPurchased: number;
}

export interface GigaredSummary {
  accounts: { registered: number; unregistered: number; total: number };
  services: GigaredPartnerService[];
}

// ── Accounts list ──────────────────────────────────────────────────────────
export type GigaredAccountStatus = 'registered' | 'unregistered';

export interface ListAccountsFilter {
  email?: string;
  status?: GigaredAccountStatus;
  accountId?: string;
  paginationLimit?: number;
  paginationOffset?: number;
}

export interface ListAccountsResult {
  accounts: GigaredAccount[];
}

// ── Customer account ──────────────────────────────────────────────────────
export interface CustomerAccountResult {
  linked: boolean;
  account: GigaredAccount | null;
}

// ── Mutations ──────────────────────────────────────────────────────────────
export interface LinkCicPayload {
  cic: string;
}

export interface RegisterAccountPayload {
  firstName: string;
  lastName: string;
  email: string;
  cic: string;
}

export interface AddTvServicePayload {
  serviceId: string;
  contractId: string;
}

export interface AddTvServiceResult {
  gigared: 'ok';
  local: 'ok' | 'failed';
  contractServiceId?: string;
  localError?: string;
}

export interface RemoveTvServiceResult {
  gigared: 'ok';
  local: 'ok' | 'failed';
  localError?: string;
}

export interface SetOttPayload {
  enabled: boolean;
}
