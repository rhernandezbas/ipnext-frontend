# Design: client-baja-status

> **SUPERSEDED (label-override approach).** The original design below adopted "Approach C"
> biased to **changing the shared `StatusBadge.LABELS` defaults** (`late → 'Deudor'`,
> `blocked → 'Incobrable'`) and guarding the finance bleed with tests. During apply this was
> **reversed**: the shared atom keeps its **NEUTRAL defaults** (`blocked → 'Bloqueado'`,
> `late → 'Atrasado'`) and gains an optional `label?` prop. Client pages pass
> `label={CLIENT_STATUS_LABELS[status]}` (a new per-domain map at
> `src/pages/customers/clientStatusLabels.ts`) to render GR vocabulary, while finance pages
> render `<StatusBadge status={...} />` with NO label and therefore keep their correct copy
> (a cancelled invoice reads "Bloqueado", never "Incobrable"). This is strictly safer: there is
> **zero copy bleed**, finance pages are **not touched**, and there is no global default change to
> guard. The original "risk R-1 (copy bleed)" is eliminated by construction.
>
> Net implementation:
> - `StatusBadge`: add `'baja'` to `Status`, add `baja: 'Bajas'` to `LABELS`, add `label?` prop,
>   render `label ?? LABELS[status] ?? status`. Keep `blocked`/`late` defaults UNCHANGED.
> - New `CLIENT_STATUS_LABELS` map (active=Activo, late=Deudor, blocked=Incobrable,
>   inactive=Inactivo, baja=Bajas) consumed by CustomersListPage rows + InfoTab.
> - CustomersListPage filters, ClientStatsCards, EditCustomerPage options: GR labels + baja.
> - Tokens `--badge-baja-bg/#e9d5ff` `--badge-baja-fg/#6b21a8`; `.baja` classes in the three
>   relevant CSS modules.

## Context
Small, additive frontend change: add client status `baja` ("Bajas") and re-label `late → Deudor`, `blocked → Incobrable` to match Gestión Real terminology. The locked decisions (label map, purple `baja` variant, `status` stays a string) are fixed. The open architectural question is **where the labels live**, because `StatusBadge` is a shared atom, not a client-only component.

## Decision 1 — Label ownership: keep per-page, do NOT centralize (recommended)

### The tension
The locked label map is described as "the StatusBadge LABELS map". But `StatusBadge` is consumed by 12+ pages (Facturas, Proformas, NotasCredito, BillingTab, CPE, Hardware, Partners, NetworkSites, Locations, Leads, RbacUsers, CustomersList) through **per-page status maps** — each page maps its own domain statuses onto the four badge variants. The codebase convention is explicit: *no central status-label registry — maps are per-page.*

Changing the shared `LABELS` retargets the **variant** labels (`late`, `blocked`) globally, which leaks client/GR vocabulary into unrelated domains. Concrete wrong outcomes:
- `cancelled → blocked` (Facturas, Proformas) would render **"Incobrable"** — a cancelled invoice is not uncollectible.
- `voided → blocked` (NotasCredito) would render **"Incobrable"** — a voided credit note is not uncollectible.
- `expired/overdue → late` rendering "Deudor" is borderline-acceptable but still GR-flavoured copy bleeding into finance.

### Approaches compared

**Approach A — Change the shared `StatusBadge.LABELS` in place (literal reading of the locked decision).**
- Pros: one-line change; matches the task's file list exactly; least code.
- Cons: silently re-labels 4+ non-client pages; produces semantically wrong copy ("Incobrable" for cancelled/voided); violates the "labels are per-page" convention; no test guards the finance pages so the regression is invisible.

**Approach B — Extract a central client-status label registry (e.g. `src/constants/clientStatus.ts`).**
- Pros: single source of truth for *client* labels; future-proof.
- Cons: over-engineering for a 5-value change; the convention is deliberately per-page; introduces a new shared module the rest of the codebase does not use; larger blast radius than the change warrants. Premature abstraction.

**Approach C — Treat `StatusBadge` variants as PRESENTATION tokens, keep DOMAIN labels per-page.** *(recommended)*
- The badge's `Status` is a **visual variant** (color), not a domain status. The label is a sensible default per variant.
- For the **client** domain, the page that owns the data supplies the label. `CustomersListPage`/`STATUS_FILTERS`, `ClientStatsCards`, and `EditCustomerPage` already hold their own client labels — those become the GR vocabulary (`Deudor`, `Incobrable`, `Bajas`).
- The shared `StatusBadge.LABELS` defaults are kept neutral OR, where the locked decision insists the badge itself must read "Deudor"/"Incobrable", we accept the global default change **but document and test the finance consumers** so the copy bleed is a conscious, guarded decision rather than a silent regression.

