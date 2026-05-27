# Proposal: task-detail-tabs-redesign

**Date:** 2026-05-27
**Phase:** Propose
**Project:** ipnext-frontend
**Artifact store:** hybrid (file + engram `sdd/task-detail-tabs-redesign/proposal`)
**Type:** Frontend redesign — no backend work

---

## 1. Intent

Redesign the Scheduling Task Detail page (`src/pages/scheduling/SchedulingTaskDetailPage.tsx`) into a **two-column, tabbed layout** matching the Splynx reference:

- **Left main panel** with tabs: **Detalles · Adjuntos · Comentarios · Relacionado · Inventory · Registro de trabajo · Actividad**.
- **Right Customer/lead sidebar** with tabs: **Detalles · Inventory · Documents**, surfacing customer email/phone plus a Servicio section.

`TaskHeader` stays above the tab layout, unchanged.

The page today already stacks all components in a flat `8fr 4fr` grid. This redesign reorganizes that content into tabs using the **existing** accessible `Tabs` molecule (`src/components/molecules/Tabs/Tabs.tsx`), enriches the sidebar customer/service cards using **existing hooks only**, and adds clear "próximamente" placeholders for the tabs that have no backend.

This is a **presentation-layer reorganization**, not a feature with new data. No new endpoints, no schema changes.

---

## 2. Decisions

### Decision 1 — Token strategy: KEEP HEX consistently (no OKLCH migration)

The current `SchedulingTaskDetailPage.module.css` defines its `.page {}` tokens in **hex** (`--c-accent: #2563EB`). Although DESIGN.md cites scheduling as the OKLCH example, the live page is hex-only.

**Decision: keep this page on HEX for the redesign.** Do NOT introduce OKLCH anywhere on this page.

**Justification:**
- **Lower risk, focused scope.** The brief explicitly FORBIDS mixing hex + OKLCH on one page. Migrating to OKLCH means re-deriving every `--c-*` token and re-verifying every component's color output — a separate, page-wide visual change that is orthogonal to "add tabs". Bundling it inflates the blast radius and the review surface.
- **Atomic, reversible change.** A tab reorganization should not also be a color-system migration. If OKLCH alignment is desired, it should be its own change (`scheduling-detail-oklch-migration`) with its own visual QA.
- **The `Tabs` molecule uses global tokens** (`--color-accent`, `--color-border`, `--color-text-*`), which are independent of the page's local `--c-*` hex tokens. The molecule inherits global tokens regardless of the page's local palette, so no conflict is introduced by reusing it.

**Explicit non-mixing guarantee:** every new component and every CSS Module touched in this change uses ONLY the existing hex `--c-*` tokens (or the global `--color-*` tokens already consumed by shared molecules). Zero `oklch()` declarations are added on this page.

### Decision 2 — Lazy-mount active panel only

The `Tabs` molecule currently mounts ALL panels at once (`display: block/none`). For this page that means TipTap (DescriptionEditor) and Leaflet (UbicacionMap) initialize on every page load even when the user never opens those tabs — wasteful, and Leaflet in particular misbehaves when sized while hidden (`display:none` containers report zero dimensions).

**Decision: mount the active panel only (lazy mount), keeping mounted panels alive once visited.** Heavy panels (TipTap, Leaflet, `@dnd-kit` checklist) initialize on first activation, not on page load.

**Justification:** avoids initializing heavy editors/maps that may never be opened, and sidesteps the Leaflet hidden-container sizing bug. The design phase decides the exact mechanism (extend the `Tabs` molecule with an opt-in `lazy`/`mountMode` prop vs. a thin wrapper) so the shared molecule's default behavior is not broken for other consumers.

### Decision 3 — Sidebar enrichment via existing hooks only

- **CustomerCard**: expand to show **email, phone, city**. `ScheduledTask.customerPhone` and `customerCity` already exist on the domain entity (derived via JOIN) and just need prop threading. If email is not on the entity, it comes from the existing customer hook already used elsewhere — **no new endpoint**.
- **ServiceCard**: show **plan + type** via `useClientServices` (the same hook `DatosForm` already uses), replacing the raw `serviceId`.

No new data sources. If a field genuinely cannot be sourced from existing hooks/entity, it is omitted (and noted in design), not backfilled with a new endpoint.

### Decision 4 — Placeholder tabs teach, not blank

Tabs with no backend (Adjuntos, Relacionado, Registro de trabajo, Actividad) and the partial Inventory tab render a **clear "próximamente" placeholder** that states what the tab WILL do, not an empty void. A single reusable placeholder presentation (atom/molecule) is used so all placeholders are consistent.

---

## 3. Tab Inventory & Content Mapping

### Main panel tabs (left)

| Tab | Backend | Content | Status |
|-----|---------|---------|--------|
| **Detalles** | Full | `DatosForm` + `UbicacionMap` + `DescriptionEditor` + `ChecklistSection` (checklist at the bottom) | Functional — all components reused as-is |
| **Adjuntos** | None | "próximamente" placeholder explaining file attachments are coming | Placeholder |
| **Comentarios** | Full | `TaskCommentsTimeline` (reused as-is) | Functional |
| **Relacionado** | None | "próximamente" placeholder for related tasks/links | Placeholder |
| **Inventory** | Partial | "próximamente" placeholder + the `reviewedByInventory` boolean toggle (existing `PATCH /:id/inventory-review`) | Partial: toggle works, materials list is placeholder |
| **Registro de trabajo** | None | "próximamente" placeholder for work log / time entries | Placeholder |
| **Actividad** | None | "próximamente" placeholder for the audit/event stream | Placeholder |

