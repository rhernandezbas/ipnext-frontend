# Proposal: recapture-admin-assign

**Date:** 2026-06-20
**Phase:** Propose
**Project:** ipnext-frontend
**Artifact store:** openspec (file-based)
**Type:** Frontend change — backend already in PROD (contract locked)
**Branch:** `feat/recapture-admin-assign-fe`

---

## 1. Intent

Recaptación changed its operating model. **The backend is already deployed in production.** This change aligns the frontend to the new contract:

- **Self-take is gone.** The agent no longer auto-takes leads (`claim-next` / `claim` / `release`). Those endpoints now return **404**. The agent only manages the leads an admin assigned to them.
- **Admin assigns.** An admin with `recapture.assign` distributes leads to agents — both one-by-one (existing single-assign select) and **in bulk** (new multi-select + assign toolbar over the lead table).
- **Server-side scoping.** `GET /leads` already returns only the agent's own leads for non-admins; the admin sees all. The FE must not re-implement this filtering — it trusts the server.
- **Satellite features re-gated.** `ingest-churned`, `import-csv`, `portfolio /by-vendedor` + `/all`, and `gr-vendedor-mappings` (GET + PATCH + vendedores) all moved from `manage`/`read` to **`recapture.assign`** on the BE. The FE gated some of these with `manage`/`read`, which would let an agent see UI that then 403s. We close that window.

The user-facing outcome: a clean admin assignment workflow (select many leads → pick an agent → assign), an agent view stripped of any control they can no longer use, and zero "ghost" buttons that lead to a 403.

---

## 2. Locked backend contract (already in PROD — do NOT change)

| Endpoint | Method | Body | Returns | Permission |
|----------|--------|------|---------|------------|
| `/api/recapture/leads/assign-bulk` | PATCH | `{ leadIds: string[], operatorId: string \| null }` | `{ assigned: number }` | **`recapture.assign`** |
| `/api/recapture/leads/:id/assign` | PATCH | `{ operatorId: string \| null }` | lead | **`recapture.assign`** |
| `/api/recapture/leads` | GET | query | paginated; **agent gets only their leads** | `recapture.read` |
| `/api/recapture/leads/claim-next` | POST | — | **404 (removed)** | — |
| `/api/recapture/leads/:id/claim` | POST | — | **404 (removed)** | — |
| `/api/recapture/leads/:id/release` | POST | — | **404 (removed)** | — |
| `/api/recapture/ingest-churned` | POST | — | `{ created, skipped }` | **`recapture.assign`** |
| `/api/recapture/import-csv` | POST | `{ csv }` | `{ created, errors }` | **`recapture.assign`** |
| portfolio `/by-vendedor`, `/all` | GET | — | portfolio | **`recapture.assign`** |
| `gr-vendedor-mappings` (GET + PATCH + vendedores) | GET/PATCH | — | mappings | **`recapture.assign`** |

`assigned` MAY be less than the number of leads selected (BE skips leads it could not assign — e.g. a concurrent change). The UI must report the real returned count.

---

## 3. Permission model in the FE

| Permission | Grants | Holder |
|------------|--------|--------|
| `recapture.read` | See the Recaptación page + lead list (agent sees their own — BE filters), open the detail drawer. | agent + admin |
| `recapture.manage` | Register a contact, change a lead's status. | agent + admin |
| `recapture.assign` | Assign leads (bulk + single), ingest bajas, import CSV, and all cross-agent / portfolio / vendedor-mapping features. | **admin only** |

Gate everything with `useMyPermissions().can(...)` or `<Can permission=...>`. The route/sidebar gate for `/recaptacion` and `/mis-clientes` STAYS at `recapture.read` (the agent must still reach the page to see their own leads).

---

## 4. Scope

### Part A — API + hooks cleanup (`recapture.assign` workflow)
- `src/api/recaptacion.api.ts`
  - **REMOVE** `claimRecaptureLead`, `claimNextRecaptureLead`, `releaseRecaptureLead` (endpoints are 404).
  - **ADD** `assignBulkRecaptureLeads({ leadIds, operatorId }) → { assigned: number }` (PATCH `/recapture/leads/assign-bulk`).
  - `isLeadConflictError` is only used by claim/release → **REMOVE** if no other consumer remains.
- `src/hooks/useRecaptacion.ts`
  - **REMOVE** `useClaimLead`, `useClaimNext`, `useReleaseLead`, and `CLAIM_CONFLICT_MESSAGE`.
  - **ADD** `useAssignBulk()` → mutation calling `assignBulkRecaptureLeads`, invalidating `['recaptacion']` on success.

