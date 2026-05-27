# Design — frontend-routing-nested

## Technical Approach

Today `src/App.tsx` holds one `<Routes>` with two already-nested layout routes (`ProtectedRoute` → `AdminLayout`, both rendering `<Outlet>`) and 94 **flat** children plus a catch-all. The goal is to push the feature children down into **nested route groups** so that route declaration order stops being load-bearing within a group, and each feature's routes are co-located and self-documenting.

The chosen shape keeps the JSX `<Routes>` element API (React Router 6.21, `BrowserRouter` in `main.tsx`) — we do NOT migrate to `createBrowserRouter`. We introduce a parent `<Route path="admin">` under `AdminLayout`, then one nested `<Route path="<feature>">` per section (scheduling, networking, finance, tickets, customers, ...), each containing an `index` route (the section landing page) and child routes using **relative** segments. Redirects (`<Navigate>`) are co-located inside their feature group with **absolute** targets. Lazy loading and the single top-level `<Suspense>` are preserved unchanged; per-feature `<Suspense>` is considered but deferred (AD-4).

The refactor is mechanical and incremental: one feature group converted per phase, with a golden routing test (written first) asserting every absolute URL still resolves to its expected page. This makes each phase independently revertible.

## Architecture Decisions

### AD-1 — Nested JSX `<Routes>` tree in App.tsx (single file)

**Choice**: Keep one `<Routes>` in `App.tsx`. Convert flat children into nested `<Route path="<feature>">` blocks with `index` + relative-path children under a `<Route path="admin">` parent inside `AdminLayout`.

**Alternatives**:
- **B — Per-feature router files** (`src/routes/scheduling.routes.tsx` exporting `<Route>` fragments composed into App.tsx).
- **C — `createBrowserRouter` data router** (object route config, loaders/actions).

**Rationale**: Lowest-risk, smallest conceptual jump from the current code. React Router 6.21 already ranks static segments over dynamic ones, so nesting + relative paths removes the *manual* ordering burden without any new API surface. The whole change is JSX-tree-only — no lazy/Suspense churn, no new build edges (protects the shim workaround). Tradeoff: `App.tsx` stays the single routing file (~one nested tree); acceptable because nesting makes it ~3x more readable than 94 flat lines.

### AD-2 — Why NOT per-feature router files (Alternative B)

**Choice**: Rejected for this change.

**Rationale**: Splitting `<Route>` fragments into per-feature files reduces `App.tsx` size and improves feature ownership, BUT React Router `<Routes>` requires `<Route>` to be direct descendants — you cannot freely wrap them in arbitrary components; you must return `<Route>` elements or `<Fragment>`s, which TypeScript/JSX makes awkward and which obscures the route ranking. It also fragments the routing picture across 14 files, making the "does this URL still resolve?" question harder to answer at a glance. Tradeoff considered: better for very large teams with strict module ownership. We are not there yet — revisit if `App.tsx` exceeds maintainability after nesting. Documented as the natural next step if needed.

### AD-3 — Why NOT createBrowserRouter / data router (Alternative C)

**Choice**: Rejected for this change.

**Rationale**: `createBrowserRouter` unlocks loaders/actions/`useNavigation`, but (a) the app uses **TanStack Query** for all data fetching — loaders would duplicate that responsibility and create two sources of truth; (b) migrating requires replacing `<BrowserRouter>` in `main.tsx` and reworking the lazy/Suspense story into route-level `lazy` + `HydrateFallback`, which is a far larger, riskier diff that touches the Vite chunking the shims protect; (c) it is orthogonal to the stated goal (kill order-fragility). Tradeoff: we forgo data-router ergonomics. If the team later wants route-level code-splitting + loaders, that is a separate, larger change built on top of this nesting. Documented as a future option.

### AD-4 — Preserve single top-level `<Suspense>`; defer per-feature boundaries

