# Explore: task-detail-tabs-redesign

**Date:** 2026-05-27  
**Scope:** Frontend repo (`ipnext-frontend`). Investigation only — no production code written.

---

## 1. Current Implementation Map

### Entry point
`src/pages/scheduling/SchedulingTaskDetailPage.tsx`

Two-column layout (`8fr 4fr` grid) already in place:
- `<main>` (left): stacks DatosForm → UbicacionMap → DescriptionEditor → ChecklistSection → TaskCommentsTimeline
- `<aside>` (right): stacks CustomerCard → ServiceCard → ReporterCard → WatchersChips

### Component inventory

| Component | File | What it renders | Notes |
|-----------|------|-----------------|-------|
| **TaskHeader** | `TaskHeader.tsx` | Breadcrumbs, editable h1 title, stage dropdown, priority dropdown, kebab menu (close/delete/duplicate-disabled) | No tabs; standalone sticky header. |
| **DatosForm** | `DatosForm.tsx` | Assignee, Partner, Servicio (from customer services), Inicia/Termina (datetime-local), Tiempo de ida/vuelta. Uses `react-hook-form` + `useClientServices`. | Covers the "Detalles" form fields of the reference. |
| **UbicacionMap** | `UbicacionMap.tsx` | Address text input + Leaflet map + draggable marker + geocoding via Nominatim. | Belongs inside the Detalles tab. |
| **DescriptionEditor** | `DescriptionEditor.tsx` | Rich-text editor via TipTap `StarterKit`. Save button, dirty tracking. | Belongs inside the Detalles tab. |
| **ChecklistSection** | `ChecklistSection.tsx` | Drag-sortable checklist via `@dnd-kit`; add/toggle/edit/delete/clear items; assign-template dialog (React portal via `AssignTemplateDialog`). | Currently rendered in main panel; will move inside Detalles or as its own tab — decision for design phase. |
| **TaskCommentsTimeline** | `TaskCommentsTimeline.tsx` | Lists comments (authorName, body, date, attachments-as-links); add-comment form with attachment rows. Uses `useTaskComments` / `useAddTaskComment` / `useDeleteTaskComment`. | Maps directly to the "Comentarios" tab. |
| **CustomerCard** | `CustomerCard.tsx` | Shows customerName + link to `/admin/customers/view/:id`. Name only — no phone/email. | Needs enrichment (phone, email) for sidebar redesign. |
| **ServiceCard** | `ServiceCard.tsx` | Shows raw serviceId + link to customer#servicios. Very thin — just the ID. | Needs full service info (plan, type) for sidebar. |
| **ReporterCard** | `ReporterCard.tsx` | Shows reporter admin name by looking up in `allAdmins[]`. | Sidebar only; role unclear in new layout. |
| **WatchersChips** | `WatchersChips.tsx` | Chips per watcher with remove; popover search to add admins. | Sidebar only; will remain in sidebar. |
| **AssignTemplateDialog** | `AssignTemplateDialog.tsx` | Modal (div overlay, not portal) for assigning a checklist template. | Internal to ChecklistSection. |

---

## 2. Tab → Backend Support Table

| Reference Tab | Backend Exists? | Endpoint / Field | Maps to existing component |
|---------------|-----------------|-----------------|---------------------------|
| **Detalles** | YES (full) | `GET/PATCH /api/scheduling/:id` → `ScheduledTask` fields: title, description, startDate, endDate, assigneeId, partnerId, serviceId, address, coordinates, travelTimeTo, travelTimeFrom, priority, stageId | DatosForm + DescriptionEditor + UbicacionMap (all reusable) |
| **Adjuntos** | NO | No `TaskAttachment` model in schema; no attachment upload endpoint. Comments can store attachment links (url+filename) but there is no dedicated attachment upload/storage. | None |
| **Comentarios** | YES (full) | `GET /api/scheduling/:taskId/comments` `POST /api/scheduling/:taskId/comments` `DELETE /api/scheduling/comments/:commentId` → `TaskComment` + `TaskCommentAttachment` models | TaskCommentsTimeline (reusable as-is) |
| **Relacionado** | NO | No related-tasks, linked-issues, or cross-task relation fields in schema or routes. | None |
| **Inventory** | PARTIAL | `PATCH /api/scheduling/:id/inventory-review` → `ScheduledTask.reviewedByInventory` flag (boolean only). No inventory items/materials model attached to tasks. | ChecklistSection (loosely related); no dedicated component. |
| **Registro de trabajo** | NO | No `WorkLog`, `TimeEntry`, or similar model in schema. No work-log routes. | None |
| **Actividad** | NO | No activity/audit log per task in schema (only `AdminActivityLog` per admin, unrelated). `ScheduledTask.updatedAt` exists but no event stream. | None |

