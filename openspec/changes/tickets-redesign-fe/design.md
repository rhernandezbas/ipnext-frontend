# Design v2: tickets-redesign-fe (MERGE onto origin/main aef5474)

**Change**: tickets-redesign-fe
**Base**: origin/main `aef5474`
**Date**: 2026-06-01
**Nature**: MERGE — apply the Prominense visual ON TOP of origin's tickets functionality. Add visual, remove NOTHING (neither ours nor origin's).

---

## 0. Reconciliation summary (read this first)

This design was rebuilt because the old `feat/tickets-redesign-fe` branch was based on an old base (`d153608`). Origin/main has since shipped its OWN tickets work that we must NOT clobber:

| Origin asset (MUST PRESERVE) | Where |
|---|---|
| `TicketsDashboardPage` (KPIs, recharts BarChart, "Asignado a mí" / "Asignados a administradores", categorías) | `src/pages/tickets/TicketsDashboardPage.tsx` + `.module.css` |
| Restructured tickets routing: index→Dashboard, `opened`→List, `list`/`dashboard`/`archive` redirects, `trash`→Archive, `requesters`, `statuses` | `src/App.tsx` |
| `TicketsArchivePage`, `TicketRequestersPage`, `TicketStatusesPage` | `src/pages/tickets/` |
| Catalog-driven status tabs (`useTicketStatuses`) already on the list | `TicketsListPage.tsx` + `TicketsListPage.tabs.module.css` |
| `TicketStatus` narrow union `'open'|'pending'|'resolved'|'closed'` | `src/types/ticket.ts` |
| `CreateTicketPage` full page at `/admin/tickets/new` | `src/pages/tickets/CreateTicketPage.tsx` |
| TaskTabs gained `Inventory` / `Registro de trabajo` / `Actividad` tabs (Inventory wired to `TaskInventorySuggestions` + reviewed-by-inventory toggle) | `SchedulingTaskDetailPage/components/TaskTabs.tsx` |
| `Relacionado` tab exists as `ComingSoonPanel` placeholder | same |
| `CreateTaskModal` has REQUIRED service (`canSave = ... && !!serviceId`), `useClientServices`, `serviceId` field, `{{servicio}}` merge var, address autofill | `SchedulingTasksPage/components/CreateTaskModal.tsx` |

