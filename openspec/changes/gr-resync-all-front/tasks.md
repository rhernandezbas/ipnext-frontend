# Tasks — gr-resync-all-front

STRICT TDD is active (`strict_tdd: true`). Every code task is RED → GREEN →
REFACTOR: write the failing test first, run `npx vitest run`, confirm it fails
for the right reason, then write the minimal implementation to pass, then
refactor. Do NOT write implementation before its test. Verify with
`npx vitest run` and `npm run typecheck`. Do NOT run `npm run build`.

Paths are absolute-from-repo-root within the worktree
`C:\Users\ronald\projects\ipnext\ipnext-frontend.resyncbtn`.

---

## Phase 1 — api: `resyncAll` (data layer first)

- [ ] **1.1 (RED)** Create `src/__tests__/api/gestionRealSync.api.test.ts`.
  Mock `./axios-client` (or `@/api/axios-client`); assert `resyncAll()` issues
  `POST /gestion-real/sync/resync-all` and resolves with `response.data`.
  Run `npx vitest run src/__tests__/api/gestionRealSync.api.test.ts` → fails
  (no export).
- [ ] **1.2 (GREEN)** In `src/api/gestionRealSync.api.ts` add
  `export async function resyncAll(): Promise<{...}>` doing
  `axiosClient.post(\`${BASE}/resync-all\`)` and returning `r.data`. Keep `BASE`.
  Re-run → passes.
- [ ] **1.3 (REFACTOR)** Confirm return type matches backend (a small
  `ResyncAllResult` type or `void`-ish; keep minimal). `npm run typecheck`.

## Phase 2 — hook: `useResyncAll`

- [ ] **2.1 (RED)** In `src/__tests__/hooks/useGestionRealSyncConfig.test.ts`
  add a `describe('useResyncAll')`: mock `@/api/gestionRealSync.api` to include
  `resyncAll: vi.fn()`; spy `invalidateQueries`; assert that on success it is
  called with `['gestion-real-sync-status']`, `['gestionRealSync','config']`,
  and `['client-stats']`. Run → fails (no export).
- [ ] **2.2 (GREEN)** In `src/hooks/useGestionRealSyncConfig.ts` add
  `useResyncAll()`: `useMutation({ mutationFn: () => resyncAll(), onSuccess: () =>
  { qc.invalidateQueries(STATUS_KEY); qc.invalidateQueries(CONFIG_KEY);
  qc.invalidateQueries({ queryKey: ['client-stats'] }); } })`. Import `resyncAll`.
  Re-run → passes.
- [ ] **2.3 (REFACTOR)** Extract a `STATS_KEY = ['client-stats'] as const`
  comment noting it is owned by `useClientStats`. `npm run typecheck`.

## Phase 3 — body: Mantenimiento (Re-sincronizar todo button)

> All body tests live in
> `src/__tests__/pages/customers/settings/GestionRealSyncBody.resync.test.tsx`.
> Mock EVERY hook the body consumes. GR config/flag/status hook mocks MUST use
> **stable `vi.hoisted` refs** (ConfigSection `useEffect([config])` loops on
> fresh object identities). Add mocks for `@/context/ConfirmContext`
> (`useConfirm`), `@/hooks/useGestionRealSyncConfig` (incl. `useResyncAll`), and
> `@/hooks/useCustomers` (`useClientStats`).

- [ ] **3.1 (RED)** Test: "Mantenimiento" section renders a "Re-sincronizar todo"
  button, enabled when not pending. Fails (no section).
- [ ] **3.2 (GREEN)** Add `MaintenanceSection` to `GestionRealSyncBody.tsx`
  (title "Mantenimiento", `.btnDanger` button "Re-sincronizar todo"); render it
  in `GestionRealSyncBody` after `ConfigSection`. Add `.btnDanger` to the CSS
  module (mirror `.btnPrimary`, danger background). Passes.
- [ ] **3.3 (RED)** Test: stub `useConfirm`→`true`; clicking the button calls
  `useConfirm` with a `tone:'danger'` message AND calls the `useResyncAll`
  `mutate` spy exactly once (use `await`/`findBy` since confirm is async). Fails.
- [ ] **3.4 (GREEN)** Wire `handleResync`: `await confirm({title, message, tone:
  'danger', confirmLabel})` → on `true` `resync.mutate()`. Passes.
- [ ] **3.5 (RED)** Test: stub `useConfirm`→`false`; clicking the button does NOT
  call `mutate`. Fails if logic wrong.
- [ ] **3.6 (GREEN)** Guard the `if (ok)` branch. Passes.
- [ ] **3.7 (RED)** Test: `useResyncAll` `isPending:true` → button disabled and
  shows "Re-sincronizando…". Fails.
- [ ] **3.8 (GREEN)** Disable on `isPending`; swap label. Passes.
- [ ] **3.9 (RED)** Tests: `isSuccess:true` → success banner
  ("Re-sincronización iniciada."); `isError` with `response.status:403` → "No
  tenés permiso…" banner; `isError` other → generic retry banner. Fails.
- [ ] **3.10 (GREEN)** Add `mapResyncError(err)` (mirror `mapSaveError`) + the
  success banner, reusing `.banner`/`.bannerSuccess`/`.bannerError`. Passes.
- [ ] **3.11 (REFACTOR)** De-dup banner/error helpers; ensure no
  `useEffect`-loop on the new section. `npm run typecheck`.

## Phase 4 — body: Distribución por estado (breakdown)

- [ ] **4.1 (RED)** Test: stub `useClientStats` →
  `{total:1500,active:1000,late:200,inactive:150,blocked:100,baja:50}`; assert a
  "Distribución por estado" section shows Total 1.500, Activos 1.000, Deudor 200,
  Inactivo 150, Incobrable 100, Bajas 50 (es-AR formatting). Fails.
- [ ] **4.2 (GREEN)** Add `EstadoBreakdownSection` to `GestionRealSyncBody.tsx`
  consuming `useClientStats`; render a `.countersGrid` of the six
  `{key,label}` buckets with `toLocaleString('es-AR')`; mount it between
  `MaintenanceSection` and `StatusSection`. Passes.
- [ ] **4.3 (RED)** Tests: `isLoading:true` (no data) → loading placeholder, no
  crash; `data:undefined` → every bucket renders `0`. Fails.
- [ ] **4.4 (GREEN)** Add loading placeholder + `?? 0` defaults. Passes.
- [ ] **4.5 (REFACTOR)** Extract the buckets array as a module-level const;
  reuse the existing `es` formatter. `npm run typecheck`.

## Phase 5 — verification

- [ ] **5.1** `npx vitest run` — full suite green (existing config tests still
  pass; the new resync/breakdown tests pass).
- [ ] **5.2** `npm run typecheck` — clean (strict + noUnusedLocals).
- [ ] **5.3** Manual smoke (optional, Playwright MCP): open Clientes →
  Configuración → "Sincronización GR"; confirm the Mantenimiento button opens the
  confirm dialog and the breakdown shows six buckets.
- [ ] **5.4** Confirm NO changes to `App.tsx` / routing (route count unchanged)
  and NO new FE permission string introduced.

---

### Task count: 24 checkable items across 5 phases (3 data/hook, 2 sections, 1 verify).
TDD order: api → hook → button (with confirm/cancel/pending/feedback) →
breakdown → verify. Each implementation task is preceded by its failing test.
