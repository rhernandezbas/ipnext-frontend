# Design: task-detail-tabs-redesign

**Date:** 2026-05-27
**Phase:** Design
**Project:** ipnext-frontend
**Artifact store:** hybrid (file + engram `sdd/task-detail-tabs-redesign/design`)
**Depends on:** `proposal.md`, `explore.md`

---

## 0. Verified facts (read from code, not assumed)

These correct/confirm assumptions carried from explore/proposal:

1. **`ScheduledTask` has `customerName` + `customerCity` but NO `customerPhone`.** (`src/types/scheduling.ts:83-85`). The proposal/explore claimed `customerPhone` lives on the entity — **it does not**. → **Phone AND email both come from `useClientDetail(customerId)` → `Customer` (`email`, `phone`, `city`).** `customerCity` from the task is used as an instant value; the hook's `city` is the canonical fallback.
2. **`useClientDetail(id)`** (`src/hooks/useCustomers.ts:56`) returns `Customer` with `email: string`, `phone: string`, `city?: string`. Already exists, `enabled: !!id`. No new endpoint.
3. **`useClientServices(id, enabled)`** (`useCustomers.ts:65`) returns `Service[]`. `Service` (`src/types/customer.ts:3`) has `type: string`, `plan: string`, `id: number`, `description`, `status`. This is the SAME hook `DatosForm` already calls — React Query dedupes by `['client-services', id]`, so the sidebar reusing it is **free** (cache hit).
4. **GOTCHA — id type mismatch:** `task.serviceId` is `string | null`; `Service.id` is `number`. The ServiceCard must match with `String(s.id) === serviceId`, never `===` directly.
5. **`Tabs` molecule** (`src/components/molecules/Tabs/Tabs.tsx`) renders ALL panels and toggles `style={{ display }}`. Its existing test (`src/__tests__/components/Tabs.test.tsx:32-37`) asserts non-active panels are present in the DOM with `display:none`. **Any lazy behavior MUST be opt-in or this test breaks** — and so would every other consumer (e.g. CustomerDetailPage tabs).
6. **Page tokens are hex** under `.page {}` (`--c-bg`, `--c-surface`, `--c-border`, `--c-text`, `--c-text-muted`, `--c-accent #2563EB`, `--c-accent-hover`, `--c-danger`). `SideCard.module.css` currently hardcodes hex literals (`#fff`, `#E2E8F0`, `#2563EB`, …) rather than tokens. The `Tabs` molecule consumes GLOBAL `--color-*` tokens, independent of `--c-*`. No oklch anywhere.

---

## 1. Component tree & file layout

All new files live under `src/pages/scheduling/SchedulingTaskDetailPage/components/`, alongside the existing ones. `ComingSoonPanel` is the only candidate for promotion to a shared atom; given it is page-specific copy-wise, keep it local for now (note in Risks).

```
SchedulingTaskDetailPage.tsx                  (recomposed — orchestrator/data owner)
└── SchedulingTaskDetailPage/components/
    ├── TaskHeader.tsx                         (UNCHANGED — stays above tabs)
    │
    ├── TaskTabs.tsx                           (NEW) main-panel tab orchestrator
    ├── TaskTabs.module.css                    (NEW)
    │   ├── TaskDetailsTab.tsx                 (NEW) composes the 4 existing Detalles components
    │   ├── TaskDetailsTab.module.css          (NEW)
    │   └── ComingSoonPanel.tsx                (NEW) reusable placeholder  +  .module.css
    │
    ├── CustomerSidebar.tsx                    (NEW) sidebar tab orchestrator (Detalles/Inventory/Documents)
    ├── CustomerSidebar.module.css             (NEW)
    │
    ├── CustomerCard.tsx                       (MODIFIED — +email/phone/city)
    ├── ServiceCard.tsx                        (MODIFIED — +plan/type via useClientServices)
    ├── ReporterCard.tsx                       (UNCHANGED — moves into sidebar Detalles)
    ├── WatchersChips.tsx                      (UNCHANGED — moves into sidebar Detalles)
    ├── SideCard.module.css                    (extended for new card rows)
    │
    ├── DatosForm / UbicacionMap / DescriptionEditor / ChecklistSection  (UNCHANGED, slotted into TaskDetailsTab)
    ├── TaskCommentsTimeline.tsx               (UNCHANGED — becomes Comentarios panel)
    └── AssignTemplateDialog.tsx               (see §7 portal decision)
```

