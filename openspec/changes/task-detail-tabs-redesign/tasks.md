# Tasks: task-detail-tabs-redesign

**Date:** 2026-05-27
**Phase:** Tasks
**Project:** ipnext-frontend
**Artifact store:** hybrid (file + engram `sdd/task-detail-tabs-redesign/tasks`)
**Depends on:** `spec.md`, `design.md`
**Test runner:** `npx vitest run`

> STRICT TDD MODE — every implementation task is preceded by its failing-test task (red → green → refactor). Do NOT skip to green without a failing test first.

---

## Batch 1 — `Tabs` molecule lazy-mount extension

Foundation batch. All downstream consumers depend on `mountMode`/`mountedIds`. The regression guard (existing test) must stay green throughout.

- [ ] **[TEST]** Run `npx vitest run src/__tests__/components/Tabs.test.tsx` and confirm it is GREEN before any edits — this is the regression baseline.
  _Files:_ `src/__tests__/components/Tabs.test.tsx` (read-only verification)

- [ ] **[TEST-RED]** Add a new `describe('mountMode lazy')` block in `Tabs.test.tsx`:
  - `mountMode='lazy'` with a tab NOT in `mountedIds` → `queryByText(panelContent)` is null; but the `#panel-<id>` wrapper IS in the DOM.
  - After switching `activeTab` to that tab (with it now in `mountedIds`) → content appears.
  - After switching away → content stays in the DOM (`getByText` still found), panel wrapper has `display:none`.
  - Confirm `mountMode` omitted (default `'all'`) → non-active panel children still present (existing assertion, must stay green).
  _Files:_ `src/__tests__/components/Tabs.test.tsx`