### Recommendation
Adopt **Approach C**, biased to honoring the locked label map on the badge while protecting the finance pages:
1. Apply the locked `LABELS` change on `StatusBadge` (`baja:'Bajas'`, `late:'Deudor'`, `blocked:'Incobrable'`) — this satisfies the locked decision and the StatusBadge spec scenarios.
2. **Do NOT** extract a central registry — keep client labels in the client pages (already the case) and keep the per-page convention.
3. **Guard the bleed**: add/confirm assertions for the finance consumers that map onto `late`/`blocked` (Facturas/Proformas/NotasCredito/BillingTab) so the new global copy is intentional. If a finance page's new label is judged wrong (`cancelled`/`voided → "Incobrable"`), the **fix is to retarget that page's own map** (e.g. `cancelled → inactive`) — a per-page change, not a registry. This is flagged as a risk/follow-up, not blocking this change.

This keeps the change small, respects the existing convention, satisfies the locked decisions, and turns an invisible regression into a documented, test-guarded one.

## Decision 2 — Color token
Add `--badge-baja-bg: #e9d5ff` / `--badge-baja-fg: #6b21a8` (purple) in `src/tokens/variables.css`, alongside the existing `--badge-*` quartet. `StatusBadge.module.css` gets `.baja { background-color: var(--badge-baja-bg); color: var(--badge-baja-fg); }`. Purple is unused by the other four variants (blue/red/orange/grey), so `baja` is unambiguous. `ClientStatsCards.module.css` gets a `.baja` tone (left-border accent — a purple `#7c3aed` matching the badge family) and `InfoTab.module.css` a `.badge_baja` (bg `#e9d5ff` / fg `#6b21a8`).

## Decision 3 — Unknown-status fallback
`StatusBadge` currently renders `LABELS[status]`, which is `undefined` (blank cell) for any out-of-map value. Change to `LABELS[status] ?? status` so an unexpected backend value degrades to the raw string instead of an empty badge. This is defensive, cheap, and covered by spec S3. The variant class similarly falls back (`styles[status]` may be undefined → only `.badge` base class applies; acceptable).

## Decision 4 — InfoTab handles baja explicitly
`FieldRowStatus` does NOT use the shared `LABELS`; it capitalizes the raw value (`'baja' → 'Baja'`, which is wrong — we want the plural "Bajas"). Extend its ternary to map `baja → tone 'baja'` and override `labelText` to the literal `"Bajas"` for that case. This is the one place the GR label must be duplicated, because the component bypasses `LABELS` by design.

## Decision 5 — Stats card labels stay plural
`ClientStatsCards` uses plural labels (Activos/Inactivos/...). The new card uses `"Bajas"` (already plural; no singular/plural mismatch). The list filter and edit option also use `"Bajas"` per the locked decision — consistent everywhere.

## TDD test order
Strict TDD (red → green → refactor). Tests first, smallest unit outward:
1. **StatusBadge** (atom): update the 4 existing label assertions (Deudor/Incobrable), add `baja → "Bajas"`, add unknown-status-non-blank. → then edit `StatusBadge.tsx` + css + tokens.
2. **CustomersListPage**: assert `STATUS_FILTERS` has `baja`/"Bajas" and blocked→"Incobrable"; assert a `baja` row renders the "Bajas" badge. → then edit the page.
3. **ClientStatsCards / stats**: assert the Bajas card renders the count and toggles the filter to `baja`. → then edit the component + css + `ClientStats` type.
4. **EditCustomerPage**: assert the status select has a "Bajas" option and blocked→"Incobrable". → then edit the page.
5. **InfoTab**: assert a `baja` customer's status row shows "Bajas" with the baja tone. → then edit InfoTab + css.
6. **Type/contract** (`customer.ts`, `customers.api.ts`): additive, enforced at compile time via `tsc --noEmit`.
7. **Finance guard** (risk mitigation): confirm/adjust Facturas/Proformas/NotasCredito/BillingTab badge-label expectations so the global label change is intentional.

## Verification
- `npx vitest run` — all green.
- `tsc --noEmit` — no type errors (additive unions must not break existing exhaustive switches/maps; check `BadgeStatus` literal copies in finance pages still satisfy the widened `Status`).
- Manual: filter Customers by Bajas; confirm purple badge + Bajas card count.

## Risks
- **R-1 (Medium)** — Shared-atom copy bleed: re-labeling `late`/`blocked` changes finance-page badge text; `cancelled`/`voided → "Incobrable"` is semantically wrong. Mitigation: guarded by finance tests; per-page map retarget is the follow-up fix (not a registry).
- **R-2 (Low)** — `tsc` breakage: widening `Status`/`CustomerStatus` could break an exhaustive `Record<Status, …>` somewhere (e.g. a finance `STATUS_MAP` typed as `Record<BadgeStatus, …>` is a value-side literal, not keyed by `Status`, so it is safe — but verify). Mitigation: typecheck in verify.
- **R-3 (Low)** — `InfoTab` duplicate label: the literal `"Bajas"` lives in two places (badge LABELS + InfoTab). Acceptable given the component bypasses LABELS by design; noted so a future refactor can unify.
