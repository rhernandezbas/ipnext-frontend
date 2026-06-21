# recapture-ventas-access — Tasks

## 1. Sidebar gating (BUG 1)

- [ ] 1.1 Write Sidebar tests (TDD red): sales agent (`recapture.read`, no `clients.read`)
      sees "Clientes" with only Recaptación + Mis clientes; no `clients.read` child leaks;
      `clients.read` user still sees full group; no-perm user sees neither group nor CRM section.
- [ ] 1.2 `canSeeChild(child, parent)` inherits `parent.requiredPermission` when the child has none.
- [ ] 1.3 `canSee(item)` for container items = "any visible child"; direct-link items keep own perm.
- [ ] 1.4 `visibleSections` passes the parent into `canSeeChild` and drops container items with
      zero visible children.
- [ ] 1.5 Run full Sidebar suite green (existing SP1–SP9, Contracts, TV, Cortes, Recaptación,
      layout) + new ventas-access cases.

## 2. Empty state (BUG 2)

- [ ] 2.1 Write RecaptacionTableView tests (TDD red): admin (`canAssign`) sees ingest copy;
      agent (`!canAssign`) sees "no assigned leads yet" copy and NOT "Ingestar bajas";
      filtered-empty unchanged.
- [ ] 2.2 Branch the no-filter empty state in `RecaptacionTableView` on `canAssign`.
- [ ] 2.3 Confirm `RecaptacionPage.tsx` passes `canAssign` (already wired).

## 3. Route verification (no change)

- [ ] 3.1 Confirm `/admin/customers/recaptacion` + `/admin/customers/mis-clientes` are gated by
      `recapture.read` and not under a `clients.read` guard. Report only.

## 4. Quality gates

- [ ] 4.1 `npm run typecheck` green.
- [ ] 4.2 `npx vitest run` green (Sidebar + RecaptacionTableView + affected).
