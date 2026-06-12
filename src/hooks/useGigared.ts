import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gigaredApi } from '@/api/gigared.api';
import type {
  ListAccountsFilter,
  GigaredAccount,
  GigaredAccountStatus,
  UpdateGigaredConfigPayload,
  LinkCicPayload,
  RegisterAccountPayload,
  AddTvServicePayload,
  SetOttPayload,
  CancelTvPayload,
  CancelTvResult,
  ChangeTvPasswordPayload,
  ChangeTvPasswordResult,
} from '@/types/gigared';

/**
 * Gigared TV query/mutation hooks (#47).
 *
 * Query keys:
 *   ['gigared','config']               — config singleton
 *   ['gigared','summary']              — partner summary (also the "test connection" probe)
 *   ['gigared','accounts', filters]    — paginated server-side accounts list
 *   ['gigared','account', customerId]  — per-customer linked account
 *
 * Invalidations follow design.md: link/register touch account+summary+accounts;
 * add/removeService ALSO invalidate ['client-contracts', clientId] (the real key
 * of the customer ContractsTab, useCustomers.ts:65); setOtt touches the account.
 */

const ROOT = ['gigared'] as const;
export const CONFIG_KEY = [...ROOT, 'config'] as const;
export const SUMMARY_KEY = [...ROOT, 'summary'] as const;
const ACCOUNTS_ROOT = [...ROOT, 'accounts'] as const;
// #61 fix wave — the TV page (GigaredAccountsPage) reads the FULL list under
// ['gigared','all-accounts',status] via useGigaredAllAccounts, NOT under
// ACCOUNTS_ROOT. Any mutation that changes a row's internalId, status, services
// or OTT must invalidate THIS root too, or the page shows stale rows for up to
// the 5-min staleTime. Partial-prefix key → invalidates every status variant.
export const ALL_ACCOUNTS_ROOT = [...ROOT, 'all-accounts'] as const;
export const accountsKey = (filters: ListAccountsFilter) => [...ACCOUNTS_ROOT, filters] as const;
export const accountKey = (customerId: string) => [...ROOT, 'account', customerId] as const;
export const allAccountsKey = (status: GigaredAccountStatus) =>
  [...ALL_ACCOUNTS_ROOT, status] as const;

// The partner API caps pagination_limit at 20 (verified live 2026-06-11). To get
// the set for the contract picker / TV list we page through it. Cap the loop so a
// runaway partner can't hang the UI.
//
// #61 fix wave — HONEST CAP: MAX_PAGES * PAGE_LIMIT = 200 accounts. If a partner
// has MORE than 200 accounts of a given status, this returns ONLY the first 200
// and the client-side filter in GigaredAccountsPage therefore searches a SUBSET,
// not the whole catalogue. The page surfaces a subtle notice when the cap is hit
// (see GigaredAccountsPage's "first N accounts" banner). Raising the cap or moving
// to a server-side LIKE search is the real fix when account counts grow.
const PAGE_LIMIT = 20;
const MAX_PAGES = 10;
export const MAX_FETCHED_ACCOUNTS = PAGE_LIMIT * MAX_PAGES; // 200 — page reads this for the cap notice

// ── Config ────────────────────────────────────────────────────────────────

export function useGigaredConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: gigaredApi.getConfig,
  });
}

export function useUpdateGigaredConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateGigaredConfigPayload) => gigaredApi.updateConfig(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONFIG_KEY });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

// ── Read queries ───────────────────────────────────────────────────────────

export function useGigaredSummary(enabled = true) {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: gigaredApi.getSummary,
    enabled,
  });
}

export function useGigaredAccounts(filters: ListAccountsFilter) {
  return useQuery({
    queryKey: accountsKey(filters),
    queryFn: () => gigaredApi.listAccounts(filters),
  });
}

/**
 * Fetch ALL accounts for a given status by paging through the capped list
 * endpoint (#47e). Used by the contract picker so an operator can choose a CIC
 * from a list instead of typing it. Loops until a short page (< PAGE_LIMIT) or
 * MAX_PAGES, then flattens. Cached per status with a generous staleTime so
 * re-opening the panel does not re-hit the partner.
 */
export function useGigaredAllAccounts(status: GigaredAccountStatus, enabled = true) {
  return useQuery({
    queryKey: allAccountsKey(status),
    queryFn: async () => {
      const all: GigaredAccount[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const { accounts } = await gigaredApi.listAccounts({
          status,
          paginationLimit: PAGE_LIMIT,
          paginationOffset: page * PAGE_LIMIT,
        });
        all.push(...accounts);
        if (accounts.length < PAGE_LIMIT) break;
      }
      return all;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGigaredCustomerAccount(customerId: string, enabled = true) {
  return useQuery({
    queryKey: accountKey(customerId),
    queryFn: () => gigaredApi.getCustomerAccount(customerId),
    enabled: enabled && !!customerId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useLinkCic(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LinkCicPayload) => gigaredApi.linkCic(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
      // #47f — the link reconciles the local 'TV' ContractService onto the owner
      // contract, so the customer ContractsTab must refresh for the chip to show.
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
    },
  });
}

export function useRegisterAccount(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterAccountPayload) => gigaredApi.registerAccount(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
    },
  });
}

export function useAddTvService(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddTvServicePayload) => gigaredApi.addService(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
    },
  });
}

export function useRemoveTvService(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, contractId }: { serviceId: string; contractId: string }) =>
      gigaredApi.removeService(customerId, serviceId, contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
    },
  });
}

export function useSetOtt(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetOttPayload) => gigaredApi.setOtt(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
      // #61 fix wave — the TV list has an OTT column; toggling OTT must refresh it.
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
    },
  });
}

// #65 — cambiar la contraseña de la cuenta de TV. El BE PATCHea Gigared y persiste el
// nuevo valor en el slot TV del contrato → invalidamos ['client-contracts'] para que el
// panel muestre la clave actualizada. account/all-accounts no cambian (la clave no viaja ahí).
export function useChangeTvPassword(customerId: string) {
  const qc = useQueryClient();
  return useMutation<ChangeTvPasswordResult, unknown, ChangeTvPasswordPayload>({
    mutationFn: (body: ChangeTvPasswordPayload) => gigaredApi.changeTvPassword(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
    },
  });
}

// #47k — dar de baja TV. Removes all packs (frees the partner cupo), disables OTT
// and inactivates the local 'TV' item. On success refresh the account, the
// summary (cupo changed) and the customer ContractsTab (the TV chip drops).
// Returns { status, data } so the caller can branch on HTTP status (M2).
export function useCancelTv(customerId: string) {
  const qc = useQueryClient();
  return useMutation<{ status: number; data: CancelTvResult }, unknown, CancelTvPayload>({
    mutationFn: (body: CancelTvPayload) => gigaredApi.cancelTv(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
    },
  });
}