### Responsibility split

- **`SchedulingTaskDetailPage.tsx`** remains the single data/mutation owner. ALL hooks (`useTask`, `useUpdateTask`, mutations, `useAdmins`, `usePartners`, …) and ALL handlers (`handleFormSubmit`, `handleDescSave`, `handleWatcherChange`, …) stay here. It renders: `TaskHeader` → `.layout` grid → `<main>{<TaskTabs …/>}</main>` + `<aside>{<CustomerSidebar …/>}</aside>` → toast + delete modal (unchanged).
- **`TaskTabs`** is a presentational orchestrator: owns ONLY the active-main-tab state + the activated-set (lazy bookkeeping). It receives already-built panel content (or the props to build `TaskDetailsTab`) from the page. It does NOT call data hooks.
- **`TaskDetailsTab`** is a pure layout shell that places `DatosForm`, `UbicacionMap`, `DescriptionEditor`, `ChecklistSection` in reference order (checklist last). It forwards every prop straight through from the page — no logic.
- **`CustomerSidebar`** owns the active-sidebar-tab state; renders the enriched cards in its Detalles panel.

### Recomposed page render (illustrative)

```tsx
<div className={styles.page}>
  <TaskHeader … />              {/* unchanged, on top */}
  <div className={styles.layout}>
    <main className={styles.main}>
      <TaskTabs
        detailsProps={{ formInitial, onFormSubmit: handleFormSubmit, admins, partners,
                        currentLocation, onLocationChange: handleLocationChange,
                        description: task.description, onDescSave: handleDescSave,
                        taskId: id!, checklist: task.checklist, onError: msg => showToast(msg,'error'),
                        isSaving: updateTask.isPending, onFormDirty: setFormDirty, onDescDirty: setDescDirty }}
        commentsTaskId={id!}
        reviewedByInventory={task.reviewedByInventory}
        onInventoryToggle={handleInventoryReview}   {/* existing PATCH */}
      />
    </main>
    <aside className={styles.sidebar}>
      <CustomerSidebar
        customerId={task.customerId} customerName={task.customerName} customerCity={task.customerCity}
        serviceId={task.serviceId}
        reporterId={task.reporterId} admins={admins}
        watcherIds={task.watcherIds} onWatcherChange={handleWatcherChange}
        isSaving={updateTask.isPending}
      />
    </aside>
  </div>
  {/* toast + delete modal unchanged */}
</div>
```

---

## 2. Lazy-mount mechanism — DECISION

**Chosen: extend the `Tabs` molecule with an opt-in `mountMode` prop, defaulting to the current behavior. The PARENT (`TaskTabs`/`CustomerSidebar`) tracks the activated set; the molecule just decides whether to render a non-active panel's children.**

### API change to `Tabs.tsx` (backward compatible)

```ts
type MountMode = 'all' | 'lazy';   // 'all' = current behavior (default)

interface TabsProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
  mountMode?: MountMode;          // NEW — defaults to 'all'
  mountedIds?: Set<string>;       // NEW — only consulted when mountMode === 'lazy'
}
```

Panel render logic:

```tsx
{tabs.map((tab) => {
  const isActive = tab.id === activeTab;
  const shouldRender =
    mountMode === 'all' || isActive || (mountedIds?.has(tab.id) ?? false);
  return (
    <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={tab.id}
         hidden={!isActive}                       /* a11y + display:none */
         style={{ display: isActive ? 'block' : 'none' }} className={styles.panel}>
      {shouldRender ? tab.content : null}
    </div>
  );
})}
```

The `<div>` panel wrapper still renders for every tab (so `aria-controls`/tablist semantics and the existing "panel exists with display:none" test stay green). Only the **children** are gated. With `mountMode='all'` (default), `shouldRender` is always true → byte-for-byte identical behavior for CustomerDetailPage and every other current consumer. The existing `Tabs.test.tsx` passes untouched.

### Why this over the alternatives

