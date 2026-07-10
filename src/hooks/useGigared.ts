import { useEffect } from 'react';
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
  CancelStatusResult,
  ChangeTvPasswordPayload,
  ChangeTvPasswordResult,
  ActivationHistoryFilter,
  TvActivationEvent,
  TransferTvPayload,
  TransferTvResult,
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
export const ACCOUNTS_ROOT = [...ROOT, 'accounts'] as const;
// #61 fix wave — the TV page (GigaredAccountsPage) reads the FULL list under
// ['gigared','all-accounts',status] via useGigaredAllAccounts, NOT under
// ACCOUNTS_ROOT. Any mutation that changes a row's internalId, status, services
// or OTT must invalidate THIS root too, or the page shows stale rows for up to
// the 5-min staleTime. Partial-prefix key → invalidates every status variant.
export const ALL_ACCOUNTS_ROOT = [...ROOT, 'all-accounts'] as const;
export const accountsKey = (filters: ListAccountsFilter) => [...ACCOUNTS_ROOT, filters] as const;
export const accountKey = (customerId: string) => [...ROOT, 'account', customerId] as const;
// #65 fix wave H3 — the guarded TV credentials live under their own key so the panel can fetch
// them lazily (only when the credentials section reveals them) and invalidate after a change.
export const credentialsKey = (customerId: string) => [...ROOT, 'tv-credentials', customerId] as const;
// #10 — async cancel status polling key
export const cancelStatusKey = (customerId: string) => [...ROOT, 'cancel-status', customerId] as const;
// #5 FE — TV activation history key
export const activationHistoryKey = (filter: ActivationHistoryFilter) =>
  [...ROOT, 'activation-history', filter] as const;
export const allAccountsKey = (status: GigaredAccountStatus) =>
  [...ALL_ACCOUNTS_ROOT, status] as const;

// #73 re-review — the flows that reconcile the local 'TV' ContractService
// (link/register add it, removeService/cancel inactivate it) change what the
// ServiceHistoryModal renders, so they invalidate the service-history root too.
const SERVICE_HISTORY_ROOT = ['contract-service-history'] as const;

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
  // Shared invalidation helper — used for both onSuccess and onError so the UI
  // reflects the real linked state even when the BE returns a spurious 5xx (#4).
  function invalidateLinkCicKeys() {
    qc.invalidateQueries({ queryKey: accountKey(customerId) });
    qc.invalidateQueries({ queryKey: SUMMARY_KEY });
    qc.invalidateQueries({ queryKey: ACCOUNTS_ROOT });
    qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
    // #47f — the link reconciles the local 'TV' ContractService onto the owner
    // contract, so the customer ContractsTab must refresh for the chip to show.
    qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
  }
  return useMutation({
    mutationFn: (body: LinkCicPayload) => gigaredApi.linkCic(customerId, body),
    onSuccess: () => {
      invalidateLinkCicKeys();
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
    },
    // #4 fix — the action may have succeeded on the partner side even when the BE
    // returns 500 (e.g. the CIC was already linked). Invalidate on error so the UI
    // re-reads the real state instead of keeping the stale pre-action cache.
    onError: () => {
      invalidateLinkCicKeys();
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
      // #65 fix wave L9 — register con contractId reconcilia el slot TV local (chip + credenciales),
      // así que el ContractsTab del cliente y las credenciales deben refrescarse.
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
      qc.invalidateQueries({ queryKey: credentialsKey(customerId) });
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
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
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
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
    // #1 fix — when the OTT toggle errors (e.g. partner already in target state),
    // the per-customer account cache is stale. Invalidate so the OTT chip re-reads
    // the real server state; the user no longer needs to log out/in to see reality.
    onError: () => {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
    },
  });
}

// #65 — cambiar la contraseña de la cuenta de TV. El BE resuelve la cuenta del cliente
// server-side (H1) y persiste el nuevo valor en el slot TV → invalidamos las credenciales
// dedicadas y ['client-contracts']. account/all-accounts no cambian (la clave no viaja ahí).
export function useChangeTvPassword(customerId: string) {
  const qc = useQueryClient();
  return useMutation<ChangeTvPasswordResult, unknown, ChangeTvPasswordPayload>({
    mutationFn: (body: ChangeTvPasswordPayload) => gigaredApi.changeTvPassword(customerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
      qc.invalidateQueries({ queryKey: credentialsKey(customerId) });
    },
  });
}

