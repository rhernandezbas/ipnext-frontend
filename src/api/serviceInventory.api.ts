import axiosClient from './axios-client';
import type {
  ServiceInstalledItem,
  ClientInstalledItem,
  AddInstalledItemInput,
  AddInstalledItemResult,
  InventoryConflict,
  InventoryConflictCode,
  SameTypeCandidate,
  UpdateInstalledItemInput,
  TaskInventorySuggestion,
  InstalledItemType,
  ConfirmSuggestionResult,
  CreateManualSuggestionInput,
  InspectPppoeDevicesResult,
} from '@/types/serviceInventory';

const CONFLICT_CODES: readonly InventoryConflictCode[] = [
  'SAME_TYPE_NEEDS_DECISION',
  'ASSET_NOT_REVIVABLE',
];

/**
 * Typed dedup conflict thrown by {@link addInstalledItem} on a 409. Carries the
 * normalized {@link InventoryConflict} so callers can branch on `conflict.code`
 * (and read `conflict.candidates` for SAME_TYPE_NEEDS_DECISION) without reaching
 * into the raw axios error.
 */
export class InventoryConflictError extends Error {
  constructor(public readonly conflict: InventoryConflict) {
    super(conflict.message || conflict.code);
    this.name = 'InventoryConflictError';
  }
}

/** Read the 409 dedup conflict out of an unknown error, or null if it isn't one. */
function asInventoryConflict(err: unknown): InventoryConflict | null {
  const resp = (err as { response?: { status?: number; data?: unknown } })?.response;
  if (resp?.status !== 409) return null;
  const data = (resp.data ?? {}) as { error?: string; code?: string; candidates?: unknown };
  // BE sends the machine constant in `code`; tolerate it landing in `error` too.
  const raw = data.code ?? data.error;
  if (!raw || !CONFLICT_CODES.includes(raw as InventoryConflictCode)) return null;
  const code = raw as InventoryConflictCode;
  const message = typeof data.error === 'string' && data.error !== code ? data.error : '';
  const candidates = Array.isArray(data.candidates) ? (data.candidates as SameTypeCandidate[]) : [];
  return { code, message, candidates };
}

// ── Contract installed items ────────────────────────────────────────────────
export const listServiceInstalledItems = (contractId: string) =>
  axiosClient.get<ServiceInstalledItem[]>(`/contracts/${contractId}/inventory`).then(r => r.data);

// ── Client-wide installed items (aggregated across contracts) ────────────────
// BE wraps the array in `{ items: [...] }`; tolerate a bare array too.
export const listClientEquipment = (clientId: string) =>
  axiosClient
    .get<ClientInstalledItem[] | { items: ClientInstalledItem[] }>(`/clients/${clientId}/equipment`)
    .then(r => (Array.isArray(r.data) ? r.data : r.data.items ?? []));

/**
 * Add (or enrich) a device on a contract's inventory. Dedup-aware:
 *  - 201 → a NEW item was created            → `{ outcome: 'created', item }`
 *  - 200 → an EXISTING item was enriched      → `{ outcome: 'enriched', item }`
 *  - 409 → throws {@link InventoryConflictError} (SAME_TYPE_NEEDS_DECISION /
 *          ASSET_NOT_REVIVABLE). Any other error propagates unchanged.
 */
export const addInstalledItem = async (
  contractId: string,
  input: AddInstalledItemInput,
): Promise<AddInstalledItemResult> => {
  try {
    const res = await axiosClient.post<ServiceInstalledItem>(
      `/contracts/${contractId}/inventory`,
      input,
    );
    return { outcome: res.status === 200 ? 'enriched' : 'created', item: res.data };
  } catch (err) {
    const conflict = asInventoryConflict(err);
    if (conflict) throw new InventoryConflictError(conflict);
    throw err;
  }
};

export const updateInstalledItem = (contractId: string, itemId: string, patch: UpdateInstalledItemInput) =>
  axiosClient.patch<ServiceInstalledItem>(`/contracts/${contractId}/inventory/${itemId}`, patch).then(r => r.data);

export const deleteInstalledItem = (contractId: string, itemId: string) =>
  axiosClient.delete<ServiceInstalledItem>(`/contracts/${contractId}/inventory/${itemId}`).then(r => r.data);

// ── Task-scoped suggestion staging ──────────────────────────────────────────
export const listTaskInventorySuggestions = (taskId: string) =>
  axiosClient.get<TaskInventorySuggestion[]>(`/scheduling/${taskId}/inventory/suggestions`).then(r => r.data);

export const confirmInventorySuggestion = (
  taskId: string,
  suggestionId: string,
  typeOverride?: InstalledItemType,
  resolution?: 'add' | 'link_existing',
) =>
  axiosClient
    .post<ConfirmSuggestionResult>(
      `/scheduling/${taskId}/inventory/suggestions/${suggestionId}/confirm`,
      {
        ...(typeOverride ? { type: typeOverride } : {}),
        ...(resolution ? { resolution } : {}),
      },
    )
    .then(r => r.data);

export const replaceInventorySuggestion = (taskId: string, suggestionId: string, type?: InstalledItemType) =>
  axiosClient
    .post<ConfirmSuggestionResult>(
      `/scheduling/${taskId}/inventory/suggestions/${suggestionId}/replace`,
      type ? { type } : {},
    )
    .then(r => r.data);

export const discardInventorySuggestion = (taskId: string, suggestionId: string) =>
  axiosClient
    .post<TaskInventorySuggestion>(`/scheduling/${taskId}/inventory/suggestions/${suggestionId}/discard`)
    .then(r => r.data);

export const correctSuggestionType = (taskId: string, suggestionId: string, type: string) =>
  axiosClient
    .patch<ServiceInstalledItem>(
      `/scheduling/${taskId}/inventory/suggestions/${suggestionId}/type`,
      { type },
    )
    .then(r => r.data);

export const createManualSuggestion = (taskId: string, input: CreateManualSuggestionInput) =>
  axiosClient
    .post<TaskInventorySuggestion>(`/scheduling/${taskId}/inventory/suggestions`, input)
    .then(r => r.data);

// ── PPPoE live inspection ──────────────────────────────────────────────────
/** GET /contracts/:contractId/inspect-pppoe-devices — live SSH (~8s), best-effort */
export const inspectPppoeDevices = (contractId: string): Promise<InspectPppoeDevicesResult> =>
  axiosClient.get<InspectPppoeDevicesResult>(`/contracts/${contractId}/inspect-pppoe-devices`).then(r => r.data);
