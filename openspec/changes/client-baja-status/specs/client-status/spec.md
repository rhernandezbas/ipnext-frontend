# Spec: client-status (baja + GR-aligned labels)

Capability: client status rendering, filtering, counting, and editing across the customers UI.

## Requirements

### R1 — StatusBadge supports `baja` and GR labels
1. The `StatusBadge` `Status` type MUST include `'baja'` in addition to `active | late | blocked | inactive`.
2. The badge MUST render the following labels:
   - `active → "Activo"`
   - `late → "Deudor"` (changed from "Atrasado")
   - `blocked → "Incobrable"` (changed from "Bloqueado")
   - `inactive → "Inactivo"`
   - `baja → "Bajas"` (new)
3. The `baja` badge MUST use a visually distinct color variant driven by tokens `--badge-baja-bg` / `--badge-baja-fg` (purple: `#e9d5ff` / `#6b21a8`).
4. Given a status value not present in the label map, the badge MUST NOT render blank; it SHOULD fall back to rendering the raw status string so the cell is never empty.

### R2 — Customers types & API contract are additive
1. `CustomerStatus` MUST include `'baja'`.
2. The `ClientStats` interface MUST include `baja: number`.
3. The `status` field MUST remain a `string` on the wire; no breaking change to existing requests/responses.

### R3 — Customers list filter includes Bajas
1. `STATUS_FILTERS` MUST include `{ value: 'baja', label: 'Bajas' }`.
2. The `blocked` filter option label MUST read `"Incobrable"`.
3. `toStatusBadge` MUST pass a `'baja'` row status through to the badge unchanged (return type includes `'baja'`).

### R4 — Stat cards include a Bajas card
1. `ClientStatsCards` MUST render a card `{ key: 'baja', label: 'Bajas', value: data?.baja ?? 0, tone: 'baja' }`.
2. The `baja` card MUST have a corresponding `.baja` tone style.
3. Clicking the Bajas card MUST toggle the status filter to `'baja'` (and clicking it again MUST clear it), consistent with the other cards.

### R5 — Edit form offers Bajas and aligned labels
1. The status `<select>` in `EditCustomerPage` MUST include an option for `baja` labelled `"Bajas"`.
2. Any `blocked` option label MUST read `"Incobrable"`.

### R6 — InfoTab status row handles baja
1. `FieldRowStatus` MUST handle `value === 'baja'` with a `baja` tone and the literal label `"Bajas"` (this component capitalizes the raw value instead of using the shared `LABELS` map, so it MUST be handled explicitly).
2. A `.badge_baja` style MUST exist in `InfoTab.module.css`.

## Scenarios

### S1 — StatusBadge renders Bajas
- **Given** `<StatusBadge status="baja" />`
- **When** it renders
- **Then** the text `"Bajas"` is shown and the element carries the `baja` variant class.

### S2 — StatusBadge renders new GR labels
- **Given** `<StatusBadge status="late" />` and `<StatusBadge status="blocked" />`
- **When** each renders
- **Then** they show `"Deudor"` and `"Incobrable"` respectively (NOT "Atrasado"/"Bloqueado").

### S3 — Unknown status is no longer blank
- **Given** `<StatusBadge status={'mystery' as Status} />`
- **When** it renders
- **Then** the rendered text is non-empty (falls back to the raw status string).

### S4 — List filter includes Bajas and aligned blocked label
- **Given** the Customers list page renders its status filter
- **When** the filter options are read
- **Then** an option with value `"baja"` and label `"Bajas"` exists, and the `"blocked"` option label is `"Incobrable"`.

### S5 — A `baja` client row renders the Bajas badge
- **Given** a `CustomerSummary` with `status: 'baja'`
- **When** the table renders its Estado column
- **Then** the cell shows the `"Bajas"` badge (status passed through, not collapsed to `inactive`).

### S6 — Stat cards show the Bajas count
- **Given** `getClientStats` returns `{ ..., baja: 7 }`
- **When** `ClientStatsCards` renders
- **Then** a card labelled `"Bajas"` shows `7`, and clicking it sets the active status filter to `"baja"`.

### S7 — Edit form exposes Bajas
- **Given** `EditCustomerPage` renders the status select
- **When** the options are read
- **Then** an option labelled `"Bajas"` exists and the blocked option reads `"Incobrable"`.

### S8 — Contract is additive
- **Given** the existing four-status responses
- **When** the new types/`ClientStats.baja` are introduced
- **Then** existing payloads still type-check and render unchanged (no required field removed, `status` still a string).
