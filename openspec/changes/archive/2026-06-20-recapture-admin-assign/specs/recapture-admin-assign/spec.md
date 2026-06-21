# Spec: recapture-admin-assign

**Date:** 2026-06-20
**Phase:** Spec
**Project:** ipnext-frontend
**Depends on:** `proposal.md`, `design.md`
**Conventions:** RFC2119 keywords (MUST / MUST NOT / SHOULD / MAY). Scenarios in Given/When/Then. Each requirement is tagged ADDED / MODIFIED / REMOVED relative to the current recapture frontend.

---

## Overview

Delta specification aligning the recapture frontend to the deployed (PROD) backend: admin-driven assignment (bulk + single), removal of agent self-take, and re-gating of satellite features to `recapture.assign`. No backend changes.

---

## REQ-1 — Bulk-assign API client `assignBulkRecaptureLeads` (ADDED)

The api layer MUST expose a function that calls the locked bulk endpoint.

1. `assignBulkRecaptureLeads({ leadIds, operatorId })` MUST issue `PATCH /recapture/leads/assign-bulk` with body `{ leadIds: string[], operatorId: string | null }`.
2. It MUST resolve to the BE payload `{ assigned: number }`.
3. The api layer MUST NOT export `claimRecaptureLead`, `claimNextRecaptureLead`, or `releaseRecaptureLead` (endpoints are 404).

### Scenarios

**GIVEN** an admin invokes `assignBulkRecaptureLeads({ leadIds: ['l1','l2','l3'], operatorId: 'op-1' })`
**WHEN** the request is built
**THEN** it is a `PATCH` to `/recapture/leads/assign-bulk`
**AND** the body is exactly `{ leadIds: ['l1','l2','l3'], operatorId: 'op-1' }`
**AND** the resolved value is the server's `{ assigned }` object.

---

**GIVEN** `operatorId` is `null` (unassign-in-bulk)
**WHEN** `assignBulkRecaptureLeads({ leadIds: ['l1'], operatorId: null })` is called
**THEN** the body MUST carry `operatorId: null` (not omitted, not empty string).

---

**GIVEN** the api module is imported
**WHEN** its exports are inspected
**THEN** `claimRecaptureLead`, `claimNextRecaptureLead`, and `releaseRecaptureLead` MUST NOT be present.

---

## REQ-2 — `useAssignBulk` hook (ADDED) + claim/release hooks (REMOVED)

1. `useAssignBulk()` MUST be a mutation calling `assignBulkRecaptureLeads`.
2. On success it MUST invalidate the leads list query key `['recaptacion']`.
3. The hooks module MUST NOT export `useClaimLead`, `useClaimNext`, `useReleaseLead`, or `CLAIM_CONFLICT_MESSAGE`.

### Scenarios

**GIVEN** `useAssignBulk` is mounted
**WHEN** `mutate({ leadIds: ['l1','l2'], operatorId: 'op-2' })` is called and resolves `{ assigned: 2 }`
**THEN** `assignBulkRecaptureLeads` MUST be called with `{ leadIds: ['l1','l2'], operatorId: 'op-2' }`
**AND** on success `invalidateQueries({ queryKey: ['recaptacion'] })` MUST be called.

---

**GIVEN** the hooks module is imported
**WHEN** its exports are inspected
**THEN** `useClaimLead`, `useClaimNext`, `useReleaseLead`, and `CLAIM_CONFLICT_MESSAGE` MUST NOT be present.

---

## REQ-3 — Admin multi-select + bulk-assign toolbar on RecaptacionPage (ADDED)

When the user holds `recapture.assign`, the lead table MUST offer multi-select and a contextual assign toolbar.

1. The table MUST render a per-row selection checkbox and a "select all" header checkbox (provided by `DataTable`).
2. When at least one lead is selected, a toolbar MUST appear showing the selection count, an agent `<select>`, and an "Asignar" action.
3. Clicking "Asignar" MUST call `useAssignBulk` with the selected `leadIds` and the chosen `operatorId`.
4. On success the UI MUST display the server-returned `assigned` count and MUST clear the selection.
5. The agent options MUST come from `useAdmins()` (same source as the single-assign select).

### Scenarios

**GIVEN** an admin (`recapture.assign`) on RecaptacionPage with leads listed
**WHEN** the page renders
**THEN** each lead row MUST expose a checkbox `aria-label="Seleccionar fila {id}"`
**AND** a header checkbox `aria-label="Seleccionar todos"` MUST be present.

---

**GIVEN** an admin has selected two leads
**WHEN** the selection becomes non-empty
**THEN** a toolbar MUST be visible stating "2 seleccionados" (or equivalent count)
**AND** it MUST contain an agent select and an "Asignar" button.

---

**GIVEN** an admin selected leads `l1`, `l2` and picked agent `op-1`
**WHEN** the admin clicks "Asignar"
**THEN** `useAssignBulk.mutate` MUST be called with `{ leadIds: ['l1','l2'], operatorId: 'op-1' }`.

---

**GIVEN** the bulk assign resolves `{ assigned: 8 }` for 10 selected leads
**WHEN** the mutation succeeds
**THEN** the UI MUST surface a message conveying `8` (the real count, e.g. "8 de 10 leads asignados")
**AND** the selection MUST be cleared.

---

**GIVEN** the bulk toolbar's agent select is open
**WHEN** its options render
**THEN** they MUST be the admins returned by `useAdmins()` (by `id` → `name`).

---

