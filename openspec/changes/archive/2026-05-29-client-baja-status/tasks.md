# Tasks: client-baja-status

> **SUPERSEDED — label-override approach.** The shared `StatusBadge` atom keeps its NEUTRAL
> default labels (`blocked → 'Bloqueado'`, `late → 'Atrasado'`). Instead of changing those
> defaults, the atom gains an optional `label?` prop and a new per-domain map
> `src/pages/customers/clientStatusLabels.ts` (`CLIENT_STATUS_LABELS`) supplies GR vocabulary
> to the client pages. Finance pages are NOT touched and keep their correct copy. See design.md.

Strict TDD: write/extend the failing test first (RED), then implement (GREEN), then refactor. Run `npx vitest run` per phase; `tsc --noEmit` at the end.

## Phase 1 — StatusBadge atom (baja variant + label override + fallback)
- [x] 1.1 (RED) Update `src/__tests__/components/StatusBadge.test.tsx`:
  - keep `late`="Atrasado" / `blocked`="Bloqueado" default assertions UNCHANGED
  - add case: `status="baja"` renders `"Bajas"`
  - add case: `label="Incobrable"` override on `blocked` renders the override (not "Bloqueado")
  - add case: unknown status renders the raw string (non-blank)
  - add finance-guard case: `blocked`/`late` with NO label still read "Bloqueado"/"Atrasado"
- [x] 1.2 (GREEN) Edit `src/components/atoms/StatusBadge/StatusBadge.tsx`: add `'baja'` to `Status`; `LABELS` add `baja:'Bajas'` (keep blocked/late defaults); add `label?` prop; render `label ?? LABELS[status] ?? status`
- [x] 1.3 (GREEN) Add `--badge-baja-bg:#e9d5ff` / `--badge-baja-fg:#6b21a8` in `src/tokens/variables.css`
- [x] 1.4 (GREEN) Add `.baja` class in `src/components/atoms/StatusBadge/StatusBadge.module.css` wired to the new tokens
- [x] 1.5 Run `npx vitest run src/__tests__/components/StatusBadge.test.tsx` → green (7→9 cases)

## Phase 2 — Customers types, API contract & client label map (additive)
- [x] 2.1 Edit `src/types/customer.ts`: `CustomerStatus` add `'baja'`
- [x] 2.2 Edit `src/api/customers.api.ts`: `ClientStats` add `baja: number`
- [x] 2.3 NEW `src/pages/customers/clientStatusLabels.ts`: `CLIENT_STATUS_LABELS` (active=Activo, late=Deudor, blocked=Incobrable, inactive=Inactivo, baja=Bajas)
- [x] 2.4 `tsc --noEmit` sanity (no NEW errors; pre-existing baseline unchanged)

## Phase 3 — Customers list page
- [x] 3.1 (RED) Update `src/__tests__/customers/CustomersListPage.test.tsx`:
  - assert `STATUS_FILTERS` includes `Bajas` and blocked label is `"Incobrable"` (not "Bloqueado")
  - assert a row with `status:'baja'` renders the `"Bajas"` badge
- [x] 3.2 (GREEN) Edit `src/pages/customers/CustomersListPage.tsx`: add baja filter; blocked filter label `"Incobrable"`; `toStatusBadge` return type include `'baja'` + pass `baja` through; row badge passes `label={CLIENT_STATUS_LABELS[row.status]}`
- [x] 3.3 Run the list test → green

## Phase 4 — Stat cards
- [x] 4.1 (RED) NEW `src/__tests__/customers/ClientStatsCards.test.tsx`:
  - given `getClientStats` returns `baja: N`, a `"Bajas"` card shows `N`
  - GR labels present (Deudor / Incobrable)
  - clicking the Bajas card calls `onStatusClick('baja')`
- [x] 4.2 (GREEN) Edit `src/pages/customers/ClientStatsCards.tsx`: GR labels (Deudor/Incobrable) + `{ key:'baja', label:'Bajas', value:data?.baja ?? 0, tone:'baja' }`
- [x] 4.3 (GREEN) Add `.baja` tone in `src/pages/customers/ClientStatsCards.module.css` (purple left-border `#7c3aed`); grid `repeat(5)`→`repeat(6)`
- [x] 4.4 Run the stats test → green

## Phase 5 — Edit form
- [x] 5.1 (RED) Update `src/__tests__/customers/EditCustomerPage.test.tsx`: assert status select has a `"Bajas"` option and blocked option reads `"Incobrable"`
- [x] 5.2 (GREEN) Edit `src/pages/customers/EditCustomerPage.tsx`: add `<option value="baja">Bajas</option>`; blocked option label `"Incobrable"`
- [x] 5.3 Run the edit test → green

## Phase 6 — InfoTab status row
- [x] 6.1 (RED) Update `src/__tests__/customers/InfoTab.test.tsx`: a `baja` customer shows `"Bajas"`; a `blocked` customer shows `"Incobrable"` (GR label)
- [x] 6.2 (GREEN) Edit `src/pages/customers/tabs/InfoTab.tsx`: `FieldRowStatus` handle `baja` tone; use `CLIENT_STATUS_LABELS[value] ?? capitalize(value)` for displayed text
- [x] 6.3 (GREEN) Add `.badge_baja` in `src/pages/customers/tabs/InfoTab.module.css` (bg `#e9d5ff` / fg `#6b21a8`)
- [x] 6.4 Run the InfoTab test → green
- [x] 6.5 Update stale `CustomerDetailPage.test.tsx` assertion (`'active' → 'Activo'` via GR labels, was `'Active'`)

## Phase 7 — Finance copy-bleed guard (risk mitigation)
- [x] 7.1 With the label-override approach the bleed is eliminated by construction: finance pages render `<StatusBadge status={...} />` with NO label, so they keep the NEUTRAL defaults. Added a finance-guard assertion in StatusBadge.test.tsx (blocked/late no-label → "Bloqueado"/"Atrasado"). Confirmed Facturas/Proformas/NotasCredito tests pass untouched.
- [x] 7.2 No per-page map retarget needed — `cancelled`/`voided → blocked` correctly reads "Bloqueado", not "Incobrable". Finance pages NOT modified.

## Phase 8 — Verify
- [x] 8.1 `npx vitest run` — full suite green (184 files, 1470 passed, 1 todo)
- [x] 8.2 `tsc --noEmit` — no NEW type errors (12 pre-existing errors on clean tree; identical count with change applied — none in changed files)
- [x] 8.3 Update this checklist + design.md supersede note. Commit deferred to user (per instructions: do NOT commit).
