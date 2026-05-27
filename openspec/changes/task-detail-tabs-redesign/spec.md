# Spec: task-detail-tabs-redesign

**Date:** 2026-05-27  
**Phase:** Spec  
**Project:** ipnext-frontend  
**Artifact store:** hybrid (file + engram `sdd/task-detail-tabs-redesign/spec`)  
**Depends on:** `proposal.md`

---

## Overview

Delta specification for the `SchedulingTaskDetailPage` redesign into a two-column tabbed layout. All requirements are additive/structural — no new backend endpoints are introduced. The page orchestrator and 10 existing components are reorganized; three components are enriched; one new reusable placeholder component is introduced.

---

## REQ-1 — Main panel tab navigation

**Summary:** The main (left) panel exposes 7 tabs in a tablist. The default active tab is **Detalles**. Clicking any tab makes its panel visible and hides the others. Keyboard navigation (Arrow keys) cycles through tabs within the tablist. ARIA roles and attributes are correct at all times.

### Scenarios

**GIVEN** the user navigates to a Scheduling Task Detail page  
**WHEN** the page finishes loading  
**THEN** the main panel renders a `role="tablist"` element containing exactly 7 tab buttons: Detalles, Adjuntos, Comentarios, Relacionado, Inventory, Registro de trabajo, Actividad — in that order  
**AND** the **Detalles** tab button has `aria-selected="true"`  
**AND** all other tab buttons have `aria-selected="false"`  
**AND** the Detalles panel is visible (not hidden)

---

**GIVEN** the main panel tablist is rendered  
**WHEN** the user clicks the **Comentarios** tab  
**THEN** the Comentarios panel becomes visible  
**AND** the Detalles panel is hidden  
**AND** the Comentarios tab button has `aria-selected="true"`  
**AND** the Detalles tab button has `aria-selected="false"`  
**AND** all other tab buttons have `aria-selected="false"`

---

**GIVEN** the main panel tablist is rendered  
**WHEN** the user clicks the **Inventory** tab  
**THEN** the Inventory panel becomes visible  
**AND** the previously active panel is hidden  
**AND** only the Inventory tab button has `aria-selected="true"`

---

**GIVEN** a tab button has `aria-controls="panel-{id}"`  
**WHEN** the panel with `id="panel-{id}"` exists  
**THEN** the panel has `role="tabpanel"` and `aria-labelledby="{id}"`

---

**GIVEN** the tablist is focused on any tab button  
**WHEN** the user presses the **ArrowRight** key  
**THEN** focus moves to the next tab button in DOM order (wrapping from last to first)

---

**GIVEN** the tablist is focused on any tab button  
**WHEN** the user presses the **ArrowLeft** key  
**THEN** focus moves to the previous tab button in DOM order (wrapping from first to last)

---

## REQ-2 — Lazy-mount behavior

**Summary:** Heavy panel content is NOT mounted in the DOM until its tab is first activated. Once mounted, a panel remains in the DOM even when hidden (keep-alive). This prevents TipTap, Leaflet, and @dnd-kit from initializing on page load for tabs the user may never visit.

### Scenarios

**GIVEN** the page loads with the default Detalles tab active  
**WHEN** the DOM is inspected immediately after mount  
**THEN** the `TaskCommentsTimeline` component is NOT present in the DOM (Comentarios panel not yet mounted)  
**AND** the Adjuntos, Relacionado, Inventory, Registro de trabajo, Actividad panel contents are NOT present in the DOM

---

**GIVEN** the user has NOT yet clicked the Comentarios tab  
**WHEN** the DOM is queried for the comments timeline element  
**THEN** it is not found

---

**GIVEN** the user clicks the **Comentarios** tab for the first time  
**WHEN** the panel activates  
**THEN** `TaskCommentsTimeline` is mounted and visible in the DOM

---

**GIVEN** the user has already activated the **Comentarios** tab  
**WHEN** the user switches to the **Inventory** tab  
**AND** then switches back to the **Comentarios** tab  
**THEN** `TaskCommentsTimeline` is still present in the DOM (not unmounted)

---

**GIVEN** the user has activated the **Detalles** tab (default)  
**WHEN** the DOM is inspected  
**THEN** `DatosForm`, `UbicacionMap`, `DescriptionEditor`, and `ChecklistSection` are all present in the DOM (Detalles is mounted on first load as the default active tab)

---

**GIVEN** the user switches away from Detalles to another tab  
**WHEN** the Detalles panel is hidden  
**THEN** `DatosForm`, `UbicacionMap`, `DescriptionEditor`, and `ChecklistSection` remain in the DOM (keep-alive)

---

## REQ-3 — Placeholder tabs

**Summary:** The tabs Adjuntos, Relacionado, Registro de trabajo, and Actividad — plus the non-toggle portion of Inventory — render a reusable `ComingSoonPlaceholder` component with tab-specific copy. No data fetch is fired when these tabs are activated. The placeholder includes a title ("Próximamente") and a short description of what the tab will eventually do.

### Scenarios

