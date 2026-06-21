# Tasks: recapture-admin-assign

**Date:** 2026-06-20
**Phase:** Tasks
**Project:** ipnext-frontend
**Depends on:** `spec.md`, `design.md`
**Test runner:** `npx vitest run <file>` · **Typecheck:** `npm run typecheck`

> STRICT TDD MODE — every implementation task is preceded by its failing-test task (red → green → refactor). Do NOT skip to green without a failing test first.

---

## Batch 1 — api: add bulk assign, remove claim/release (REQ-1)

- [x] **[TEST-RED]** In `src/hooks/__tests__/useRecaptacion.test.tsx` mock list, add `assignBulkRecaptureLeads: vi.fn()` and REMOVE `claimRecaptureLead`/`claimNextRecaptureLead`/`releaseRecaptureLead` from the mock + imports. (This drives the api shape.)
- [x] **[IMPL]** `src/api/recaptacion.api.ts`: ADD `assignBulkRecaptureLeads({ leadIds, operatorId }) → PATCH /recapture/leads/assign-bulk → { assigned: number }`. REMOVE `claimRecaptureLead`, `claimNextRecaptureLead`, `releaseRecaptureLead`, and `isLeadConflictError` (sole consumers removed in Batch 2).
- [x] **[VERIFY]** `npm run typecheck` shows the removed names are not imported anywhere stale.

---

## Batch 2 — hooks: `useAssignBulk`, remove claim/release hooks (REQ-2)

- [x] **[TEST-RED]** In `useRecaptacion.test.tsx`: remove the `useClaimLead`/`useClaimNext`/`useReleaseLead`/`CLAIM_CONFLICT_MESSAGE` describe blocks + imports. Add `describe('useAssignBulk')`: calls `assignBulkRecaptureLeads` with `{ leadIds, operatorId }`; invalidates `['recaptacion']` on success (spy on `invalidateQueries`). Keep `useAssignLead` tests intact.
- [x] **[IMPL]** `src/hooks/useRecaptacion.ts`: remove `claimRecaptureLead`/`claimNextRecaptureLead`/`releaseRecaptureLead`/`isLeadConflictError` imports, `CLAIM_CONFLICT_MESSAGE`, `useClaimLead`, `useClaimNext`, `useReleaseLead`. ADD `import { assignBulkRecaptureLeads }` + `useAssignBulk()` (mutation → invalidate `['recaptacion']` on success, returns `{ assigned }`).
- [x] **[VERIFY]** `npx vitest run src/hooks/__tests__/useRecaptacion.test.tsx` → green.

---

## Batch 3 — `BulkAssignToolbar` component (REQ-3)

- [x] **[TEST-RED]** Create `src/__tests__/customers/BulkAssignToolbar.test.tsx`: renders count text ("N seleccionados"); renders an agent select populated from a passed `admins` prop; clicking "Asignar" calls `onAssign(operatorId)` with the picked id; clicking "Limpiar" calls `onClear`; "Asignar" disabled while `pending`.
- [x] **[IMPL]** Create `src/pages/customers/RecaptacionPage/components/BulkAssignToolbar.tsx` (+ `.module.css`, tokens only): props `{ count; admins; onAssign; onClear; pending }`; local `useState` for selected operatorId; uses `<Button>` atom (`primary` Asignar, `ghost`/`secondary` Limpiar).
- [x] **[VERIFY]** `npx vitest run src/__tests__/customers/BulkAssignToolbar.test.tsx` → green.

---

## Batch 4 — `RecaptacionTableView` selection passthrough (REQ-3)

- [x] **[TEST-RED]** Extend `src/__tests__/customers/RecaptacionTableView.test.tsx`: with `selectable` + `selectedIds` + `onSelectionChange`, row checkboxes (`aria-label=/Seleccionar fila/`) and the header "Seleccionar todos" render; toggling a row calls `onSelectionChange`. With `selectable={false}` (default) NO checkboxes render.
- [x] **[IMPL]** `RecaptacionTableView.tsx`: add optional props `selectable?`, `selectedIds?`, `onSelectionChange?`; forward them to `DataTable`.
- [x] **[VERIFY]** `npx vitest run src/__tests__/customers/RecaptacionTableView.test.tsx` → green.

---

## Batch 5 — RecaptacionPage: multi-select, toolbar, re-gates, remove self-take (REQ-3,4,5,6,7)