// #65 fix wave H3 — lazy read of the guarded TV credentials. `enabled` lets the panel fetch them
// only when the section needs them (on mount or when the operator reveals the password). The query
// never runs without a customerId.
export function useTvCredentials(customerId: string, enabled: boolean) {
  return useQuery({
    queryKey: credentialsKey(customerId),
    queryFn: () => gigaredApi.getTvCredentials(customerId),
    enabled: enabled && customerId !== '',
    staleTime: 60_000,
  });
}

/**
 * service-transfer W4 — transferir la TV del cliente ORIGEN a otro cliente.
 * Devuelve { status, data }: 207 = parcial (el modal muestra el detalle y ofrece
 * el retry del MISMO request — el BE es resumible/idempotente).
 *
 * Invalidación de AMBOS clientes en onSettled (no onSuccess): un 207 y hasta un
 * error duro pueden dejar estado parcialmente aplicado en partner/local, así que
 * SIEMPRE re-leemos cuenta TV + contratos + credenciales de origen y destino,
 * más summary/listas/historial (set de invalidateLinkCicKeys + destino).
 */
export function useTransferTv(sourceCustomerId: string) {
  const qc = useQueryClient();
  return useMutation<{ status: number; data: TransferTvResult }, unknown, TransferTvPayload>({
    mutationFn: (body) => gigaredApi.transferTv(sourceCustomerId, body),
    onSettled: (_data, _error, variables) => {
      const ids = [sourceCustomerId, variables?.targetCustomerId].filter(
        (id): id is string => !!id,
      );
      for (const id of ids) {
        qc.invalidateQueries({ queryKey: accountKey(id) });
        qc.invalidateQueries({ queryKey: ['client-contracts', id] });
        qc.invalidateQueries({ queryKey: credentialsKey(id) });
      }
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
    },
  });
}

// #10 — async dar de baja TV. POST → 202 {status:'pending'} (the BE queues the job).
// The cancel has NOT finished when this resolves — DO NOT invalidate contracts here.
// Invalidations fire only when the status poll (useCancelTvStatus) reaches 'done'.
// Returns { status, data } so the panel can detect 202 vs error shapes.
export function useCancelTv(customerId: string) {
  return useMutation<
    { status: number; data: { status: 'pending' } | CancelTvResult },
    unknown,
    CancelTvPayload
  >({
    mutationFn: (body: CancelTvPayload) => gigaredApi.cancelTv(customerId, body),
    // No onSuccess invalidations — the cancel is async; wait for the status poll.
  });
}

/**
 * #10 — poll GET /gigared/customers/:id/cancel/status.
 * Mirrors the useIClassClosure.ts pattern: refetchInterval returns 3000 ms while
 * the job is pending/running, and false once it reaches a terminal state (done/failed).
 * When status becomes 'done' the invalidations fire (contract chip, account, summary).
 */
export function useCancelTvStatus(customerId: string, enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery<CancelStatusResult>({
    queryKey: cancelStatusKey(customerId),
    queryFn: () => gigaredApi.getCancelStatus(customerId),
    enabled: enabled && !!customerId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === 'done' || s === 'failed') return false;
      return 3000;
    },
  });

  // #11 — fire contract/account/summary invalidations ONLY when status reaches 'done'.
  // This is when the local TV item reconcile has completed (or definitively failed on the BE).
  useEffect(() => {
    if (query.data?.status === 'done') {
      qc.invalidateQueries({ queryKey: accountKey(customerId) });
      qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_ROOT });
      qc.invalidateQueries({ queryKey: ['client-contracts', customerId] });
      qc.invalidateQueries({ queryKey: credentialsKey(customerId) });
      qc.invalidateQueries({ queryKey: SERVICE_HISTORY_ROOT });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data?.status]);

  return query;
}

// #5 FE — TV activation history. Fetches newest-first from the BE.
// Cached per filter shape (JSON-serializable) with a short staleTime (30s)
// because operators navigate to this page to audit recent actions.
export function useGigaredActivationHistory(filter: ActivationHistoryFilter) {
  return useQuery<TvActivationEvent[]>({
    queryKey: activationHistoryKey(filter),
    queryFn: () => gigaredApi.getActivationHistory(filter),
    staleTime: 30_000,
  });
}

// #5B — per-client TV activation history. Fetches events for a single customer
// using the scoped endpoint GET /gigared/customers/:id/activation-history.
// `enabled` is tied to the modal's open state so we don't fetch while closed.
export function useGigaredCustomerActivationHistory(customerId: string, enabled = true) {
  return useQuery<TvActivationEvent[]>({
    queryKey: [...ROOT, 'customer-activation-history', customerId] as const,
    queryFn: () => gigaredApi.getCustomerActivationHistory(customerId),
    staleTime: 30_000,
    enabled,
  });
}