### Part B — RecaptacionPage redesign (multi-select + assign)
- `src/pages/customers/RecaptacionPage.tsx`
  - **REMOVE** the "Tomar siguiente" header button + `handleClaimNext` + `useClaimNext`.
  - **RE-GATE** "Ingestar bajas" + "Importar CSV" from `recapture.manage` → `recapture.assign`.
  - **HIDE for non-assign**: the "Asignación / Sin asignar" filter is admin-only (`recapture.assign`).
  - **ADD multi-select (admin / `recapture.assign` only):** per-row checkboxes + "select all" + a contextual toolbar ("N seleccionados → [agent select] → Asignar") that calls `useAssignBulk`, shows the returned `assigned` via the existing toast, clears selection, and invalidates the leads query.
  - The agent (read+manage, no assign) sees: their list, the status filter, the detail drawer — NO checkboxes, NO toolbar, NO ingest/CSV, NO assignment filter.
- `src/pages/customers/RecaptacionPage/components/RecaptacionTableView.tsx`
  - Thread `selectable`, controlled `selectedIds`, `onSelectionChange` through to the existing `DataTable` (which already implements the checkbox column + "Seleccionar todos").
- `src/pages/customers/RecaptacionPage/components/LeadDetailDrawer.tsx`
  - **REMOVE** "Tomar lead" / "Liberar lead" buttons + `useClaimLead` / `useReleaseLead` + their error blocks.
  - **RE-GATE** the "Operador" assignment select from `recapture.manage` → `recapture.assign`.
  - **KEEP** under `recapture.manage`: the status select and the "Registrar contacto" form.

### Part C — Satellite re-gating (close the 403 window)
- `src/pages/customers/CustomersSettingsPage.tsx` — "Vendedores GR" tab: `can('recapture.read')` → `can('recapture.assign')`.
- `src/pages/customers/settings/VendedorMappingBody.tsx` — the table view (`<Can permission="recapture.read">`) AND the editable selector (`can('recapture.manage')`) → both `recapture.assign` (BE re-gated GET + PATCH + vendedores all to `assign`).
- `src/pages/customers/MisClientesPage.tsx` — the `CarteraSelector` gate `can('recapture.manage')` → `can('recapture.assign')` (portfolio `/by-vendedor` + `/all` now need `assign`).
- JSDoc accuracy: update `recapture.manage`/`recapture.read` mentions to `recapture.assign` in `usePortfolio.ts`, `portfolio.api.ts`, `useGrVendedorMappings.ts`, `MisClientesPage.tsx` comments.

---

## 5. Agent-list source (which hook feeds the operator select)

The single-assign select in `LeadDetailDrawer` already uses **`useAdmins()`** (GET `/admins`, returns `Admin[]` with `id`/`name`). The bulk-assign toolbar **reuses `useAdmins()`** for consistency — same candidate pool, same option rendering, React Query dedupes the `['admins', null]` query so it is a cache hit. No new endpoint.

---

## 6. Approach (high level)

1. Strip the dead self-take surface (API → hooks → page → drawer), test-first that the claim/release controls and exports are gone.
2. Add `assignBulk` (api) + `useAssignBulk` (hook), test-first against the locked contract.
3. Build the multi-select toolbar on top of the **existing** `DataTable` selection support — no new selection primitive. Gate it by `recapture.assign`.
4. Re-gate ingest/CSV/assignment-filter (page), operator select (drawer), and the three satellite call-sites.
5. Verify: `npm run typecheck` + `npx vitest run` green for the touched test files; full suite expected green (changes are additive/removal of dead code).

---

## 7. Out of scope

- Any backend change (the contract is locked + deployed).
- Re-implementing server-side agent scoping in the FE (the BE already filters `GET /leads`).
- Pagination-aware "select across pages" (selection is per-rendered-page; the BE bulk endpoint is the safety net via the `assigned` count). Noted as a known limitation, not a bug.
- Touching the route/sidebar `recapture.read` gates for `/recaptacion` and `/mis-clientes` (agent must keep page access).

---

## 8. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Selection persists across page change / filter change → stale ids sent to BE | MEDIUM | Clear `selectedIds` on page change, filter change, and source-tab change; the BE `assigned` count is the final source of truth. |
| Removing `isLeadConflictError` / `CLAIM_CONFLICT_MESSAGE` breaks other importers | LOW | Grep confirms they are only consumed by claim/release; remove together. Verified at apply time. |
| Existing tests assert claim/release controls or claim hooks exist | MEDIUM | Those tests are updated in the same change (TDD) to assert the controls are GONE and the new bulk flow works. |
| Agent briefly sees re-gated UI before BE 403 (the window this change closes) | — (the goal) | Re-gate all satellite call-sites to `recapture.assign`. |
| `assigned < selected` confuses the user | LOW | Toast states the real returned count explicitly (e.g. "8 de 10 leads asignados"). |