- **vs. a wrapper component (`LazyTabs`):** a wrapper would duplicate the tablist/ARIA wiring or wrap-and-strip content, and we'd maintain two tab implementations. Extending the one molecule keeps a single source of truth for accessibility. The opt-in prop is ~6 lines and fully backward compatible.
- **vs. "parent renders only the active panel":** that pushes tablist rendering responsibility up and loses the molecule's a11y guarantees; also makes "stays mounted after first visit" awkward (parent would have to render N panels itself).

### Activated-set bookkeeping (in `TaskTabs` / `CustomerSidebar`)

```tsx
const [activeTab, setActiveTab] = useState('detalles');
const [mounted, setMounted] = useState<Set<string>>(() => new Set(['detalles'])); // default tab pre-mounted
const handleTabChange = (id: string) => {
  setActiveTab(id);
  setMounted(prev => prev.has(id) ? prev : new Set(prev).add(id)); // immutable add
};
// <Tabs mountMode="lazy" mountedIds={mounted} activeTab={activeTab} onTabChange={handleTabChange} tabs={…} />
```

Once a tab is in `mounted`, it stays (TipTap/Leaflet/dnd-kit state persists across tab switches). Heavy panels never initialize until first activation.

---

## 3. Prop contracts

### `CustomerCard` (MODIFIED)

```ts
interface CustomerCardProps {
  customerId: string | null;
  customerName: string | null;
  customerCity: string | null;   // from task.customerCity (instant)
  email: string | null;          // from useClientDetail (async)
  phone: string | null;          // from useClientDetail (async)
  isLoadingContact?: boolean;     // useClientDetail.isLoading — render skeleton/em-dash rows
}
```

- **Where the data comes from:** `customerName`/`customerCity` are threaded from `ScheduledTask`. `email`/`phone` are NOT on the entity → fetched via `useClientDetail(customerId ?? '')` **inside `CustomerSidebar`** (not inside the card — keep the card presentational). City prefers `task.customerCity`, falls back to `customer.city`.
- Renders name + avatar (existing) plus three labeled rows: Email (mailto link), Teléfono (tel link), Ciudad. While `isLoadingContact`, show muted "—". If a field is empty after load, show "Sin dato".
- The `useClientDetail` call is gated `enabled: !!customerId`, so no fetch when the task has no customer.

### `ServiceCard` (MODIFIED)

```ts
interface ServiceCardProps {
  serviceId: string | null;
  customerId: string | null;
  service: { plan: string; type: string } | null;  // resolved by parent
  isLoading?: boolean;
}
```

- **Where the data comes from:** `CustomerSidebar` calls `useClientServices(customerId ?? '', !!customerId)` (cache-shared with DatosForm) and resolves `service = services.find(s => String(s.id) === serviceId) ?? null` (note the `String()` cast — §0.4). Passes the matched `{plan, type}` down.
- Renders plan as the primary line, type as a secondary muted line, keeps the existing "Ver servicio →" link. While loading → "—". If `serviceId` set but no match → "Servicio #{serviceId}" + "Sin detalle".

### `ComingSoonPanel` (NEW reusable placeholder)

```ts
interface ComingSoonPanelProps {
  title: string;        // e.g. "Adjuntos"
  description: string;  // teaching copy: what this tab WILL do
}
```

- Pure presentational: an icon/badge, `<h3>{title}</h3>`, `<p>{description}</p>`, and a muted "Próximamente" pill. No data, no state. Used by Adjuntos, Relacionado, Registro de trabajo, Actividad, and (with the inventory toggle alongside) Inventory.

---

## 4. Tab configuration & state

### Typed config

```ts
type MainTabId = 'detalles' | 'adjuntos' | 'comentarios' | 'relacionado' | 'inventory' | 'registro' | 'actividad';
type SidebarTabId = 'detalles' | 'inventory' | 'documents';

// Placeholder copy lives in a const map so panels are declarative:
const COMING_SOON: Record<string, ComingSoonPanelProps> = {
  adjuntos:   { title: 'Adjuntos',   description: 'Subí y gestioná archivos adjuntos de la tarea. Próximamente.' },
  relacionado:{ title: 'Relacionado',description: 'Vinculá tareas u órdenes relacionadas. Próximamente.' },
  registro:   { title: 'Registro de trabajo', description: 'Registrá tiempos y entradas de trabajo. Próximamente.' },
  actividad:  { title: 'Actividad',  description: 'Historial de eventos y auditoría de la tarea. Próximamente.' },
  sidebarInventory: { title: 'Inventory', description: 'Materiales y equipos asignados. Próximamente.' },
  documents:  { title: 'Documents',  description: 'Documentos del cliente. Próximamente.' },
};
```