**Default active tab:** Detalles.

### Sidebar tabs (right)

| Tab | Content | Status |
|-----|---------|--------|
| **Detalles** | Enriched `CustomerCard` (name, email, phone, city) + Servicio section via enriched `ServiceCard` (plan + type) + `WatchersChips` (reused as-is) | Functional |
| **Inventory** | "próximamente" placeholder | Placeholder |
| **Documents** | "próximamente" placeholder | Placeholder |

**ReporterCard placement:** kept in the sidebar Detalles tab (reporter is customer/context metadata). Final exact position is a design-phase detail; it is NOT removed.

---

## 4. Scope Boundaries

### IN scope (frontend only)
- Restructure `SchedulingTaskDetailPage.tsx` into two-column tabbed layout using the existing `Tabs` molecule for BOTH columns.
- Lazy-mount active panel (Decision 2) without breaking the shared molecule's default for other pages.
- Enrich `CustomerCard` (email/phone/city) and `ServiceCard` (plan/type) via existing entity fields + `useClientServices`.
- Reusable "próximamente" placeholder component for backend-less tabs.
- All new/changed styling via CSS Modules, hex tokens only, no Tailwind. Any new dropdown/modal uses a React portal.
- Vitest + Testing Library tests, strict TDD (test first) for the new tab orchestration, placeholder, and enriched cards.

### OUT of scope (explicitly — NO backend work in this change)
- Attachments upload/storage (`TaskAttachment` model, file upload endpoint, S3/CDN) — Adjuntos stays placeholder.
- Related-tasks / linked-issues model and endpoints — Relacionado stays placeholder.
- Work-log / time-entry model and endpoints — Registro de trabajo stays placeholder.
- Per-task activity/audit-log model and event stream — Actividad stays placeholder.
- Inventory materials/items model — only the existing `reviewedByInventory` boolean is wired; the rest stays placeholder.
- Any OKLCH token migration (deferred to a separate change).
- Any change to `TaskHeader` behavior beyond it sitting above the tabs.

**This change MUST NOT require any backend modification.** If implementation reveals a missing field, the resolution is "omit + note", never "add an endpoint".

---

## 5. Approach (high level — detail deferred to design)

1. **Reuse the `Tabs` molecule** for both the main panel and the sidebar. Adapt it (or wrap it) for lazy mounting per Decision 2.
2. **Detalles tab** composes the four existing main-panel components in reference order; **Comentarios tab** wraps `TaskCommentsTimeline`. Both are pure recompositions of existing, working components.
3. **Placeholder component** (reusable) for the five backend-less / partial panels, each with tab-specific copy.
4. **Sidebar** = enriched `CustomerCard` + `ServiceCard` + `WatchersChips` + `ReporterCard` under a sidebar `Tabs` instance (Detalles/Inventory/Documents).
5. **Inventory toggle** (sidebar or main Inventory tab) wires the existing `reviewedByInventory` PATCH; everything else there is placeholder.
6. Keep `AssignTemplateDialog` working; if the portal constraint requires it, converting its div-overlay to a React portal is a design-phase call (low risk, isolated to ChecklistSection).

---

## 6. What the next phases must cover

### Spec (`sdd-spec`)
- Requirements + scenarios for: tab navigation (keyboard a11y via existing `role=tablist/tab/tabpanel`), default tab, lazy-mount behavior (panel not in DOM until first activated, stays mounted after), placeholder content per tab, enriched CustomerCard/ServiceCard fields, sidebar tab switching.
- Explicit acceptance criterion: NO `oklch()` on this page; NO new backend calls beyond those already in use.

### Design (`sdd-design`)
- Exact lazy-mount mechanism: extend `Tabs` with an opt-in prop vs. wrapper component (must not regress other `Tabs` consumers).
- Component tree + file layout under `SchedulingTaskDetailPage/components/` for the new tab containers and the placeholder component (atomic-design placement).
- CustomerCard/ServiceCard prop contracts and exactly which entity fields / hook outputs feed them (confirm email availability).
- ReporterCard final placement.
- AssignTemplateDialog portal decision.
- CSS Module token list (hex `--c-*`) to be reused; confirm zero OKLCH.

### Tasks (`sdd-tasks`)
- TDD-ordered checklist: test-first for tab orchestration, placeholder, lazy-mount, enriched cards, sidebar tabs. Mechanical breakdown of the recomposition vs. the new components.

---

## 7. Risks (carried from explore)

| Risk | Severity | Mitigation in this change |
|------|----------|---------------------------|
| 4 backend-less tabs + partial Inventory | HIGH | "próximamente" placeholders (Decision 4); scope explicitly excludes backend |
| Lazy-mount regressing other `Tabs` consumers | MEDIUM | Opt-in prop / wrapper, default behavior unchanged (design phase) |
| Leaflet sized while hidden | MEDIUM | Lazy mount initializes map only when Detalles is active |
| CustomerCard email availability | LOW | Confirm in design; omit if not sourceable, never add endpoint |
| AssignTemplateDialog div-overlay vs portal | LOW | Isolated refactor if portal constraint applies |
