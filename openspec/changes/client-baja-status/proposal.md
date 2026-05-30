# Change: client-baja-status

## Intent
The backend already ships `status: "baja"` for clients in production (`ClientStatus = active | late | blocked | inactive | baja`, and `ClientStats` now includes a `baja` count). The frontend currently knows only four client statuses and silently renders nothing for an unknown one. This change makes `baja` (label **"Bajas"**) a first-class client status across the customers UI and aligns the client-status labels with Gestión Real (GR) terminology.

## Scope

### Part A — Shared StatusBadge atom (label + variant)
- `src/components/atoms/StatusBadge/StatusBadge.tsx`
  - `Status` type: add `'baja'` → `active | late | blocked | inactive | baja`.
  - `LABELS` map: add `baja: 'Bajas'`; change `late: 'Atrasado' → 'Deudor'`, `blocked: 'Bloqueado' → 'Incobrable'`.
  - Add a safe fallback so an unknown status no longer renders blank.
- `src/components/atoms/StatusBadge/StatusBadge.module.css` — add `.baja` class wired to new tokens.
- `src/tokens/variables.css` — add `--badge-baja-bg` (`#e9d5ff`) / `--badge-baja-fg` (`#6b21a8`), visually distinct (purple) from the other four.

### Part B — Customers types & API contract (additive)
- `src/types/customer.ts` — `CustomerStatus` add `'baja'`.
- `src/api/customers.api.ts` — `ClientStats` interface add `baja: number`.

### Part C — Customers pages
- `src/pages/customers/CustomersListPage.tsx`
  - `STATUS_FILTERS`: add `{ value: 'baja', label: 'Bajas' }`; align `blocked` filter label to `'Incobrable'`.
  - `toStatusBadge`: return type includes `'baja'` and passes `baja` through.
- `src/pages/customers/ClientStatsCards.tsx` — add a `baja` card `{ key: 'baja', label: 'Bajas', value: data?.baja ?? 0, tone: 'baja' }` (+ `.baja` tone in `ClientStatsCards.module.css`).
- `src/pages/customers/EditCustomerPage.tsx` — status `<option>`s: add `Bajas`; align labels (`Deudor` if `late` is offered, `Incobrable` for `blocked`).
- `src/pages/customers/tabs/InfoTab.tsx` — `FieldRowStatus` ternary: handle `baja` (tone + literal label `'Bajas'`, since this component capitalizes the raw value instead of using `LABELS`); add `.badge_baja` in `InfoTab.module.css`.

### Part D — Tests (TDD, written first)
- `src/__tests__/components/StatusBadge.test.tsx` — add `baja → 'Bajas'`; update `blocked → 'Incobrable'`, `late → 'Deudor'`; add unknown-status-no-longer-blank case.
- Customers tests touched by the new filter/card/option (`CustomersListPage`, `ClientStatsCards`/stats, `EditCustomerPage`, `InfoTab`) as needed.

## Approach
String-on-the-wire `status` stays a string; adding `baja` is purely additive to the type unions and the stats contract. TDD: update/extend the failing tests first (red), then the component code (green), then refactor.

## Cross-cutting risk (must be resolved in design)
`StatusBadge` is a **shared atom** consumed by 12+ pages through per-page status maps (there is no central label registry — maps are per-page by convention). Several non-client pages map their own domain statuses onto the `late`/`blocked` badge variants:

| Page | Map | After label change renders |
|------|-----|----------------------------|
| FacturasPage | `overdue → late`, `cancelled → blocked` | "Deudor", **"Incobrable"** |
| BillingTab | `overdue → late`, `cancelled → blocked` | "Deudor", **"Incobrable"** |
| ProformasPage | `expired → late`, `cancelled → blocked` | "Deudor", **"Incobrable"** |
| NotasCreditoPage | `voided → blocked` | **"Incobrable"** |

Re-labeling the shared map silently changes copy for all of these. Some are acceptable, but **`cancelled → "Incobrable"`** and **`voided → "Incobrable"`** are semantically wrong. The design document decides whether to (a) accept the shared change as-is, (b) centralize a client-specific label map, or (c) keep client labels per-page and leave the shared atom's generic labels intact. See `design.md`.

## Backend contract (already deployed)
- `GET /api/clients/stats` → `{ total, active, inactive, blocked, late, baja }`.
- Client `status` field may now be `"baja"`. `status` remains a string on the wire.