- [ ] **[IMPL]** Add `mountMode?: 'all' | 'lazy'` and `mountedIds?: Set<string>` to `TabsProps`; update panel render logic: `const shouldRender = mountMode === 'all' || isActive || (mountedIds?.has(tab.id) ?? false)`. Gate only the children — keep the `<div role="tabpanel">` wrapper rendering for all tabs unconditionally.
  _Files:_ `src/components/molecules/Tabs/Tabs.tsx`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/components/Tabs.test.tsx` — all tests (old + new) GREEN.
  _Files:_ `src/__tests__/components/Tabs.test.tsx`

---

## Batch 2 — `ComingSoonPanel` component

Pure presentational; no state, no hooks, no network calls. Lock the placeholder contract before wiring it into tabs.

- [ ] **[TEST-RED]** Create `src/__tests__/scheduling/ComingSoonPanel.test.tsx`:
  - Renders `title` prop text.
  - Renders `description` prop text.
  - Renders the "Próximamente" pill/badge text (case-insensitive).
  - Renders consistently when mounted inside different wrappers (no crash).
  - No `fetch`/`axios` calls on mount (use `vi.spyOn(global, 'fetch')` to assert zero calls).
  _Files:_ `src/__tests__/scheduling/ComingSoonPanel.test.tsx`

- [ ] **[IMPL]** Create `ComingSoonPanel.tsx` and `ComingSoonPanel.module.css` (hex tokens only, no oklch):
  - Props: `{ title: string; description: string }`.
  - Renders: icon/badge, `<h3>{title}</h3>`, `<p>{description}</p>`, muted "Próximamente" pill.
  - CSS: panel padding inherited from molecule's `.panel`; minimal own styles using `var(--c-*)` and `var(--fs-*)` tokens.
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/components/ComingSoonPanel.tsx`, `ComingSoonPanel.module.css`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/scheduling/ComingSoonPanel.test.tsx` — GREEN.

---

## Batch 3 — `TaskTabs` main-panel tab orchestrator

Builds the 7-tab main panel with lazy-mount, placeholder panels, and Inventory toggle wiring. Depends on Batch 1 (lazy `Tabs`) and Batch 2 (`ComingSoonPanel`).

- [ ] **[TEST-RED]** Create `src/__tests__/scheduling/TaskTabs.test.tsx`:
  - **REQ-1 — tablist structure:** 7 tabs rendered in exact order (Detalles, Adjuntos, Comentarios, Relacionado, Inventory, Registro de trabajo, Actividad); `role="tablist"` present; Detalles has `aria-selected="true"` on load; all others `"false"`.
  - **REQ-1 — click navigation:** clicking Comentarios → Comentarios panel visible, Detalles hidden, correct `aria-selected` values.
  - **REQ-1 — ARIA controls:** each tab button has `aria-controls="panel-{id}"`; matching panel has `role="tabpanel"` and `aria-labelledby="{id}"`.
  - **REQ-1 — keyboard:** ArrowRight on last tab → first tab focused; ArrowLeft on first → last; ArrowRight on Detalles → Adjuntos.
  - **REQ-2 — lazy mount:** on load, `TaskCommentsTimeline` NOT in DOM; Adjuntos/Relacionado/Inventory/Registro/Actividad panel contents NOT in DOM.
  - **REQ-2 — first activation:** clicking Comentarios → `TaskCommentsTimeline` appears.
  - **REQ-2 — keep-alive:** click Comentarios → click Inventory → click Comentarios → `TaskCommentsTimeline` still in DOM.
  - **REQ-3 — placeholders:** clicking Adjuntos shows `ComingSoonPanel` with file-attachment copy; no `fetch` fired.
  - **REQ-3 — Relacionado, Registro, Actividad:** each shows `ComingSoonPanel` with relevant copy; no `fetch` fired.
  - **REQ-4 — Inventory toggle:** renders inventory-review toggle unchecked when `reviewedByInventory=false`; clicking calls `onInventoryToggle`; toggle checked when `reviewedByInventory=true`; panel also shows `ComingSoonPanel` for materials.
  - **REQ-4 — inventory toggle error:** when `onInventoryToggle` rejects, toggle reverts and error indicator visible.
  - **REQ-6 — Detalles content:** `DatosForm`, `UbicacionMap`, `DescriptionEditor`, `ChecklistSection` all present on load (default Detalles active, pre-mounted).
  - **REQ-6 — keep-alive after switch:** switch to Adjuntos then back to Detalles → all four components still in DOM.
  - Mock `react-leaflet` (`MapContainer`/`TileLayer`/`Marker` → stub divs). Mock TipTap. Mock `TaskCommentsTimeline`.
  _Files:_ `src/__tests__/scheduling/TaskTabs.test.tsx`

- [ ] **[IMPL]** Create `TaskTabs.tsx` and `TaskTabs.module.css`:
  - Local state: `useState<MainTabId>('detalles')` for active tab; `useState<Set<string>>(() => new Set(['detalles']))` for mounted set.
  - `handleTabChange`: update active tab + add to mounted set (immutable `new Set(prev).add(id)`).
  - `COMING_SOON` const map for all placeholder configs.
  - Build `TabDef[]` array wiring `TaskDetailsTab` for Detalles, `TaskCommentsTimeline` for Comentarios, `ComingSoonPanel` for remaining 4, Inventory panel = toggle + `ComingSoonPanel`.
  - Pass `mountMode="lazy"` + `mountedIds={mounted}` to `<Tabs>`.
  - Props forwarded from page: `detailsProps`, `commentsTaskId`, `reviewedByInventory`, `onInventoryToggle`.
  - CSS: hex tokens only, no oklch.
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs.tsx`, `TaskTabs.module.css`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/scheduling/TaskTabs.test.tsx` — GREEN.

---

## Batch 4 — `CustomerCard` enrichment (+email, +phone, +city)

Extend the card to accept and display contact data passed from the parent. Card remains presentational.

- [ ] **[TEST-RED]** Add a `describe('enriched contact data')` block in `src/__tests__/scheduling/CustomerCard.test.tsx` (or create if absent):
  - Given `email="a@b.com"` → renders a mailto link with the email.
  - Given `phone="+54911"` → renders a tel link with the phone number.
  - Given `customerCity="Rosario"` → renders the city text.
  - Given `isLoadingContact=true` → email/phone/city rows show muted "—" placeholder, not raw values.
  - Given all contact fields null after load → shows "Sin dato" for each row (no crash, no "undefined" text).
  - Given `customerId=null` → existing empty state, no crash.
  _Files:_ `src/__tests__/scheduling/CustomerCard.test.tsx`

- [ ] **[IMPL]** Extend `CustomerCardProps`:
  ```ts
  email: string | null;
  phone: string | null;
  customerCity: string | null;
  isLoadingContact?: boolean;
  ```
  Add three labeled rows below the existing name/avatar: Email (mailto link), Teléfono (tel link), Ciudad. While `isLoadingContact` render muted "—"; if field null after load show "Sin dato". Update `SideCard.module.css` to add row styles using `var(--c-*)` tokens (replace any hardcoded `#2563EB`/`#E2E8F0`/`#0F172A` literals with tokens — same visual values).
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/components/CustomerCard.tsx`, `src/pages/scheduling/SchedulingTaskDetailPage/components/SideCard.module.css`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/scheduling/CustomerCard.test.tsx` — GREEN (including pre-existing tests).