**GIVEN** the user activates the **Adjuntos** tab  
**WHEN** the panel renders  
**THEN** a placeholder element is displayed containing the text "Próximamente" (case-insensitive match acceptable)  
**AND** the placeholder includes a description mentioning file attachments  
**AND** no network request to any `/attachments` or file-upload endpoint is made

---

**GIVEN** the user activates the **Relacionado** tab  
**WHEN** the panel renders  
**THEN** a placeholder element is displayed with text referencing related tasks or links  
**AND** no network request is made

---

**GIVEN** the user activates the **Registro de trabajo** tab  
**WHEN** the panel renders  
**THEN** a placeholder element is displayed with text referencing work logs or time entries  
**AND** no network request is made

---

**GIVEN** the user activates the **Actividad** tab  
**WHEN** the panel renders  
**THEN** a placeholder element is displayed with text referencing activity history or audit trail  
**AND** no network request is made

---

**GIVEN** a `ComingSoonPlaceholder` is rendered with custom `title` and `description` props  
**WHEN** the component mounts  
**THEN** both the title and the description text are visible to the user  
**AND** the component renders consistently regardless of which tab is hosting it

---

## REQ-4 — Inventory tab: toggle + placeholder

**Summary:** The Inventory tab has two sub-areas: (a) a functional `reviewedByInventory` toggle that reads the current task state and dispatches the existing `PATCH /:id/inventory-review` mutation, and (b) a placeholder for the materials list (not yet implemented). No new endpoints are called beyond the existing inventory-review PATCH.

### Scenarios

**GIVEN** a task with `reviewedByInventory = false`  
**WHEN** the user activates the **Inventory** tab  
**THEN** the inventory-review toggle is rendered and shows an unchecked / "No revisado" state

---

**GIVEN** the Inventory tab is active and the toggle is in the unchecked state  
**WHEN** the user activates the toggle  
**THEN** a `PATCH /api/scheduling/:id/inventory-review` request is dispatched  
**AND** on success the toggle reflects `reviewedByInventory = true`  
**AND** no other network request is made from this tab

---

**GIVEN** a task with `reviewedByInventory = true`  
**WHEN** the user activates the **Inventory** tab  
**THEN** the toggle is rendered in the checked / "Revisado" state

---

**GIVEN** the Inventory tab is active  
**WHEN** the panel renders  
**THEN** the materials/items area shows a `ComingSoonPlaceholder` with text referencing an inventory materials list  
**AND** no request to any inventory items endpoint is made

---

**GIVEN** the `PATCH /api/scheduling/:id/inventory-review` request fails  
**WHEN** the error is returned  
**THEN** the toggle returns to its previous state  
**AND** an error indicator is visible to the user

---

## REQ-5 — Sidebar tab navigation and enriched customer data

**Summary:** The right sidebar has its own `Tabs` instance with 3 tabs: Detalles, Inventory, Documents. The default is Detalles. The Detalles tab renders an enriched `CustomerCard` (name, email, phone, city), an enriched `ServiceCard` (plan + type), `WatchersChips`, and `ReporterCard`. Inventory and Documents tabs show `ComingSoonPlaceholder`. No new backend calls are made beyond those already used by the page.

### Scenarios

**GIVEN** the page loads  
**WHEN** the sidebar renders  
**THEN** a `role="tablist"` with exactly 3 tab buttons is present: Detalles, Inventory, Documents — in that order  
**AND** the **Detalles** tab is the default active tab (`aria-selected="true"`)

---

**GIVEN** the sidebar Detalles tab is active and the task has a `customerId` and `customerName`  
**WHEN** the `CustomerCard` renders  
**THEN** the customer name is displayed

---

**GIVEN** the task entity has `customerPhone` set  
**WHEN** the sidebar Detalles tab renders  
**THEN** the `CustomerCard` displays the phone number

---

**GIVEN** the task entity has `customerCity` set  
**WHEN** the sidebar Detalles tab renders  
**THEN** the `CustomerCard` displays the city name

---

**GIVEN** the task entity has an associated service and `useClientServices` returns a service with a plan name and service type  
**WHEN** the sidebar Detalles tab renders  
**THEN** the `ServiceCard` displays the service plan name and type (not just the raw `serviceId`)

---

**GIVEN** the task entity does NOT have a service associated  
**WHEN** the sidebar Detalles tab renders  
**THEN** the `ServiceCard` either renders nothing or renders a graceful empty state (no crash, no raw `undefined` string)

---

**GIVEN** the sidebar Detalles tab is active  
**WHEN** the panel renders  
**THEN** `WatchersChips` is visible and functional (add/remove watcher interactions work)  
**AND** `ReporterCard` is visible showing the reporter's admin name

---

**GIVEN** the user clicks the **Inventory** sidebar tab  
**WHEN** the panel activates  
**THEN** a `ComingSoonPlaceholder` is shown referencing inventory documents or stock  
**AND** no new network request is made

---

**GIVEN** the user clicks the **Documents** sidebar tab  
**WHEN** the panel activates  
**THEN** a `ComingSoonPlaceholder` is shown referencing customer documents  
**AND** no new network request is made