### ScheduledTask fields of particular note
- `iclassOrderCode` — IClass external reference; shown in header area but not yet in a dedicated tab.
- `reviewedByInventory` — the only inventory-related field; currently surfaced via `PATCH /:id/inventory-review`.
- `checklist[]` — full CRUD; belongs in Detalles or a dedicated sub-section.
- `watchers[]` — pivot table; WatchersChips covers this.
- Comments have `attachments[]` (url + filename stored as `TaskCommentAttachment`), but no binary upload — links only.

---

## 3. Tabs Component Status

**EXISTS** at `src/components/molecules/Tabs/Tabs.tsx`.

API:
```ts
interface TabDef { id: string; label: string; content: ReactNode; }
interface TabsProps { tabs: TabDef[]; activeTab: string; onTabChange: (id: string) => void; }
```

Behavior:
- Renders a `role="tablist"` bar with buttons; one `role="tabpanel"` per tab.
- Active tab uses `border-bottom` highlight in `--color-accent`.
- Panel visibility controlled via `display: block/none` (all panels always mounted).
- CSS tokens used: `--color-border`, `--color-text-secondary`, `--color-text-primary`, `--color-accent` — these are **global design tokens**, not page-local OKLCH tokens.

**Adaptation needed:** The Tabs component itself is solid and reusable as-is. However:
1. The token names (`--color-accent`, `--color-border`) must remain consistent — the page's `.module.css` currently uses **hex** values for `--c-accent` (#2563EB) rather than OKLCH. The redesign must NOT introduce OKLCH on the same page where hex is used — or it must migrate ALL page tokens to OKLCH in one shot.
2. The `Tabs` molecule mounts all panels at once (no lazy rendering). For tabs with heavy components (map, editor), this could cause unnecessary work. Consider adding lazy mounting in the design phase.
3. The sidebar also needs its own tabs ("Detalles / Inventory / Documents") — the same `Tabs` molecule can serve there too.

---

## 4. CSS / Token Constraints

- **CSS Modules per component** — each component has its own `.module.css`. No Tailwind/utility classes anywhere in this page or its components. Enforce strictly.
- **Current page token system:** The `SchedulingTaskDetailPage.module.css` defines tokens under `.page {}` using **hex** (`--c-accent: #2563EB`). It does NOT use OKLCH yet.
- **Constraint from brief:** scheduling pages use OKLCH tokens (brand terracotta `oklch(56% 0.2 25)`), and hex and OKLCH must NOT be mixed on the same page.
- **Gap identified:** The current page already uses hex exclusively. The redesign must choose one of:
  - Migrate all tokens in `.page {}` to OKLCH (breaking change for existing CSS custom props — medium risk).
  - Keep hex for this page and NOT introduce OKLCH (safer, stays consistent with current state).
  - The design phase must make this call explicitly.
- **Tabs molecule tokens** (`--color-border`, `--color-text-secondary`, etc.) are global — they come from somewhere upstream (likely `:root` in a global CSS file). The Tabs component will inherit whatever the page provides.

---

## 5. Sidebar Customer Data Gap