---

## Batch 5 — `ServiceCard` enrichment (+plan, +type via resolved service)

Card receives a pre-resolved `{ plan, type }` object from its parent. Parent does the `String(id)` cast matching.

- [ ] **[TEST-RED]** Add a `describe('enriched service data')` block in `src/__tests__/scheduling/ServiceCard.test.tsx` (or create if absent):
  - Given `service={ plan: 'Plan Residencial', type: 'FTTH' }` → renders plan as primary line, type as secondary muted line.
  - Given `isLoading=true` → renders "—" placeholder for both lines.
  - Given `service=null` and `serviceId="42"` → renders "Servicio #42" + "Sin detalle" (no crash).
  - Given `service=null` and `serviceId=null` → graceful empty state (nothing or "--").
  - Verify the `String(s.id) === serviceId` resolution: pass a `services` array with `id: 42` (number) and `serviceId="42"` (string) to the resolution helper and assert correct match (test the helper function directly or via the parent).
  _Files:_ `src/__tests__/scheduling/ServiceCard.test.tsx`

- [ ] **[IMPL]** Update `ServiceCardProps`:
  ```ts
  service: { plan: string; type: string } | null;
  isLoading?: boolean;
  ```
  Render plan as primary line, type as secondary muted line using `var(--c-text-muted)` token; keep existing "Ver servicio →" link. Loading → "—". No-match fallback → "Servicio #{serviceId}" + "Sin detalle". Remove any direct `useClientServices` call from inside the card — data comes from parent.
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/components/ServiceCard.tsx`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/scheduling/ServiceCard.test.tsx` — GREEN.

---

## Batch 6 — `CustomerSidebar` sidebar tab orchestrator

Owns sidebar tab state; calls `useClientDetail` and `useClientServices`; resolves enriched data; renders 3-tab sidebar. Depends on Batches 4 and 5.

- [ ] **[TEST-RED]** Create `src/__tests__/scheduling/CustomerSidebar.test.tsx`:
  - **REQ-5 — tablist:** 3 tabs in order (Detalles, Inventory, Documents); `role="tablist"`; Detalles `aria-selected="true"`.
  - **REQ-5 — Detalles panel:** `CustomerCard`, `ServiceCard`, `ReporterCard`, `WatchersChips` all present when Detalles is active.
  - **REQ-5 — customerName shown:** given `customerName="Juan"` → `CustomerCard` renders "Juan".
  - **REQ-5 — phone from hook:** mock `useClientDetail` to return `{ data: { phone: '+549', email: 'x@y.com', city: 'Rosario' }, isLoading: false }` → `CustomerCard` renders phone.
  - **REQ-5 — city shown:** city from `useClientDetail.data.city` displayed.
  - **REQ-5 — service plan:** mock `useClientServices` to return `[{ id: 7, plan: 'Plan X', type: 'FTTH' }]`; pass `serviceId="7"` → `ServiceCard` renders "Plan X".
  - **REQ-5 — String(id) match:** `serviceId="7"`, `Service.id=7` (number) → matched correctly (no raw "undefined").
  - **REQ-5 — no service:** `service` resolves to null → `ServiceCard` graceful fallback, no crash.
  - **REQ-5 — hook gated:** `customerId=null` → `useClientDetail` called with `enabled: false`; no fetch fired.
  - **REQ-5 — Inventory sidebar placeholder:** clicking Inventory tab → `ComingSoonPanel` with inventory copy, no fetch.
  - **REQ-5 — Documents placeholder:** clicking Documents tab → `ComingSoonPanel` with documents copy, no fetch.
  - **REQ-5 — ARIA on switch:** switching tabs → correct `aria-selected` and panel visibility.
  - Mock `useClientDetail` and `useClientServices` via `vi.mock('../../../hooks/useCustomers')`.
  _Files:_ `src/__tests__/scheduling/CustomerSidebar.test.tsx`