**Choice**: Keep the one `<Suspense fall={<Spinner fullPage />}>` wrapping `<Routes>`. Do not add per-route `<Suspense>` in this change.

**Alternatives**: Wrap each feature group (or each lazy page) in its own `<Suspense>` for granular loading skeletons.

**Rationale**: Per-feature Suspense is a UX enhancement (localized spinners instead of full-page), not a routing-structure concern. Bundling it here would inflate the diff and risk the Vite empty-chunk edge case the re-export shims work around. Keep `lazy()` declarations byte-for-byte; only the `<Route>` JSX tree changes. Per-feature Suspense can land later as an isolated improvement.

### AD-5 — `index` routes for section landings; relative child paths

**Choice**: Each feature parent becomes a **pathless-content layout**: `<Route path="finance"><Route index element={<FinanzasDashboardPage/>}/><Route path="invoices" .../>...</Route>`. Children use relative segments; `index` renders the section landing currently at `/admin/finance`.

**Rationale**: This is the mechanism that removes order-dependency: relative children under a shared prefix are ranked by the router, not by source order. `index` cleanly expresses "the parent path itself" (e.g. `/admin/finance`) without a redundant `path=""`. Redirect-to-canonical entries (e.g. `/admin/finance/dashboard` → `/admin/finance`) stay as `<Route path="dashboard" element={<Navigate to="/admin/finance" replace/>}/>` with an **absolute** target.

### AD-6 — Redirects keep absolute targets, co-located in their group

**Choice**: All 11 `<Navigate>` redirects move into their feature group but keep absolute `to=` values.

**Rationale**: Absolute targets are immune to nesting/relative-path drift (Risk 4 in proposal). Co-location makes each group's alias surface visible. Examples: `/admin/leads`→`/admin/crm/leads`, `/admin/messages`→`/admin/support/inbox`, `/admin/scheduling`→`/admin/scheduling/tasks`, `/admin/tickets/list`→`/admin/tickets/opened`.

### AD-7 — Golden routing test written FIRST (regression net)

**Choice**: Before editing `App.tsx`, add `src/__tests__/routing/urls.test.tsx` that renders `<App>` inside a `MemoryRouter` (with auth mocked to authenticated) for each of the 94 URLs + 11 redirects and asserts the expected page/component (or redirect target) renders.

**Rationale**: A pure refactor needs a behavioural lock. The test is the contract; phases must keep it green. This is the single most important safety mechanism and is cheap (table-driven over a URL→assertion list).

### AD-8 — `customers/:id` catch-all expressed via route ranking

**Choice**: Under `<Route path="customers">`, declare `search`, `vouchers`, `map`, `add`, `list`, `view/:id`, `view/:id/edit` as siblings plus `:id` (the redirect). Rely on RR6 ranking (static > dynamic) instead of source order.

**Rationale**: RR6 ranks `customers/search` above `customers/:id` regardless of declaration order, so the L217-220 comment's fear is resolved structurally. The golden test includes `/admin/customers/search` and `/admin/customers/<uuid>` to prove both resolve correctly.

## Target Route Tree (illustrative)