---

**GIVEN** the user switches between sidebar tabs  
**WHEN** each tab is activated  
**THEN** the correct panel content is visible and other panels are hidden  
**AND** ARIA attributes (`aria-selected`, `aria-controls`, `role="tabpanel"`) are correct

---

## REQ-6 — Detalles tab content integrity

**Summary:** The Detalles tab composes the four existing main-panel components. Each component continues to function exactly as before — no behavior is removed or degraded by the tab reorganization. The tab wrapper is purely structural.

### Scenarios

**GIVEN** the Detalles tab is active (default)  
**WHEN** the panel renders  
**THEN** `DatosForm`, `UbicacionMap`, `DescriptionEditor`, and `ChecklistSection` are all visible within the panel

---

**GIVEN** the Detalles tab is active  
**WHEN** the user edits the description in `DescriptionEditor` and clicks Save  
**THEN** a `PATCH /api/scheduling/:id` request is dispatched with the updated description  
**AND** the dirty state clears on success

---

**GIVEN** the Detalles tab is active  
**WHEN** the user changes a form field in `DatosForm` and submits  
**THEN** the appropriate PATCH request is dispatched  
**AND** the form reflects the saved values

---

**GIVEN** the Detalles tab is active and `UbicacionMap` is visible  
**WHEN** the user drags the map marker to a new location  
**THEN** the address field updates with the reverse-geocoded value from Nominatim  
**AND** the coordinates reflect the new marker position

---

**GIVEN** the Detalles tab is active  
**WHEN** the user adds a checklist item in `ChecklistSection`  
**THEN** the item appears in the list and the add request is dispatched  
**AND** the `AssignTemplateDialog` can still be opened and assigned without error

---

**GIVEN** the Detalles tab is active and has been previously initialized  
**WHEN** the user navigates away to another tab and returns to Detalles  
**THEN** all four components are still rendered and retain their internal state (keep-alive behavior per REQ-2)  
**AND** the Leaflet map does not break its tile layout (no zero-dimension container issue)

---

## REQ-7 — Acceptance guarantees: no oklch(), no new endpoints

**Summary:** Hard constraints that apply to the entire change — verifiable via codebase inspection and network interception. These are non-negotiable per Proposal Decision 1 and Decision 3.

### Scenarios

**GIVEN** the full diff of this change is applied  
**WHEN** all new and modified CSS Module files are scanned  
**THEN** zero occurrences of `oklch(` are found in any `.module.css` file that is new or modified by this change  
**AND** the existing `SchedulingTaskDetailPage.module.css` hex tokens (`--c-accent: #2563EB`, etc.) remain unchanged

---

**GIVEN** the full diff of this change is applied  
**WHEN** all new and modified TypeScript/TSX files are scanned  
**THEN** zero `fetch()` calls, zero new `axios` calls, and zero new custom hook definitions that call an API endpoint are introduced by this change  
**AND** the only PATCH requests fired from this page remain the pre-existing ones: description save, datos form save, coordinates update, checklist item CRUD, inventory-review toggle, comment add/delete, watcher add/remove

---

**GIVEN** the user loads the Task Detail page  
**WHEN** the browser network panel is observed during normal tab switching (including placeholder tabs)  
**THEN** no request is sent to any endpoint that was not already being called before this redesign  
**AND** activating a placeholder tab (Adjuntos, Relacionado, Registro de trabajo, Actividad) produces zero outgoing network requests

---

## Ambiguities Resolved

| Ambiguity | Resolution |
|-----------|------------|
| **CustomerCard email field** — explore.md notes email is not on the `ScheduledTask` entity, only phone and city are confirmed. | Spec treats email as conditional: if email is not available from existing entity fields or existing hooks, it is omitted from the `CustomerCard` with no error. The spec does not mandate email display — it mandates no crash when the field is absent. Design phase must confirm availability. |
| **Sidebar lazy-mount** — proposal specifies lazy-mount for the main panel; sidebar tabs are lighter (cards, chips). | Sidebar tabs are NOT required to lazy-mount (no heavy components). The lazy-mount requirement (REQ-2) applies to the main panel only. Sidebar panels may follow the existing Tabs molecule behavior (all mounted). |
| **Inventory toggle location** — proposal places the toggle in the main Inventory tab; explore.md hints it could also live in the sidebar. | Spec places `reviewedByInventory` toggle in the **main panel Inventory tab** only, per the proposal's Tab Inventory table. |
| **ReporterCard in sidebar** — proposal says "kept in the sidebar Detalles tab; final position is a design-phase detail". | Spec requires ReporterCard to be present in the sidebar Detalles tab. Exact vertical order relative to CustomerCard/ServiceCard/WatchersChips is deferred to design. |
| **Keyboard navigation mechanism** — the existing `Tabs` molecule does not implement Arrow key handling; WAI-ARIA recommends it. | REQ-1 specifies Arrow key behavior as a requirement. Whether this is implemented in the existing molecule (with an opt-in flag) or in a wrapper is a design-phase decision — but the behavior MUST be present. |