- [ ] **[IMPL]** Create `CustomerSidebar.tsx` and `CustomerSidebar.module.css`:
  - Calls `useClientDetail(customerId ?? '', { enabled: !!customerId })` and `useClientServices(customerId ?? '', !!customerId)`.
  - Resolves `service = services?.find(s => String(s.id) === serviceId) ?? null`.
  - Local state: `useState<SidebarTabId>('detalles')` (sidebar does NOT require lazy-mount per spec §Ambiguities Resolved — sidebar panels are light).
  - Renders `<Tabs>` (default `mountMode='all'`) with 3 tab panels: Detalles = `CustomerCard` + `ServiceCard` + `ReporterCard` + `WatchersChips`; Inventory = `ComingSoonPanel`; Documents = `ComingSoonPanel`.
  - Props: `customerId`, `customerName`, `customerCity`, `serviceId`, `reporterId`, `admins`, `watcherIds`, `onWatcherChange`, `isSaving`.
  - CSS: hex tokens only, no oklch.
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar.tsx`, `CustomerSidebar.module.css`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/scheduling/CustomerSidebar.test.tsx` — GREEN.

---

## Batch 7 — `TaskDetailsTab` Detalles panel shell

Pure layout shell that composes the 4 existing main-panel components. No logic — only prop forwarding and vertical layout.

- [ ] **[TEST-RED]** Create `src/__tests__/scheduling/TaskDetailsTab.test.tsx`:
  - All four components (`DatosForm`, `UbicacionMap`, `DescriptionEditor`, `ChecklistSection`) rendered within the panel.
  - Each appears in the correct vertical order (DatosForm → UbicacionMap → DescriptionEditor → ChecklistSection).
  - A prop passed to the tab (e.g. `description`) reaches `DescriptionEditor` (prop-forwarding smoke).
  - No data hooks called inside `TaskDetailsTab` — it is purely presentational.
  - Mock `react-leaflet` and TipTap.
  _Files:_ `src/__tests__/scheduling/TaskDetailsTab.test.tsx`

- [ ] **[IMPL]** Create `TaskDetailsTab.tsx` and `TaskDetailsTab.module.css`:
  - Accepts all props needed by the 4 child components (forward from page via `detailsProps` spread).
  - Renders a vertical flex container (`gap: var(--sp-4)`) containing `DatosForm`, `UbicacionMap`, `DescriptionEditor`, `ChecklistSection` in that order.
  - CSS: hex tokens only, no oklch. Panel padding inherited from molecule's `.panel` class.
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskDetailsTab.tsx`, `TaskDetailsTab.module.css`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/scheduling/TaskDetailsTab.test.tsx` — GREEN.

---

## Batch 8 — Recompose `SchedulingTaskDetailPage` + integration smoke

Recompose the page orchestrator to use the new components. All existing flows (save, toast, delete) must be unaffected.

- [ ] **[TEST-RED]** Update or create the page-level integration test `src/__tests__/scheduling/SchedulingTaskDetailPage.test.tsx` (add a new describe block if file exists):
  - `TaskHeader` renders above both tab columns.
  - `TaskTabs` renders in the main column (7 main tabs present).
  - `CustomerSidebar` renders in the sidebar column (3 sidebar tabs present).
  - The two-column layout: both `<main>` and `<aside>` are present in the DOM.
  - **REQ-6 smoke — description save:** user edits description in DescriptionEditor (Detalles tab, default), clicks save → `PATCH /api/scheduling/:id` dispatched; dirty state clears on success.
  - **REQ-6 smoke — datos form:** user changes a form field in DatosForm, submits → appropriate PATCH dispatched.
  - Toast and delete modal flows remain functional (re-run existing assertions if present).
  - No new fetch calls introduced by recompose (assert network calls against pre-existing list).
  - Mock `react-leaflet`, TipTap, `useClientDetail`, `useClientServices`.
  _Files:_ `src/__tests__/scheduling/SchedulingTaskDetailPage.test.tsx`

