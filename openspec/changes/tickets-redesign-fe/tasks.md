# Tasks: tickets-redesign-fe (MERGE onto origin/main)

Strict TDD: for every code task, write the failing test FIRST, then implement.
Guiding rule: ADD visual, REMOVE nothing. Preserve every origin capability listed in design §10.

## Phase 0 — Types (foundation)
- [ ] Test: `TicketStatus` accepts arbitrary catalog slug strings; `LEGACY_TICKET_STATUSES` exports the four built-ins.
- [ ] `src/types/ticket.ts`: `TicketStatus` → `string`; add `LEGACY_TICKET_STATUSES` const. Keep all interfaces.
- [ ] `src/types/scheduling.ts`: add `ticketId?: number | null` to `CreateTaskPayload` (additive).

## Phase 1 — List page re-skin (Prominense look ON origin's list)
- [ ] Test: List renders header (breadcrumb + title), ColumnSelector, Recargar, "Crear ticket" (only with `tickets.write`).
- [ ] Test: catalog status tabs STILL render and filter (preserve origin behavior).
- [ ] Test: DataTable rows, Pagination, and `tickets.delete` row action STILL work.
- [ ] Test: `statusFilter` prop path (Archive page) still produces the archive list.
- [ ] NEW `useTicketsFilterUrl.ts` (+ test): URL keys status/priority/assignedTo/q/customerId/from/to.
- [ ] NEW `useVisibleColumns.ts` for tickets (or reuse scheduling hook with STORAGE_KEY `tickets-visible-columns`).
- [ ] NEW `TicketFilterBar.tsx` + `.module.css` (+ test): Estado(catalog)/Prioridad/Asignado(RBAC)/búsqueda(debounced)/Período + active-filter chips.
- [ ] Modify `TicketsListPage.tsx`: add header chrome, swap top FilterBar → TicketFilterBar, ColumnSelector visibility, body wrapper. KEEP tabs, DataTable, Pagination, delete action, `statusFilter` prop.
- [ ] Modify `TicketsListPage.module.css`: add Prominense chrome classes; do not remove tab/page classes.

## Phase 2 — CreateTicketModal (`?create=1`)
- [ ] Test: `?create=1` opens modal on mount and clears the param (replace, no history entry).
- [ ] Test: modal create calls `useCreateTicket`; gated by `tickets.write`.
- [ ] NEW `CreateTicketModal.tsx` + `.module.css`: subject/message/priority/CustomerPicker/assignedTo.
- [ ] Wire mount logic into `TicketsListPage`.
- [ ] DEFAULT option A: leave `App.tsx` + `CreateTicketPage` untouched (legacy /new page preserved). (Option B only if user asks: `/new`→redirect, keep file on disk.)

## Phase 3 — Detail page re-skin (grid + sidebar + Acciones kebab)
- [ ] Test: TicketHeader renders inline subject (tickets.write), catalog StatusSelect, kebab with Cerrar(tickets.close)/Crear tarea(scheduling.write)/Eliminar(tickets.delete); dot-perm gating.
- [ ] Test: reopen of a closed ticket gated by `tickets.reopen`.
- [ ] Test: status change, reply add, assign, subject/priority update, delete (→ `/admin/tickets/opened`) all STILL invoke their mutations.
- [ ] Test: conversation list + internal tag + reply form (tickets.write) preserved.
- [ ] NEW `TicketHeader.tsx` + `.module.css` (StatusSelect catalog-driven; "Cerrar" uses closed slug, hidden when already closed).
- [ ] Modify `TicketDetailPage.tsx`: grid 8fr/4fr + TicketHeader + Detalles sidebar; keep ALL origin mutations/handlers; delete navigate target = `/admin/tickets/opened`.
- [ ] Modify `TicketDetailPage.module.css`: add grid/sidebar/sideCard; keep conversation/reply classes.

## Phase 4 — Crear tarea from ticket (CreateTaskModal additive)
- [ ] Test: opening CreateTaskModal from a ticket prefills title/customer/description; Servicio stays EMPTY and submit is DISABLED until a service is chosen (respects origin's required-service rule).
- [ ] Test: payload includes `ticketId` only when present; omitted otherwise (BE-graceful).
- [ ] Test: existing required-service, merge vars, address autofill, templates STILL work unchanged.
- [ ] Modify `CreateTaskModal.tsx`: add `CreateTaskInitialValues` + `initialValues?` prop; seed title/customerId/customerName/description; append ticketId conditionally. Touch nothing else.
- [ ] Wire `TicketDetailPage` "Crear tarea" kebab → CreateTaskModal with `initialValues` from the ticket.

## Phase 5 — Relacionado tab (keep origin's other tabs)
- [ ] Test: TaskTabs STILL renders Detalles, Comentarios, Inventory(wired), Registro de trabajo, Actividad.
- [ ] Test: Relacionado renders linked-ticket card when `ticketId` present; empty state otherwise.
- [ ] Modify `TaskTabs.tsx`: replace ONLY Relacionado's ComingSoonPanel with `RelacionadoPanel`; add `ticketId?`/`ticketSubject?` props additively. Keep all other tabs + lazy-mount + Inventory wiring intact.
- [ ] Modify `SchedulingTaskDetailPage.tsx` parent: pass `ticketId`/`ticketSubject` from enriched task DTO (optional-chained).

## Phase 6 — Dashboard (preserve, optional touch)
- [ ] Test (optional): "Nuevo Ticket" navigates to `/admin/tickets/opened?create=1`.
- [ ] OPTIONAL Modify `TicketsDashboardPage.tsx`: only the "Nuevo Ticket" target. Leave ALL analytics/cards/tables/categorías untouched.

## Phase 7 — Verify nothing regressed
- [ ] Full test suite green.
- [ ] Manual checklist: Dashboard analytics intact; Archive/Requesters/Statuses pages intact; Inventory/Registro/Actividad tabs intact; create-task-from-ticket forces service pick; degraded mode works without tickets-actions-be.

## BE coordination (do not merge to main before tickets-actions-be is live)
- [ ] `ticketId` payload + Relacionado `ticketSubject` depend on `ScheduledTask.ticketId` FK + enriched task DTO. Ship FE in degraded mode if BE not deployed.
