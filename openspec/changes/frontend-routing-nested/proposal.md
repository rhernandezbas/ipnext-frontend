# Proposal — frontend-routing-nested

## Intent

Migrate `src/App.tsx` from a single flat `<Routes>` tree to **nested routes grouped by feature** (layout routes + `<Outlet>`), eliminating the load-bearing declaration order that currently makes navigation fragile. This is a structural refactor: no new screens, no API changes, no behaviour change for the end user. Every existing URL must keep resolving exactly as today, including deep links and bookmarks.

## Context (real numbers)

`src/App.tsx` currently declares **99 `<Route>` elements** in one tree:

- 2 root routes — `/` (redirect to `/admin/dashboard`) and `/login`.
- 2 layout routes already nested — `<ProtectedRoute>` (auth gate, `L147`) wrapping `<AdminLayout>` (chrome + breadcrumbs, `L148`). **Both already render `<Outlet>`** (`ProtectedRoute.tsx:18`, `AdminLayout.tsx:116`).
- 94 **flat feature children** under `AdminLayout`, of which **11 are `<Navigate>` redirects** (legacy/alias URLs).
- 1 catch-all `*` → `NotFoundPage` (`L262`).

Every page is `React.lazy()` (60+ `lazy()` calls, `L14-138`) under a single top-level `<Suspense fall={<Spinner fullPage />}>` (`L142`).

Feature grouping by `/admin/<section>` prefix (counted from `App.tsx`):

| Section | Routes | | Section | Routes |
|---------|:--:|---|---------|:--:|
| scheduling | 12 | | crm | 4 |
| networking | 12 | | sla | 2 |
| finance | 12 | | resellers | 2 |
| tickets | 9 | | portal | 2 |
| customers | 8 | | (singletons) | 11 |
| tariffs | 7 | | | |
| voice | 6 | | | |
| inventory | 5 | | | |
| support | 4 | | | |

Singletons (one route each): `reports`, `profile`, `partners`, `notifications`, `monitoring`, `messages` (redirect), `locations`, `leads` (redirect), `dashboard`, `config`, `administration`, `api-docs`.

## Problem

Declaration order is **load-bearing** — a reorder silently breaks navigation. Concrete fragile cases (cited by line):

1. **`/admin/customers/:id` catch-all** (`L217-220`) MUST stay AFTER `/admin/customers/search` (`L214`), `/vouchers` (`L215`), `/map` (`L216`). If moved up, `search` is parsed as `id="search"`. The inline comment already warns about exactly this.
2. **`/admin/scheduling/tasks` index** (`L239`) MUST precede `/admin/scheduling/tasks/:id` (`L240`). Comment at `L238` flags it as CRITICAL. (Note: React Router 6 ranks static over dynamic segments, so this is *partially* mitigated by the matcher — but the team does not rely on that and keeps manual ordering, which is the fragility.)
3. **11 `<Navigate>` redirects intermixed** with real routes (`L153, L154, L157, L160, L162, L175, L180`, etc.) — easy to misplace when editing.
4. **Re-export shims** (`SchedulingTasksPage.tsx`, `SchedulingTaskDetailPage`) exist to dodge a Vite production empty-chunk edge case with directory-only lazy imports (`L116-120`).

**Honesty note**: React Router 6's path-ranking algorithm already protects static-vs-dynamic collisions in most cases (it does not match purely top-to-bottom). So the app is not as brittle at *runtime* as a pure top-to-bottom matcher would be. The real cost is **cognitive and maintenance fragility**: a 94-route flat block with order-dependent comments is hard to read, hard to extend, and invites mistakes during edits. Nesting makes the structure self-documenting and localizes each feature's routes.

## Scope IN

- Restructure `src/App.tsx` into nested route groups, one parent `<Route path="<section>">` per feature with child routes and `index` routes where applicable.
- Introduce per-feature layout/grouping routes (pathless or path-prefixed) under `AdminLayout`.
- Preserve all 94 feature URLs, all 11 redirects, the catch-all, and `lazy()` + `Suspense` behaviour (per-feature `<Suspense>` boundaries optional, evaluated in design).
- Add/extend routing tests (Vitest + Testing Library + `MemoryRouter`) asserting every top URL resolves to the expected page.
- Keep the existing `ProtectedRoute` → `AdminLayout` nesting.

## Scope OUT

- Migrating to `createBrowserRouter` / data-router APIs (loaders/actions) — evaluated in design, deferred.
- Splitting routes into per-module router files unless design selects that approach.
- Changing any page component, API call, hook, or CSS.
- Removing the re-export shims (orthogonal to nesting; keep as-is).
- Changing breadcrumb logic in `AdminLayout` (path-based, unaffected by nesting).
- Auth behaviour, redirect targets, or the catch-all destination.

## Approach (numbered)

1. **Inventory & freeze** the current 94 URLs into a routing test (golden list) BEFORE touching `App.tsx` — this is the regression net.
2. **Refactor incrementally, feature by feature**: convert one section (e.g. `scheduling`) to a nested `<Route path="scheduling">` block with children + `index`, leaving the rest flat. App stays green after each section.
3. **Relative paths**: child routes use relative segments (`tasks`, `tasks/:id`) under the parent `<Route path="admin">` / `<Route path="scheduling">`, so order within a group stops mattering.
4. **Redirects** become nested `<Route index|path element={<Navigate>}>` co-located with their feature group.
5. **Catch-all** stays last at the top level.
6. **Verify** each phase: route tests green, `tsc --noEmit` green, Playwright smoke on representative deep links.

## Affected Areas

- `src/App.tsx` (the whole file — restructured).
- `src/__tests__/routing/*` (new — golden URL resolution tests).
- Possibly small new grouping components if design picks per-feature layout routes (e.g. `src/routes/<feature>.routes.tsx`).
- No page, hook, API, or CSS file changes.

## Risks

1. **Silent URL breakage** — a mistyped relative path resolves to a different absolute URL. Mitigation: golden routing test asserting exact absolute paths, written first.
2. **`index` vs path confusion** — converting `/admin/finance` (page) + `/admin/finance/invoices` (children) requires the parent to be a layout with an `index` route, not a page. Mitigation: explicit `index` routes per section, covered in design.
3. **Lazy chunk regressions** — moving `lazy()` calls or adding per-feature `<Suspense>` could reintroduce the Vite empty-chunk issue the shims work around. Mitigation: keep shims, keep `lazy()` declarations, change only the JSX tree.
4. **Redirect drift** — a relocated `<Navigate>` could point at a now-relative target. Mitigation: keep redirect targets as absolute paths.
5. **Big-bang temptation** — doing all 94 at once risks an unreviewable diff. Mitigation: phased plan in `tasks.md`, one feature per phase.

## Rollback Plan

Pure refactor with no schema/API impact. Rollback = revert the commit(s). Because phases are independent, a single broken phase can be reverted without touching the others.

## Success Criteria

- `npx vitest run` green, including the new golden routing tests.
- `tsc --noEmit` green.
- All 94 feature URLs + 11 redirects + catch-all resolve identically to pre-refactor.
- `App.tsx` `<Routes>` tree is nested by feature; no order-dependency comments remain necessary.
- Playwright smoke passes on the deep-link set listed in `tasks.md`.