- [ ] **[IMPL]** Recompose `SchedulingTaskDetailPage.tsx`:
  - Keep ALL hooks and handlers in the page (data owner contract per design §1).
  - Replace the existing main-panel component block with `<TaskTabs detailsProps={…} commentsTaskId={id!} reviewedByInventory={task.reviewedByInventory} onInventoryToggle={handleInventoryReview} />`.
  - Replace the sidebar block with `<CustomerSidebar customerId={task.customerId} customerName={task.customerName} customerCity={task.customerCity} serviceId={task.serviceId} reporterId={task.reporterId} admins={admins} watcherIds={task.watcherIds} onWatcherChange={handleWatcherChange} isSaving={updateTask.isPending} />`.
  - Remove direct imports of components now delegated to `TaskTabs`/`CustomerSidebar`/`TaskDetailsTab`.
  - `useClientDetail` call moves to `CustomerSidebar` — remove from page if it was previously there (it was not; it is a new call added in this change).
  - Keep `.layout` grid, `TaskHeader`, toast, delete modal unchanged.
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/SchedulingTaskDetailPage.tsx`

- [ ] **[IMPL]** Add `map.invalidateSize()` guard in `UbicacionMap` for when the Detalles panel becomes active again after being hidden (Leaflet gray-tile risk per design §7):
  - Use a `useEffect` with a visible/hidden prop or a `whenReady` handler that calls `invalidateSize()` when the map container transitions from hidden to visible.
  _Files:_ `src/pages/scheduling/SchedulingTaskDetailPage/components/UbicacionMap.tsx`

- [ ] **[VERIFY]** Run `npx vitest run src/__tests__/scheduling/SchedulingTaskDetailPage.test.tsx` — GREEN.

- [ ] **[VERIFY]** Run `npx vitest run` (full suite) — zero regressions across all test files.

---

## Batch 9 — Acceptance guarantees (REQ-7)

Hard constraints — verifiable via codebase inspection. Run AFTER full suite is green.

- [ ] **[ACCEPTANCE — oklch]** Scan all new and modified CSS Module files for `oklch(`:
  ```
  npx vitest run  # confirm green first
  # then:
  rg "oklch\(" src/pages/scheduling/SchedulingTaskDetailPage/components/ src/components/molecules/Tabs/
  ```
  Expected result: **zero matches**. If any found → fix before closing this change.
  _Files:_ All new/modified `.module.css` files

- [ ] **[ACCEPTANCE — no new endpoints]** Scan new and modified `.tsx` files for `fetch(` and new `axios` calls:
  ```
  rg "fetch\(|axios\." src/pages/scheduling/SchedulingTaskDetailPage/components/TaskTabs.tsx src/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar.tsx src/pages/scheduling/SchedulingTaskDetailPage/components/TaskDetailsTab.tsx src/pages/scheduling/SchedulingTaskDetailPage/components/ComingSoonPanel.tsx
  ```
  Expected result: **zero matches** in the new components (data calls are only in `CustomerSidebar` via existing hooks, not raw fetch/axios).
  _Files:_ All new component `.tsx` files

- [ ] **[ACCEPTANCE — no new hook definitions calling APIs]** Confirm no new `useQuery`/`useMutation` definitions are added beyond `useClientDetail` and `useClientServices` (both pre-existing hooks, not new). A quick `rg "useQuery\|useMutation"` in the new files should show zero results — the hooks are called, not defined, inside `CustomerSidebar`.

- [ ] **[ACCEPTANCE — existing PATCH list unchanged]** Confirm the only PATCH calls in the page remain: description save, datos form save, coordinates update, checklist item CRUD, inventory-review toggle, comment add/delete, watcher add/remove. No additional PATCH/POST/DELETE introduced.

---

## Dependency summary

```
Batch 1 (Tabs lazy)
    └── Batch 3 (TaskTabs)
            └── Batch 8 (Page recompose)
Batch 2 (ComingSoonPanel)
    └── Batch 3 (TaskTabs)
    └── Batch 6 (CustomerSidebar)
Batch 4 (CustomerCard)
    └── Batch 6 (CustomerSidebar)
Batch 5 (ServiceCard)
    └── Batch 6 (CustomerSidebar)
Batch 6 (CustomerSidebar)
    └── Batch 8 (Page recompose)
Batch 7 (TaskDetailsTab)
    └── Batch 3 (TaskTabs) [wired inside]
Batch 8 (Page recompose)
    └── Batch 9 (Acceptance)
```

Batches 1, 2, 4, 5, and 7 have no mutual dependencies and can be worked in parallel. Batch 3 requires 1 + 2 + 7. Batch 6 requires 2 + 4 + 5. Batch 8 requires 3 + 6. Batch 9 requires 8.
