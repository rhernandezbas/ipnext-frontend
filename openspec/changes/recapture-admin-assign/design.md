# Design: recapture-admin-assign

**Date:** 2026-06-20
**Phase:** Design
**Project:** ipnext-frontend
**Artifact store:** openspec (file-based)
**Depends on:** `proposal.md`

---

## 0. Verified facts (read from code, not assumed)

1. **`DataTable` already implements multi-select** (`src/components/organisms/DataTable/DataTable.tsx`). It accepts `selectable`, controlled `selectedIds: string[]`, `onSelectionChange`, renders a header checkbox `aria-label="Seleccionar todos"` and per-row checkboxes `aria-label="Seleccionar fila {id}"`. **We do NOT build a new selection primitive — we thread props through `RecaptacionTableView` to `DataTable`.**
2. **Single-assign select uses `useAdmins()`** (`LeadDetailDrawer.tsx:6,145`) → GET `/admins` → `Admin[]` (`id`, `name`). The bulk toolbar reuses it.
3. **The leads list query key is `['recaptacion', query]`** (`useRecaptacion.ts:23`); broad invalidation is done with `['recaptacion']`. `useAssignBulk` invalidates `['recaptacion']` on success — matching the existing pattern in `useAssignLead`.
4. **`isLeadConflictError` + `CLAIM_CONFLICT_MESSAGE`** are consumed ONLY by claim/release (`recaptacion.api.ts:17`, `useRecaptacion.ts:19,52-97`). Grep confirms no other consumer → safe to remove with the claim/release surface. (The hook test file references `CLAIM_CONFLICT_MESSAGE`; it is updated/removed in the same change.)
5. **Page-level toast** already exists (`RecaptacionPage.tsx:74-78`, 4s auto-dismiss) — bulk-assign feedback reuses it. No new toast component.
6. **`RecaptacionLeadsQuery` carries `unassigned?: boolean`** (`types/recaptacion.ts:106`). The "Asignación" filter that sets it is admin-only after this change; the agent never sends `unassigned`.
7. **Button atom** variants: `primary | secondary | danger | ghost | icon` (`Button/Button.tsx:6`). The bulk "Asignar" CTA uses `variant="primary"`; "Cancelar/limpiar selección" uses `variant="ghost"`/`secondary`.
8. **Design tokens** are CSS custom properties (`var(--color-*)`, `var(--space-*)`, `var(--font-size-*)`, `var(--radius-*)`, `var(--shadow-*)`). No Tailwind, no hex literals in new CSS.

---

## 1. ui-ux-pro-max guidance applied

Ran `search.py "data table multi-select bulk action assignment toolbar" --domain ux` plus two follow-ups (selection feedback; partial-success/toast). Relevant hits and how they shape this design:

| UX rule (from skill) | Application |
|----------------------|-------------|
| **Bulk Actions** — "Allow multi-select and bulk edit"; Do: *Checkbox column + Action bar*; Don't: *single row actions only*. | Exactly the chosen pattern: `DataTable` checkbox column + a contextual action bar above/over the table. No per-row "assign" button. |
| **Confirmation Messages / Success Feedback** — Do: *brief success message*; Don't: *silent success*. | After bulk-assign, the existing toast shows the real `assigned` count ("N de M leads asignados"). Never silent. |
| **Toast Notifications** — auto-dismiss 3-5s. | Reuse the page toast (4s). |
| **Hover States** — cursor + subtle visual change on clickable elements. | Toolbar CTA and checkboxes inherit the design system's hover; rows already use `cursor: pointer`. |
| **Responsive / Table Handling** — horizontal scroll wrapper, don't overflow viewport. | `DataTable` already wraps in `.tableWrapper`; the toolbar is full-width and wraps its controls on narrow widths. |