- [x] **[TEST-RED]** Rewrite/extend `src/__tests__/customers/RecaptacionPage.test.tsx`. Mock `useMyPermissions` + `useAdmins` + `useAssignBulk`. Remove `useClaimNext` from the mock; add `useAssignBulk`. Cases:
  - admin (`recapture.assign`): row + "Seleccionar todos" checkboxes present; after selecting a row, toolbar with count + "Asignar" appears; clicking "Asignar" calls `useAssignBulk.mutate` with selected ids + operatorId; success toasts the `assigned` count; selection clears on success.
  - admin: "Ingestar bajas", "Importar CSV", "Asignación" filter visible.
  - agent (manage, no assign): NO checkboxes, NO toolbar, NO ingest/CSV, NO assignment filter; status filter + rows present.
  - any role: NO "Tomar siguiente" button.
  - selection clears on filter change and on source-tab change.
- [x] **[IMPL]** `RecaptacionPage.tsx`: remove `useClaimNext`/`handleClaimNext`/"Tomar siguiente". Add `canAssign = can('recapture.assign')`, `selectedIds` state + reset rules (page/filter/tab/success), `useAssignBulk`, `useAdmins` (admin-only). Re-gate ingest/CSV to `recapture.assign`; gate the "Asignación" filter by `canAssign`. Render `BulkAssignToolbar` when `canAssign && selectedIds.length > 0`; pass `selectable={canAssign}` + selection props to `RecaptacionTableView`. Toast the returned `assigned` per design §7.
- [x] **[VERIFY]** `npx vitest run src/__tests__/customers/RecaptacionPage.test.tsx` → green.

---

## Batch 6 — LeadDetailDrawer: re-gate operator, remove claim/release (REQ-8)

- [x] **[TEST-RED]** Update `src/__tests__/customers/LeadDetailDrawer.test.tsx`: add a permission stub that distinguishes `manage` vs `assign`. Operator select present ONLY with `recapture.assign`, absent with manage-only. No "Tomar lead"/"Liberar lead" buttons in any case. Status select + "Registrar contacto" still under `manage`. Remove `useClaimLead`/`useReleaseLead` from the mock.
- [x] **[IMPL]** `LeadDetailDrawer.tsx`: remove `useClaimLead`/`useReleaseLead` + the Tomar/Liberar buttons + their error blocks + `isAssigned` if now unused. Change the operator-select `<Can permission="recapture.manage">` → `recapture.assign`. Keep status select + contact form under `manage`.
- [x] **[VERIFY]** `npx vitest run src/__tests__/customers/LeadDetailDrawer.test.tsx` → green.

---

## Batch 7 — Satellite re-gating (REQ-9)

- [x] **[TEST-RED]** Update `src/__tests__/pages/customers/settings/VendedorMappingBody.test.tsx`: with only `recapture.read` (no assign) the table MUST NOT render; with `recapture.assign` it renders + the selector is enabled.
- [x] **[IMPL]** `VendedorMappingBody.tsx`: `<Can permission="recapture.read">` → `recapture.assign`; `canManage = can('recapture.manage')` → `can('recapture.assign')`; update JSDoc.
- [x] **[TEST-RED]** Update `src/__tests__/customers/MisClientesPage.test.tsx`: cartera selector present only with `recapture.assign` (was `manage`); update the admin-mode tests to use `assign`.
- [x] **[IMPL]** `MisClientesPage.tsx`: `canManage = can('recapture.manage')` → `can('recapture.assign')`; update JSDoc.
- [x] **[IMPL]** `CustomersSettingsPage.tsx`: `can('recapture.read')` → `can('recapture.assign')` for the "Vendedores GR" tab. (Covered by existing settings-page tests if present; add a focused assertion if the page has a test.)
- [x] **[IMPL]** JSDoc-only accuracy fixes: `usePortfolio.ts`, `portfolio.api.ts`, `useGrVendedorMappings.ts` comments `recapture.manage`/`read` → `recapture.assign`.
- [x] **[VERIFY]** `npx vitest run src/__tests__/pages/customers/settings/VendedorMappingBody.test.tsx src/__tests__/customers/MisClientesPage.test.tsx` → green.

---

## Batch 8 — Verify

- [x] **[VERIFY]** `npm run typecheck` — no new type errors.
- [x] **[VERIFY]** `npx vitest run` for all touched files → green.
- [x] **[VERIFY]** `git add` by path; do NOT commit/push (gate + adversarial review + push handled separately).