**CRITICAL FINDING — the `contractId` premise does NOT hold.** The pinned contract says "this stacks on `contratos-naming-fe`, so the field is `contractId`." Verified against origin: there is NO `contractId` anywhere in the frontend (`rg contractId src` → 0 hits). Origin (and every sibling worktree) still uses `serviceId` + `useClientServices` + `s.plan`. The `contratos-naming-fe` rename was assessed as SUPERSEDED/DROPPED (engram #607). 

→ **Decision**: this change uses origin's REAL field name `serviceId`. We do NOT introduce `contractId`. The pinned requirement's INTENT is still honored exactly: origin's `CreateTaskModal` already makes the contract/service REQUIRED, and a ticket has no service, so the prefill flow leaves it empty and the user MUST pick one to submit. The intent ("prefill cliente/título/descripción, force the user to choose the contract") is satisfied with zero new fields. If/when a `serviceId`→`contractId` rename lands on origin as a separate change, this design is unaffected — only a field name changes, applied by that change, not this one.

---

## 1. List + Dashboard merge strategy (the hard part)

### Verdict: LAYER, do not replace. Keep BOTH pages, keep origin's routing.

Origin's `TicketsDashboardPage` (index `/admin/tickets`) and `TicketsListPage` (`/admin/tickets/opened`) are TWO DIFFERENT pages serving two purposes:
- Dashboard = analytics landing (KPIs + chart + "asignado a mí/admins").
- List = the working list (status tabs + table + filters).

The Prominense reference (list with right-side filter panel + ColumnSelector + Crear button) maps to the **List page**, NOT the dashboard. So:

- **`TicketsDashboardPage` — UNCHANGED.** It stays the index route. All its functionality (recharts, KPI cards, the two assignment tables, categorías) is preserved verbatim. The only optional touch (out of scope unless trivial) is making its "Nuevo Ticket" button point at `/admin/tickets/opened?create=1` so it opens the new modal instead of the old page — see §3.
- **`TicketsListPage` — RE-SKIN in place (the Prominense look layers onto origin's existing list).** Origin's list ALREADY has the catalog status tabs and a `DataTable`. We add the Prominense chrome AROUND it:
  - Header row: breadcrumb ("Soporte /") + `<h1>Tickets</h1>` on the left; `ColumnSelector` + Recargar + "Crear ticket" (`tickets.write`) on the right.
  - **Right-side filter panel**: replace origin's top `FilterBar` with `TicketFilterBar` (the Prominense filter — Estado catalog / Prioridad / Asignado (RBAC) / búsqueda debounced / Período from–to + active-filter chips). Wire it through a `useTicketsFilterUrl` URL-state hook (URL keys: `status`, `priority`, `assignedTo`, `q`, `customerId`, `from`, `to`).
  - **ColumnSelector** column visibility via `useVisibleColumns` (reused as-is, new STORAGE_KEY `tickets-visible-columns`). Origin's fixed `COLUMNS` becomes the full set, filtered by visible columns.
  - **Keep** origin's catalog status tabs (`tabStyles`) — they ARE part of the Prominense look and origin already built them. The tab click syncs into the filter URL state.
  - **Keep** origin's `DataTable` + `Pagination` + the `tickets.delete`-gated row "Eliminar" action.
  - **Keep** the `statusFilter` prop path used by the Archive page (origin passes `statusFilter='closed'` semantics through `TicketsArchivePage` — verify that page; if it renders `TicketsListPage` with a prop, preserve that prop). NOTE: in current origin `TicketsListPage` takes `{ statusFilter?: string }`. The re-skin keeps that prop for `TicketsArchivePage` compatibility.

Net: ONE list page, re-skinned; the dashboard untouched; routing identical to origin.

### Routing map (NO change to origin's structure)

```
/admin/tickets            → TicketsDashboardPage         (UNCHANGED, index)
/admin/tickets/dashboard  → Navigate → /admin/tickets    (UNCHANGED)
/admin/tickets/opened     → TicketsListPage (re-skinned) + CreateTicketModal via ?create=1
/admin/tickets/list       → Navigate → /admin/tickets/opened   (UNCHANGED)
/admin/tickets/trash      → TicketsArchivePage            (UNCHANGED)
/admin/tickets/archive    → Navigate → /admin/tickets/trash    (UNCHANGED)
/admin/tickets/new        → CreateTicketPage              (see §3 — KEEP route, add ?create=1 fast path)
/admin/tickets/requesters → TicketRequestersPage          (UNCHANGED)
/admin/tickets/statuses   → TicketStatusesPage            (UNCHANGED)
/admin/tickets/:id        → TicketDetailPage (re-skinned)
```

The ONLY `App.tsx` edit is OPTIONAL and additive (see §3). Default plan: leave `App.tsx` untouched; the modal opens via `?create=1` on `/admin/tickets/opened` and the legacy `/new` page is kept intact. This is the most conservative merge — zero routing regressions.

---

## 2. Detail merge strategy

### Verdict: RE-SKIN `TicketDetailPage` in place with grid 8fr/4fr + sidebar + `TicketHeader` kebab. Keep every origin capability.

Origin's `TicketDetailPage` is a flat single-column page. We adopt the Prominense layout while preserving 100% of origin's behavior:

```
TicketDetailPage
├── TicketHeader (NEW component, sticky)
│   ├── breadcrumb + inline-editable subject (tickets.write)
│   ├── StatusSelect (catalog-driven via useTicketStatuses) — replaces origin's 4 hardcoded status buttons
│   ├── PriorityBadge / priority control (tickets.write)
│   └── ⋮ "Acciones" kebab
│       ├── Cerrar ticket   (Can tickets.close; hidden when already closed)
│       ├── Crear tarea      (Can scheduling.write → opens CreateTaskModal, prefilled — §5)
│       └── Eliminar         (Can tickets.delete; confirm dialog)
├── grid (8fr main / 4fr sidebar)
│   ├── main: conversation (replies list, internal tag) + reply form (tickets.write)
│   └── aside sidebar: Detalles card
│        ├── Cliente (link to customer)
│        ├── Reporter
│        ├── Asignado a (RBAC users select — see §7 tech debt)
│        ├── Prioridad
│        ├── Creado / Actualizado
└── CreateTaskModal (conditionally rendered when "Crear tarea" clicked)
```

**Preserve from origin (do NOT drop):**
- Status changes (origin had 4 buttons open/pending/resolved/closed). The Prominense `StatusSelect` is catalog-driven and supersedes the buttons VISUALLY, but the underlying `useUpdateTicketStatus` mutation is kept. Because origin's `TicketStatus` is a narrow union and the catalog is dynamic, see §6 for type reconciliation. The four origin transitions remain reachable (they exist in the catalog as `open/pending/resolved/closed` slugs or their Spanish equivalents).
- Inline subject edit + priority edit → `useUpdateTicket` (origin had an explicit edit mode; Prominense folds subject edit into `TicketHeader` and priority into the sidebar/header — keep `useUpdateTicket`).
- Reply list + reply form → `useTicketReplies` + `useAddTicketReply` (unchanged).
- Assign → `useAssignTicket` (unchanged mutation; sidebar select replaces the inline metadata select).
- Delete → `useDeleteTicket` + confirm (moved into kebab; navigate target must match origin = `/admin/tickets/opened`, NOT v1's `/admin/tickets`).
- `tickets.reopen` permission gate: origin gated the "open" transition with `tickets.reopen`. Preserve that gate inside `StatusSelect` (reopening a closed ticket requires `tickets.reopen`).

**Closed-status detection**: catalog entries have no `isClosed` flag. Treat slug `'cerrado'`/`'closed'` as terminal (tech debt — same as v1 §3). The "Cerrar" kebab item calls `useUpdateTicketStatus` with the closed slug; hidden when the ticket is already closed.

---

## 3. CreateTicketModal (`?create=1`) — net-new, conservative wiring

Origin has NO `CreateTicketModal` and NO `TicketsListPage/components/` dir. This is purely additive.

- **New** `src/pages/tickets/TicketsListPage/components/CreateTicketModal.tsx` (+ `.module.css`) — adapted from the v1 ref. Fields: subject, message, priority, customer (`CustomerPicker`), assignedTo. Calls `useCreateTicket`.
- `TicketsListPage` reads `?create=1` on mount → opens modal → clears the param with `replace:true` (no extra history entry). Gated by `tickets.write`.
- **KEEP origin's `CreateTicketPage`** at `/admin/tickets/new`. Do NOT replace it with a redirect (that would delete origin functionality). Two acceptable options — pick ONE at apply time:
  - **(A) Conservative (default):** leave `App.tsx` and `CreateTicketPage` untouched. The modal is reachable from the List header "Crear ticket" button and via `?create=1`. The full-page `/new` flow continues to exist.
  - **(B) Unify (optional):** change `/admin/tickets/new` to `<Navigate to="/admin/tickets/opened?create=1" replace />` AND keep `CreateTicketPage.tsx` on disk (do not delete the file) so nothing is physically removed. Only choose this if the user explicitly wants a single create surface.
  - Default to (A). It removes NOTHING.

---

## 4. Relacionado tab — real panel, keep origin's other tabs

Origin's `TaskTabs` has SIX tabs: Detalles, Comentarios, Relacionado (ComingSoonPanel), Inventory (real), Registro de trabajo (ComingSoon), Actividad (ComingSoon).

- **Replace ONLY the Relacionado tab content** — swap its `ComingSoonPanel` for a real `RelacionadoPanel({ ticketId, ticketSubject })` (from v1 ref): if `ticketId` → render a card linking to `/admin/tickets/:ticketId` (`#id — subject`); else empty state.
- **KEEP all other tabs exactly as origin has them** — especially the wired `Inventory` tab (`TaskInventorySuggestions` + reviewed-by-inventory toggle), `Registro de trabajo`, `Actividad`. Do NOT touch their content, order, lazy-mount logic, or `mountMode`.
- Extend `TaskTabsProps` additively with `ticketId?: number | null` and `ticketSubject?: string | null`. Existing props (`detailsProps`, `commentsTaskId`, `reviewedByInventory`, `onInventoryToggle`) stay unchanged. The `SchedulingTaskDetailPage` that renders `TaskTabs` passes the two new props from the enriched task DTO.
- **No secondary GET** — `ticketSubject` comes from the enriched task DTO directly (BE-dependent — see §8).

---

## 5. CreateTaskModal — additive `initialValues?` + respect origin's REQUIRED service

Origin's `CreateTaskModal` already makes service REQUIRED (`canSave = title && firstStageId && customerId && serviceId`). We extend it additively:

- Add `CreateTaskInitialValues` interface + optional `initialValues?` prop (from v1 ref): `{ title?, customerId?, customerName?, description?, ticketId?: number }`.
- Seed `title`/`customerId`/`customerName`/`description` from `initialValues` in the `useState` initializers.
- **Service is intentionally NOT prefilled** — a ticket has no service. Origin's required-service rule then forces the user to pick a service before "Crear tarea" enables. This is the desired behavior per the pinned contract (prefill what we can; user MUST choose the contract/service). Document it so it's not mistaken for a bug: when opened from a ticket, the modal shows Servicio empty and the submit button stays disabled until a service is chosen.
- On save, append `ticketId` to the payload only when present: `...(initialValues?.ticketId != null ? { ticketId } : {})`. (BE-blocked — see §8.)
- Add `ticketId?: number | null` to `CreateTaskPayload` (`src/types/scheduling.ts`) additively.
- **Preserve everything else** in origin's modal: template apply, `{{servicio}}`/`{{cliente}}` merge vars, address autofill (service > customer precedence), `useClientServices`, project/workflow/stage resolution, backdrop-discard confirm, dates, priorities, categories.

---

## 6. TicketStatus type reconciliation

Origin keeps the narrow union `'open' | 'pending' | 'resolved' | 'closed'` AND a runtime catalog (`useTicketStatuses`). v1 widened `TicketStatus` to `string`.

- **Decision**: widen `TicketStatus` to `string` — BUT keep the four known slugs as a documented constant set for the legacy transitions, so nothing that depended on the union breaks. Concretely:
  - `export type TicketStatus = string;` (catalog-driven).
  - Add `export const LEGACY_TICKET_STATUSES = ['open','pending','resolved','closed'] as const;` for the places that still reason about the four built-in transitions (e.g. `STATUS_LABELS`, reopen gating).
  - Audit usages: `TicketDetailPage` `handleStatusChange(status: TicketStatus)`, `STATUS_BUTTONS`, `useUpdateTicketStatus` typing. Replace narrow-union assumptions with `string` + catalog. Keep `STATUS_LABELS` map as a display fallback (catalog `name` is the primary display).
- This is the one type widening that touches origin; it is required for the catalog-driven `StatusSelect`. It does not remove functionality — the four transitions remain valid strings.

---

## 7. assignedTo tech debt (unchanged from v1)

`Ticket.assignedTo` is `number | null`; `useRbacUsers` returns string-UUID ids. Sidebar/filter show RBAC user names but the FK stays numeric. v1's detail sidebar passed `assignedTo: null` + `assignedToName` (a known shortcut). Keep origin's existing numeric assign behavior as the source of truth where it already works, and flag the RBAC-name display as interim tech debt. Do NOT regress origin's working numeric assign in the detail page — if RBAC mapping is unclear at apply time, keep origin's numeric select options rather than breaking assignment.

---

## 8. BE dependencies (tickets-actions-be) — degrade gracefully, never block origin

| FE feature | BE requirement | Degraded behavior if BE absent |
|---|---|---|
| "Crear tarea" kebab sends `ticketId` | `ScheduledTask.ticketId` FK | Omit `ticketId` from payload; task still created (prefill only) |
| `Relacionado` tab shows `ticketSubject` | Task DTO enriched with `ticketId`+`ticketSubject` | Panel shows empty state (no link) |

The merge must NOT make origin's scheduling/tickets pages depend on un-deployed BE. All ticketId/ticketSubject wiring is optional-chained and renders an empty/degraded state when the fields are absent.

---

## 9. Permission gating table (dot format, never colon)

| Action | Permission | Gate | Absent behavior |
|---|---|---|---|
| "Crear ticket" button (List header) | `tickets.write` | `<Can>` | Not rendered |
| Open CreateTicketModal via ?create=1 | `tickets.write` | render guard | Not rendered |
| Inline subject edit (detail) | `tickets.write` | TicketHeader | Read-only |
| Change status (StatusSelect) | `tickets.write` | disabled | Disabled |
| Reopen (open transition on closed) | `tickets.reopen` | StatusSelect option | Hidden/disabled |
| Reply | `tickets.write` | form | Not rendered |
| Cerrar (kebab) | `tickets.close` | kebab item | Not rendered |
| Crear tarea (kebab) | `scheduling.write` | kebab item | Not rendered |
| Eliminar (kebab + list row) | `tickets.delete` | item/action | Not rendered |
| Relacionado tab content | (none, read-only) | — | Always visible |

---

## 10. File inventory — what changes and what origin functionality is preserved

### NEW files (net-new, additive — zero origin impact)
| File | Purpose |
|---|---|
| `src/pages/tickets/TicketsListPage/components/TicketFilterBar.tsx` + `.module.css` | Prominense right-side filter panel + active-filter chips |
| `src/pages/tickets/TicketsListPage/components/CreateTicketModal.tsx` + `.module.css` | `?create=1` create modal |
| `src/pages/tickets/TicketsListPage/hooks/useTicketsFilterUrl.ts` | URL filter state (status/priority/assignedTo/q/customerId/from/to) |
| `src/pages/tickets/TicketsListPage/hooks/useVisibleColumns.ts` | Column visibility (or reuse scheduling's hook with new STORAGE_KEY) |
| `src/pages/tickets/TicketDetailPage/components/TicketHeader.tsx` + `.module.css` | Sticky header, inline subject, StatusSelect, "Acciones" kebab |

### MODIFIED files (re-skin / additive — preserve listed origin behavior)
| File | Change | Origin functionality preserved |
|---|---|---|
| `src/pages/tickets/TicketsListPage.tsx` | Re-skin: header + ColumnSelector + TicketFilterBar + body wrapper | catalog status tabs, DataTable, Pagination, delete-row action, `statusFilter` prop (Archive page) |
| `src/pages/tickets/TicketsListPage.module.css` | Add Prominense chrome classes (header/headerLeft/headerRight/breadcrumb/title/body/tableSection/btnIcon/btnPrimary) | keep existing classes used by tabs/page |
| `src/pages/tickets/TicketDetailPage.tsx` | Re-skin: grid 8fr/4fr + TicketHeader + sidebar; CreateTaskModal wiring | all mutations (status/reply/assign/update/delete), reply list, internal tag, reopen gate, delete→/opened |
| `src/pages/tickets/TicketDetailPage.module.css` | Add grid/sidebar/sideCard classes | keep conversation/reply classes |
| `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs.tsx` | Relacionado content → RelacionadoPanel; add ticketId/ticketSubject props | ALL other tabs (Detalles/Comentarios/Inventory/Registro/Actividad), lazy mount, Inventory wiring |
| `src/pages/scheduling/SchedulingTaskDetailPage.tsx` (parent) | Pass ticketId/ticketSubject into TaskTabs from enriched DTO | everything else |
| `src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx` | Add initialValues? + ticketId in payload | required-service rule, merge vars, address autofill, templates, all fields |
| `src/types/ticket.ts` | TicketStatus union → string + LEGACY_TICKET_STATUSES const | Ticket/TicketReply/TicketStats/CreateTicketData interfaces |
| `src/types/scheduling.ts` | Add `ticketId?: number|null` to CreateTaskPayload | rest of type |
| `src/pages/tickets/TicketsDashboardPage.tsx` | OPTIONAL: "Nuevo Ticket" → `/admin/tickets/opened?create=1` | ALL dashboard analytics/cards/tables (untouched otherwise) |
| `src/App.tsx` | OPTIONAL (option B only): `/new` → redirect; otherwise UNTOUCHED | entire routing structure |

### UNCHANGED origin assets (explicitly NOT touched)
`TicketsDashboardPage.module.css`, `TicketsArchivePage`, `TicketRequestersPage`, `TicketStatusesPage`, `CreateTicketPage` (kept on disk regardless of option), `ComingSoonPanel`, `TaskInventorySuggestions`, `TicketsListPage.tabs.module.css`, all scheduling pages other than the two listed.

### REUSED as-is (no file change)
`ColumnSelector`, `DataTable`, `Pagination`, `CustomerPicker`, `useTicketStatuses`, `useRbacUsers`, `useTicket(s)` hooks, `Can`/`useCan`, `useConfirm`, `useCreateTask`, `useProjects/useWorkflows/useTaskTemplates`.

---

## 11. Strict TDD note

Strict TDD is active. Each modified/new component must start from a failing test mirroring `src/__tests__/` structure. The v1 ref carries tests for most of these (`__tests__/tickets/...`, `__tests__/scheduling/TaskTabs.test.tsx`, `CreateTaskModal.test.tsx`) — port and adapt them to origin's reality (e.g. assert origin's Inventory/Registro/Actividad tabs still render alongside the new Relacionado content; assert CreateTaskModal still requires a service when opened from a ticket).
