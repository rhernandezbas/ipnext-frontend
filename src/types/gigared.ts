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
  /**
   * #47j Fix 1 — FROZEN wire contract: the BE normalizes the partner's OTT state
   * to one of these three. The old value was Gigared's Spanish 'activo', so the
   * FE's `=== 'active'` never matched; now it reads 'enabled'.
   */
  status: 'enabled' | 'disabled' | null;
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
  /**
   * #47f — the contract that OWNS the local TV reconcile. The BE links the CIC
   * and reconciles the local 'TV' ContractService onto THIS contract. First
   * activation defines the owner; optional so link-only callers still work.
   */
  contractId?: string;
}

/**
 * #47f — link response. The BE links the CIC (always) and MAY reconcile the
 * local 'TV' item onto `contractId`. `local` mirrors the add/remove pattern:
 * 'synced' = the local item was created, 'failed' = link OK but the local
 * reconcile failed (HTTP 207 → amber + retry; the retry re-posts, idempotent).
 * Absent when no `contractId` was sent (pure link, nothing to reconcile).
 */
export interface LinkCicResult {
  account: GigaredAccount;
  local?: 'synced' | 'failed';
  localError?: string;
}

export interface RegisterAccountPayload {
  firstName: string;
  lastName: string;
  email: string;
  cic: string;
  /**
   * #47h — optional account password. When present it MUST match
   * `^[a-z0-9]{8,64}$` (lowercase letters + digits, 8–64 chars). Omitted entirely
   * when the operator leaves the field empty: the BE then generates a valid one
   * and sends the activation email so the customer sets it themselves.
   */
  password?: string;
  /**
   * Gigared form 1:1 — whether the customer gets an activation email to set their
   * own password. The BE defaults to true; the FE sends it ALWAYS explicit
   * (true/false) so the operator's intent is never ambiguous.
   */
  sendActivationEmail?: boolean;
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

// ── #47k — cancel TV (dar de baja) ──────────────────────────────────────────
export interface CancelTvPayload {
  /** The contract that owns the TV item — the BE inactivates ITS local 'TV' line. */
  contractId: string;
}

/**
 * #47k — cancel response (FROZEN wire contract). The BE removes ALL packs (frees
 * the partner cupo), disables OTT and inactivates the local 'TV' item. 200 = all
 * OK; 207 = partial. `removed` lists the pack ids that came off; `failed` carries
 * the ones that did not, each with a partner `detail`. `ottDisabled` / `local`
 * report the OTT and local-item steps. The cancel is idempotent: a re-POST only
 * processes whatever is still pending, so the "Reintentar baja" retry is safe.
 */
export interface CancelTvResult {
  removed: string[];
  failed: { id: string; detail: string }[];
  ottDisabled: boolean;
  local: 'synced' | 'failed';
}