## REQ-4 — Selection reset rules (ADDED)

The selection MUST NOT leak across context changes.

1. Changing the page (pagination) MUST clear the selection.
2. Changing any filter MUST clear the selection.
3. Changing the source tab (Bajas/CSV) MUST clear the selection.
4. A successful bulk assign MUST clear the selection.

### Scenarios

**GIVEN** an admin has leads selected
**WHEN** the admin changes the status filter
**THEN** the selection MUST be empty afterward.

---

**GIVEN** an admin has leads selected
**WHEN** the admin switches from "Bajas" to "CSV"
**THEN** the selection MUST be empty afterward.

---

## REQ-5 — Agent view has no admin surface on RecaptacionPage (MODIFIED)

A user with `recapture.read` + `recapture.manage` but NOT `recapture.assign` MUST see a restricted page.

1. The agent MUST NOT see selection checkboxes or the bulk toolbar.
2. The agent MUST NOT see "Ingestar bajas" or "Importar CSV".
3. The agent MUST NOT see the "Asignación / Sin asignar" filter.
4. The agent MUST still see the lead list (BE-scoped to their own), the status filter, and be able to open the detail drawer.

### Scenarios

**GIVEN** an agent (`recapture.read` + `recapture.manage`, no `recapture.assign`)
**WHEN** RecaptacionPage renders
**THEN** no row checkbox and no "Seleccionar todos" checkbox MUST be present
**AND** no "Ingestar bajas", "Importar CSV", or assignment filter MUST be present
**AND** the status filter and the lead rows MUST still be present.

---

## REQ-6 — RecaptacionPage admin actions re-gated to `recapture.assign` (MODIFIED)

1. "Ingestar bajas" and "Importar CSV" MUST be gated by `recapture.assign` (previously `recapture.manage`).
2. The "Asignación" filter MUST be gated by `recapture.assign`.

### Scenarios

**GIVEN** an admin (`recapture.assign`)
**WHEN** RecaptacionPage renders
**THEN** "Ingestar bajas", "Importar CSV", and the "Asignación" filter MUST be visible.

---

## REQ-7 — "Tomar siguiente" header button removed (REMOVED)

The page MUST NOT render a "Tomar siguiente" button for any role.

### Scenarios

**GIVEN** any user on RecaptacionPage
**WHEN** the header renders
**THEN** no button labeled "Tomar siguiente" MUST exist.

---

## REQ-8 — LeadDetailDrawer: operator select re-gated, claim/release removed (MODIFIED + REMOVED)

1. The "Operador" assignment select MUST be gated by `recapture.assign` (previously `recapture.manage`).
2. The drawer MUST NOT render "Tomar lead" or "Liberar lead" buttons.
3. The status select and the "Registrar contacto" form MUST remain gated by `recapture.manage`.

### Scenarios

**GIVEN** a user with `recapture.manage` but NOT `recapture.assign`
**WHEN** the LeadDetailDrawer renders
**THEN** the "Operador" select MUST NOT be present
**AND** the status select and "Registrar contacto" controls MUST still be present.

---

**GIVEN** a user with `recapture.assign`
**WHEN** the LeadDetailDrawer renders for a lead
**THEN** the "Operador" select MUST be present with admins as options.

---

**GIVEN** any user
**WHEN** the LeadDetailDrawer renders
**THEN** no "Tomar lead" and no "Liberar lead" button MUST exist.

---

## REQ-9 — Satellite features re-gated to `recapture.assign` (MODIFIED)

The frontend gate MUST match the backend's `recapture.assign` requirement so an agent never sees UI that 403s.

1. CustomersSettingsPage "Vendedores GR" tab MUST be gated by `recapture.assign` (previously `recapture.read`).
2. VendedorMappingBody table view AND its editable selector MUST require `recapture.assign` (previously `read` to view, `manage` to edit).
3. MisClientesPage `CarteraSelector` MUST be gated by `recapture.assign` (previously `recapture.manage`).

### Scenarios

**GIVEN** a user without `recapture.assign`
**WHEN** CustomersSettingsPage renders
**THEN** the "Vendedores GR" tab MUST NOT be present.

---

**GIVEN** a user with `recapture.assign`
**WHEN** CustomersSettingsPage renders
**THEN** the "Vendedores GR" tab MUST be present.

---

**GIVEN** a user without `recapture.assign`
**WHEN** VendedorMappingBody renders
**THEN** the mapping table MUST NOT be shown.

---

**GIVEN** a user without `recapture.assign`
**WHEN** MisClientesPage renders
**THEN** the cartera selector MUST NOT be present (the user sees only their own portfolio).

---

**GIVEN** a user with `recapture.assign`
**WHEN** MisClientesPage renders
**THEN** the cartera selector MUST be present.

---

## Ambiguities resolved

| Ambiguity | Resolution |
|-----------|------------|
| Agent-list source for bulk assign | Reuse `useAdmins()` (GET `/admins`) — same as the single-assign select. |
| Cross-page "select all" | Out of scope; selection is per-rendered-page. The BE `assigned` count is authoritative. |
| `assigned < selected` | Toast states the real returned count explicitly; never silent. |
| Route/sidebar gate for `/recaptacion`, `/mis-clientes` | Unchanged at `recapture.read` — the agent must reach the page to see their own leads. |
| VendedorMappingBody had split read/manage gates | Collapsed to a single `recapture.assign` gate (BE re-gated GET + PATCH + vendedores all to `assign`). |