The reference sidebar shows customer **email** and **phone**. Currently:
- `CustomerCard` only receives `customerId` and `customerName` — no phone/email props.
- `ScheduledTask.customerPhone` exists in the domain entity (derived via JOIN) but it is **not passed to CustomerCard** today.
- `customerCity` is also available on the entity.
- To show phone/email in the sidebar, `CustomerCard` props need to expand, OR a new `useCustomer(id)` hook call is added inside the card.

---

## 6. Risks and Constraints

| Risk | Severity | Notes |
|------|----------|-------|
| **4 of 6 non-Detalles tabs have no backend** (Adjuntos, Relacionado, Registro de trabajo, Actividad) | HIGH | Must show "próximamente" placeholder. Decision already made by user. |
| **Inventory tab is only partial** | MEDIUM | Only a boolean flag (`reviewedByInventory`). No items/materials model. Placeholder + the flag toggle is the max possible. |
| **Token system mismatch (hex vs OKLCH)** | MEDIUM | Current page uses hex. Must decide and apply consistently before adding new components. |
| **Tabs molecule mounts all panels** | LOW | All tab content (map, TipTap, DnD list) initializes on load. Could add lazy-mount in design phase. |
| **CustomerCard needs enrichment** | LOW | `customerPhone` exists on the entity — just needs prop threading. |
| **ServiceCard renders raw serviceId** | LOW | Needs service plan + type from `useClientServices` — hook already exists, used in DatosForm. |
| **ChecklistSection placement** | LOW | Currently in main panel (not in any tab). Must decide if it stays inside Detalles tab or gets its own tab. Reference screenshot implies it belongs under Detalles. |
| **AssignTemplateDialog uses div overlay** | LOW | Not a React portal. If portal pattern is required (per brief), this needs refactoring alongside the redesign. |
| **No attachment upload infrastructure** | HIGH | Adjuntos tab cannot be functional without a backend file storage solution (S3/CDN + upload endpoint). Shows "próximamente". |
| **No work log model** | HIGH | Registro de trabajo tab cannot be functional without a new domain model. Shows "próximamente". |
| **No activity/audit log per task** | HIGH | Actividad tab cannot be functional. Shows "próximamente". |

---

## 7. Reusability Summary

| Component | Status for Redesign |
|-----------|---------------------|
| TaskHeader | Reusable as-is — sits above the tab layout, unaffected |
| DescriptionEditor | Reusable as-is — slot into Detalles tab |
| DatosForm | Reusable as-is — slot into Detalles tab |
| UbicacionMap | Reusable as-is — slot into Detalles tab |
| ChecklistSection | Reusable as-is — slot into Detalles tab (likely at bottom) |
| TaskCommentsTimeline | Reusable as-is — becomes the Comentarios tab content |
| CustomerCard | Needs adaptation — expand props (phone, email, city) |
| ServiceCard | Needs adaptation — show plan+type via useClientServices |
| ReporterCard | Needs decision — keep in sidebar or merge into CustomerCard area |
| WatchersChips | Reusable as-is — stays in sidebar |
| Tabs (molecule) | Reusable as-is for both main panel and sidebar tabs |

---

## 8. Files of Interest

- `src/pages/scheduling/SchedulingTaskDetailPage.tsx` — page orchestrator
- `src/pages/scheduling/SchedulingTaskDetailPage.module.css` — page tokens
- `src/pages/scheduling/SchedulingTaskDetailPage/components/` — all 10 components
- `src/components/molecules/Tabs/Tabs.tsx` — existing reusable Tabs molecule
- `src/components/molecules/Tabs/Tabs.module.css` — tab styles
- `C:\Users\ronald\projects\ipnext\ipnext-backend\src\infrastructure\http\routes\scheduling.routes.ts` — task CRUD + checklist + inventory-review
- `C:\Users\ronald\projects\ipnext\ipnext-backend\src\infrastructure\http\routes\taskComments.routes.ts` — comments
- `C:\Users\ronald\projects\ipnext\ipnext-backend\prisma\schema.prisma` (lines 566–705) — ScheduledTask, TaskComment, TaskCommentAttachment, TaskChecklistItem models
