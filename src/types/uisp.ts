/**
 * UISP mirror types — mirrors the BE wire contracts exactly.
 * Source of truth: openspec/changes/uisp-integration/design.md
 */

/** Row returned by GET /api/uisp/sites */
export interface UispSiteRow {
  uispId: string;
  name: string;
  status: string;
  deviceCount: number;
  outageCount: number;
  lastSyncAt: string | null;
  missingSince: string | null;
}

/** Linked NetworkSite returned inside UispSiteDetail (reverse lookup). null = not linked. */
export interface LinkedNetworkSite {
  id: string;
  name: string;
}

/** Full site detail returned inside GET /api/uisp/sites/:uispId */
export interface UispSiteDetail {
  uispId: string;
  name: string;
  status: string;
  parentUispId: string | null;
  latitude: number | null;
  longitude: number | null;
  contact: string | null;
  deviceCount: number;
  outageCount: number;
  lastSyncAt: string | null;
  missingSince: string | null;
  /**
   * NEW CONTRACT FIELD — LOUDLY DECLARED:
   * The NetworkSite linked to this UISP site (reverse lookup by uispSiteId = uispId).
   * null when no NetworkSite has been linked.
   * Populated by BE GetUispSiteDetail via NetworkSiteRepository.findByUispSiteId().
   */
  linkedNetworkSite: LinkedNetworkSite | null;
}

/** Device row returned inside GET /api/uisp/sites/:uispId */
export interface UispDeviceRow {
  uispId: string;
  name: string;
  model: string;
  modelName: string | null;
  type: string | null;
  role: string | null;
  status: string;
  /** Signal in dBm — negative integer or null */
  signal: number | null;
  /** Uptime as a string representation of BigInt seconds, or null when offline */
  uptime: string | null;
  ip: string | null;
  mac: string | null;
  firmware: string | null;
  lastSeenAt: string | null;
  missingSince: string | null;
}

/** Response shape for GET /api/uisp/sync/status */
export interface UispSyncStatus {
  lastRunAt: string | null;
  lastResult: string | null;
  itemsSynced: number;
  /** Sites count from last successful sync (null when never run or last run failed). */
  sites: number | null;
  /** Devices count from last successful sync (null when never run or last run failed). */
  devices: number | null;
  /** Missing items count from last successful sync (null when never run or last run failed). */
  missing: number | null;
  /** Duration of last successful sync in ms (null when never run, failed, or old row). */
  durationMs: number | null;
  /** true when UISP_BASE_URL + UISP_TOKEN are configured in the environment */
  configured: boolean;
  /** true when the uisp-sync feature flag is ON */
  enabled: boolean;
  /**
   * FIX-2b: Error message from the last failed sync run, null when succeeded or never run.
   * BE emits this when lastResult starts with 'error: '.
   */
  lastError: string | null;
}