`TaskTabs` builds the `TabDef[]` array mapping each id → its content node (real component or `<ComingSoonPanel {...COMING_SOON.x}/>`). Inventory main tab = `<ComingSoonPanel/>` + the existing `reviewedByInventory` toggle wired to the existing `PATCH /:id/inventory-review`.

### State

- **Active main tab:** local `useState<MainTabId>('detalles')` in `TaskTabs`. Default Detalles.
- **Active sidebar tab:** local `useState<SidebarTabId>('detalles')` in `CustomerSidebar`. Default Detalles.
- **Activated sets:** one per orchestrator (§2).

### URL hash sync — RECOMMENDATION: **NO (defer).**

Reasoning: it adds router coupling (`useSearchParams`/hash), edge cases (invalid hash, back-button vs. tab state, interaction with the existing `beforeunload` dirty guard), and the proposal scope is a presentation reorg. Tabs are local UI state. Mark hash-deeplinking as a **future enhancement**, not part of this change. (If product later wants shareable tab links, it's an isolated follow-up: read `?tab=` on mount, push on change.)

---

## 5. Styling

- **CSS Modules only**, one per new component. No Tailwind. **Hex `--c-*` tokens only; zero `oklch()`.**
- **Tokens to reuse** (already defined on `.page`): `--c-surface`, `--c-bg`, `--c-border`, `--c-text`, `--c-text-muted`, `--c-accent`, `--c-accent-hover`, `--c-danger`, the `--fs-*` and `--sp-*` scales. New CSS Modules should consume these via inheritance (they cascade from `.page`). When refactoring `SideCard.module.css`, prefer replacing hardcoded literals (`#2563EB` → `var(--c-accent)`, `#E2E8F0` → `var(--c-border)`, `#0F172A` → `var(--c-text)`) — same values, now tokenized. (Low-risk cleanup; keep it scoped so visuals don't shift.)
- **`Tabs` molecule styling** stays as-is (global `--color-*`); we do not touch `Tabs.module.css`.
- **Responsive:** keep the existing breakpoints in `SchedulingTaskDetailPage.module.css`. The `.layout` grid already collapses `8fr 4fr` → `9fr 3fr` (≤1279px) → single column with `.sidebar { order: 2 }` (≤1023px). On narrow screens the sidebar (`CustomerSidebar` tabs) stacks UNDER the main `TaskTabs` — no change needed. The `.tabList` in the molecule already has `overflow-x: auto`, so the 7 main tabs scroll horizontally on small viewports.
- `ComingSoonPanel`/`TaskDetailsTab` get minimal module CSS: panel padding is already supplied by the molecule's `.panel`; `TaskDetailsTab` just needs a vertical flex stack with `gap: var(--sp-4)` mirroring the old `.main`.

---

## 6. Testing approach (Vitest + Testing Library, STRICT TDD: red → green → refactor)

Hooks are mocked with `vi.mock` per the existing customer test patterns (e.g. `useClientDetail`/`useClientServices` mocked to return `{ data, isLoading }`). Mock `react-leaflet` (`MapContainer`/`TileLayer`/`Marker` → stub divs) and TipTap as the existing UbicacionMap/DescriptionEditor tests already do, so heavy panels are inert in jsdom.

**Test-first ordering:**

1. **`Tabs` molecule lazy extension (FIRST — it's the foundation & the regression risk).**
   - RED: default (`mountMode` omitted) → non-active panel children STILL in DOM (the existing `Tabs.test.tsx` must keep passing — run it first as the guard).
   - `mountMode='lazy'` + `mountedIds` not containing a tab → that tab's CONTENT is absent from DOM (`queryByText(...)` is null), but the `panel-<id>` wrapper still exists.
   - After `activeTab` switches to it (and it's added to `mountedIds`) → content appears; switching away → content STAYS (panel wrapper `display:none` but children present).

2. **`ComingSoonPanel`** — renders `title`, `description`, the "Próximamente" pill. Trivial, pure. (Quick green to lock the placeholder contract.)

3. **`TaskTabs` orchestration** — renders 7 tabs, default active = Detalles, Detalles content present on mount, placeholders NOT mounted until clicked; clicking Adjuntos shows its ComingSoonPanel; clicking Comentarios mounts `TaskCommentsTimeline` (mocked) and it persists after switching back to Detalles. Inventory tab: toggle calls `onInventoryToggle`.

4. **`CustomerCard` enriched** — given `email`/`phone`/`customerCity`, renders mailto/tel links + city; `isLoadingContact` → muted placeholders; null customer → existing empty state.

5. **`ServiceCard` enriched** — given matched `service` → plan primary + type secondary; `String(id)` matching covered by passing a numeric-id service list resolved by parent (test the parent resolution too); no-match → fallback line.

6. **`CustomerSidebar`** — 3 tabs, default Detalles shows CustomerCard+ServiceCard+ReporterCard+WatchersChips; mocks `useClientDetail`/`useClientServices`; Inventory/Documents tabs show ComingSoonPanel (lazy). Verify `useClientDetail` is gated when `customerId` is null.

7. **Page integration (last)** — `SchedulingTaskDetailPage` renders TaskHeader on top + both tab columns; existing save/toast/delete flows untouched (smoke).

---

## 7. Risks & migration notes

| Risk | Mitigation |
|------|------------|
| **Leaflet sized inside a lazy panel.** With lazy mount, `UbicacionMap` only mounts when Detalles activates. Detalles is the DEFAULT tab → it mounts visible on first paint, so the original hidden-container bug is AVOIDED by default. BUT if the user switches away and back, the panel wrapper toggles `display:none`↔`block` while the map stays mounted → Leaflet may render gray tiles. | Add `map.invalidateSize()` on panel re-show. Cleanest: a tiny `whenReady`/`useMap` effect inside UbicacionMap that calls `invalidateSize()` when the Detalles tab becomes active again. Since Detalles is default + pre-mounted, this is an edge case; implement the `invalidateSize` guard but it is low-frequency. |
| **`customerPhone` assumed but absent on entity.** | Confirmed: phone+email via `useClientDetail`. No new endpoint. Documented in §0.1, §3. |
| **`Service.id` is number, `task.serviceId` is string.** | Match with `String(s.id) === serviceId`. Covered by a dedicated test (§6.5). |
| **Lazy regressing other `Tabs` consumers.** | `mountMode` defaults to `'all'` — existing consumers + existing test unaffected. Regression guard test runs first (§6.1). |
| **ReporterCard placement.** | Stays in the sidebar **Detalles** tab (after ServiceCard, before WatchersChips). Not removed, not merged. |
| **`AssignTemplateDialog` div-overlay vs portal.** | It is internal to `ChecklistSection`, which now lives inside the Detalles panel (a `display:none`-toggled container when another tab is active). A div-overlay rendered inside a `display:none` ancestor would be invisible. Since the dialog only opens while Detalles is active, it's functionally fine TODAY. **Recommendation:** convert its overlay to a `createPortal(…, document.body)` as a small, isolated hardening step so it can never be trapped by an ancestor's `display:none` or stacking context. Low risk, scoped to that one component. The existing delete-confirm modal on the page already uses an inline overlay at page root (outside the tabs), so it is unaffected. |
| **ComingSoonPanel as atom vs local.** | Keep local to this page for now (page-specific copy). Promote to `components/atoms/` only if a second feature needs it. |

---

## 8. Backward-compatibility checklist

- `Tabs` public API: only ADDED optional props (`mountMode?`, `mountedIds?`). No breaking change.
- `Tabs.test.tsx`: unchanged, still green (default mountMode='all', panel wrappers still rendered).
- Page data layer: no hooks moved out of the page; `useClientDetail` is the only NEW hook call, gated and cache-friendly.
- No backend calls added beyond `useClientDetail` (already used elsewhere) and the existing `useClientServices` / `inventory-review` PATCH.
- Zero `oklch()` added; hex `--c-*` tokens only.