(No design-system *style* swap is needed — the project's tokens + atoms ARE the design system. The skill confirms the interaction pattern rather than dictating a visual theme.)

---

## 2. Decision 1 — Selection state lives in the page, not the table

**Decision:** `RecaptacionPage` owns `selectedIds: string[]` in `useState`; passes it to `RecaptacionTableView` → `DataTable` as **controlled** selection. The table never owns selection truth.

**Why:** The contextual toolbar (count + agent select + Asignar) lives in the page, OUTSIDE the table, and must read the same selection the checkboxes reflect. A controlled `selectedIds` is the single source both consume. `DataTable` already supports controlled mode (`selectedIds !== undefined`).

**Reset rules (Risk: stale ids):** clear `selectedIds` to `[]` when:
- the page changes (`setPage`),
- any filter changes (`handleFilterChange`),
- the source tab changes (Bajas/CSV),
- a bulk-assign completes (success).

This keeps the selection scoped to what's currently on screen. Cross-page selection is explicitly OUT of scope (proposal §7); the BE `assigned` count is the safety net.

## 3. Decision 2 — Gate the WHOLE multi-select surface behind `recapture.assign`

**Decision:** The checkbox column, the "select all", and the toolbar render ONLY when `can('recapture.assign')`. For an agent (read+manage, no assign), `RecaptacionTableView` receives `selectable={false}` and the page renders no toolbar.

**Why:** A non-admin has no assign capability; showing checkboxes they can't act on is the "ghost UI → 403" anti-pattern this change exists to kill. One gate (`can('recapture.assign')`) drives `selectable`, the toolbar, the assignment filter, ingest, and CSV — all the admin-only surface on this page.

**Mechanism:** compute `const canAssign = can('recapture.assign')` once in the page; pass `selectable={canAssign}` to the table; wrap ingest/CSV/toolbar/assignment-filter in `<Can permission="recapture.assign">` or conditionals. The status filter stays ungated (both roles use it).

## 4. Decision 3 — `useAssignBulk` mirrors `useAssignLead` invalidation

**Decision:** New mutation `useAssignBulk()` calls `assignBulkRecaptureLeads({ leadIds, operatorId })`, and on success invalidates `['recaptacion']` (the list). It does NOT invalidate a specific `recaptacion-lead` detail (bulk has no single detail open).

**Why:** Consistency with `useAssignLead` (which invalidates `['recaptacion']` + the detail). Bulk affects many rows in the list; the broad list invalidation refreshes all visible rows. Returns the BE payload `{ assigned }` so the page can toast the real count.

## 5. Decision 4 — Remove dead self-take surface entirely (no soft-deprecation)

**Decision:** Delete `claimRecaptureLead`, `claimNextRecaptureLead`, `releaseRecaptureLead` from the api; `useClaimLead`, `useClaimNext`, `useReleaseLead`, `CLAIM_CONFLICT_MESSAGE` from hooks; the "Tomar siguiente" button + handler from the page; the "Tomar lead"/"Liberar lead" buttons + error blocks from the drawer. Remove `isLeadConflictError` (sole consumers gone).

**Why:** The endpoints are 404 in PROD. Keeping dead code that calls 404s is a latent bug, not a safety net. The corresponding tests are rewritten (TDD) to assert these are GONE.

---

## 6. Component / data flow

```
RecaptacionPage  (owns: page, filter, selectedIds, toast)
│  canAssign = can('recapture.assign')
│  useRecaptacionLeads(query)         → list (BE already scopes by role)
│  useAssignBulk()                    → bulk assign mutation
│  useAdmins()                        → operator candidates (admin-only render)
│
├── header
│     ├── refresh (all)
│     └── <Can assign> Ingestar bajas · Importar CSV </Can>   (was manage)
│
├── source tabs (all)
├── FilterBar
│     ├── Estado (all)
│     └── Asignación (admin-only / canAssign)
│
├── BulkAssignToolbar   (renders only when canAssign && selectedIds.length > 0)
│     "N seleccionados"  →  <select agents from useAdmins>  →  [Asignar]  [Limpiar]
│
└── RecaptacionTableView
      selectable={canAssign}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      → DataTable (existing checkbox col + "Seleccionar todos")

LeadDetailDrawer
├── status select        <Can manage>      (KEPT)
├── operator select      <Can assign>      (was manage)
├── Registrar contacto   <Can manage>      (KEPT)
└── Tomar/Liberar        REMOVED
```

**BulkAssignToolbar** is a new presentational sub-component under `RecaptacionPage/components/` (mirrors the existing component layout). Props: `{ count: number; admins: Admin[]; onAssign: (operatorId: string | null) => void; onClear: () => void; pending: boolean }`. It owns only the locally-selected operatorId in `useState`. No data hooks — the page passes `admins` and the assign handler.

---

## 7. Toast copy (partial success)

On success with payload `{ assigned }` for `N` selected:
- `assigned === N` → `"N leads asignados correctamente."`
- `assigned < N` → `"assigned de N leads asignados."` (states the gap explicitly per the UX "no silent / no surprise" rule)
- `operatorId === null` (unassign) → `"N leads desasignados."` / `"assigned de N leads desasignados."`

---

## 8. TDD test order (red → green → refactor)

1. **api** (`recaptacion.api`): `assignBulkRecaptureLeads` hits PATCH `/recapture/leads/assign-bulk` with `{ leadIds, operatorId }`, returns `{ assigned }`. Removal asserted indirectly via hooks/components.
2. **hooks** (`useRecaptacion.test`): `useAssignBulk` calls the api fn and invalidates `['recaptacion']`; remove the claim/release/claim-next test blocks + `CLAIM_CONFLICT_MESSAGE` import.
3. **RecaptacionPage**: admin sees checkboxes + toolbar after selecting; agent (manage, no assign) does NOT; ingest/CSV/assignment-filter visible only to admin; "Tomar siguiente" gone; bulk assign calls `useAssignBulk` with the selected ids + operatorId and toasts the `assigned` count; selection clears on success/filter/page/tab change.
4. **LeadDetailDrawer**: "Tomar lead"/"Liberar lead" gone (queryByRole null); operator select rendered only with `recapture.assign` (not plain manage); status select + contact form still under `manage`.
5. **Satellite gates**: CustomersSettingsPage tab requires `assign`; VendedorMappingBody requires `assign` (view + selector); MisClientesPage CarteraSelector requires `assign`.

## 9. Verification

- `npm run typecheck` — no new type errors.
- `npx vitest run` for every touched test file — green.
- Full suite expected green (this change removes dead code + adds gated UI; satellite test files that asserted old gates are updated in this change).

## 10. Risks (carried from proposal)

| Risk | Mitigation in design |
|------|----------------------|
| Stale selection across page/filter/tab | Explicit reset rules (Decision 1). |
| Removing shared helpers breaks importers | Grep-confirmed sole consumers; removed together (Decision 5 / fact 4). |
| Existing tests assert old surface | Rewritten in the same change (TDD order §8). |
| `assigned < selected` confuses user | Explicit toast copy (§7). |
| Ghost admin UI → 403 for agent | Single `canAssign` gate drives all admin surface (Decision 2) + satellite re-gating (Part C). |