```
<Routes>
  <Route path="/" element={<Navigate to="/admin/dashboard" replace/>} />
  <Route path="/login" element={<LoginPage/>} />

  <Route element={<ProtectedRoute/>}>            // unchanged auth gate
    <Route element={<AdminLayout/>}>             // unchanged chrome + Outlet
      <Route path="admin">
        <Route path="dashboard" element={<DashboardPage/>} />

        <Route path="customers">
          <Route path="list"     element={<ClientesListPage/>} />
          <Route path="add"      element={<AddClientePage/>} />
          <Route path="search"   element={<CustomerSearchPage/>} />
          <Route path="vouchers" element={<CustomerVouchersPage/>} />
          <Route path="map"      element={<CustomerMapPage/>} />
          <Route path="view/:id"      element={<ClienteDetailPage/>} />
          <Route path="view/:id/edit" element={<EditClientePage/>} />
          <Route path=":id" element={<CustomerIdRedirect/>} />   // ranking handles it
        </Route>

        <Route path="finance">
          <Route index element={<FinanzasDashboardPage/>} />     // was /admin/finance
          <Route path="dashboard" element={<Navigate to="/admin/finance" replace/>} />
          <Route path="invoices"  element={<FacturasPage/>} />
          ... payments, transactions, credit-notes, proforma-invoices,
              proformas(redirect), history, payment-statements, dunning, payment-plans
        </Route>

        <Route path="scheduling">
          <Route index element={<Navigate to="/admin/scheduling/tasks" replace/>} />
          <Route path="dashboard"  element={<SchedulingDashboardPage/>} />
          <Route path="tasks"      element={<SchedulingTasksPage/>} />
          <Route path="tasks/:id"  element={<SchedulingTaskDetailPage/>} />
          ... projects, calendars, maps, archive, templates,
              task-categories, task-priorities, stage-colors
        </Route>

        <Route path="networking"> ... </Route>   // 12
        <Route path="tickets"> ... </Route>       // 9
        <Route path="tariffs"> ... </Route>       // 7
        <Route path="voice"> ... </Route>         // 6
        <Route path="inventory"> ... </Route>     // 5
        <Route path="support"> ... </Route>       // 4
        <Route path="crm"> ... </Route>           // 4
        <Route path="sla"> ... </Route>           // 2 (index + list)
        <Route path="resellers"> ... </Route>     // 2 (index + :id)
        <Route path="portal"> ... </Route>        // 2 (index + users)

        // singletons stay as direct children of <Route path="admin">
        <Route path="reports" .../>  <Route path="profile" .../>  <Route path="partners" .../>
        <Route path="locations" .../> <Route path="monitoring" .../> <Route path="notifications" .../>
        <Route path="config/main" .../> <Route path="api-docs" .../>
        <Route path="administration/administrators" .../>
        <Route path="leads"    element={<Navigate to="/admin/crm/leads" replace/>} />
        <Route path="messages" element={<Navigate to="/admin/support/inbox" replace/>} />
      </Route>
    </Route>
  </Route>

  <Route path="*" element={<NotFoundPage/>} />
</Routes>
```

## Preserving Deep Links / Bookmarks

- Absolute URLs are **unchanged** — nesting only changes how routes are *declared*, not the paths they match. `/admin/scheduling/tasks/abc123` still matches `scheduling` → `tasks/:id`.
- Redirects keep **absolute `to=`** so bookmarked legacy URLs (`/admin/scheduling`, `/admin/leads`, ...) still land correctly.
- The golden routing test (AD-7) enumerates every absolute URL and proves it resolves post-refactor — this IS the deep-link guarantee.
- The catch-all `*` stays at the top level so unknown URLs still hit `NotFoundPage`.

## Testing Strategy

| Layer | Scenario | Type |
|-------|----------|------|
| Routing (golden) | Each of 94 URLs renders its expected page component | Vitest + Testing Library + `MemoryRouter` |
| Routing (redirects) | Each of 11 legacy URLs lands on its canonical target | Vitest + `MemoryRouter`, assert resolved page |
| Routing (collisions) | `/admin/customers/search` ≠ `:id`; `/admin/scheduling/tasks` ≠ `tasks/:id` | Vitest |
| Routing (catch-all) | `/admin/does-not-exist` → `NotFoundPage` | Vitest |
| Auth gate | Unauthenticated hit on a deep link → `/login?redirect=...` (unchanged) | Vitest (mock `useAuth`) |
| Build | `tsc --noEmit` green; `vite build` produces same lazy chunks (shims intact) | manual / CI |
| Smoke | Playwright: load 1 deep link per feature group + 2 redirects | manual (MCP) |

## Open Questions

None blocking. Per-feature `<Suspense>` and per-module router files are explicitly deferred (AD-2, AD-4).
