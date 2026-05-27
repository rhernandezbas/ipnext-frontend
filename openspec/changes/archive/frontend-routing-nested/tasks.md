# Tasks — frontend-routing-nested

Incremental, feature-by-feature. **NO big-bang.** After every phase the app runs and all URLs resolve. Each phase ends with a verification gate.

Legend: `[ ]` todo. Verification commands: `npx vitest run`, `tsc --noEmit`, Playwright smoke via MCP.

---

## Phase 0 — Regression net (do FIRST, before touching App.tsx)

- [ ] 0.1 Create `src/__tests__/routing/urls.test.tsx`: table of all 94 feature URLs → expected page component name (use `screen` text/role or a `data-testid`/heading per page).
- [ ] 0.2 Add the 11 redirect URLs → expected canonical-target page to the same table.
- [ ] 0.3 Add collision cases: `/admin/customers/search`, `/admin/customers/<uuid>`, `/admin/scheduling/tasks`, `/admin/scheduling/tasks/<id>`.
- [ ] 0.4 Add catch-all case: `/admin/zzz-nope` → `NotFoundPage`.
- [ ] 0.5 Render `<App/>` inside `MemoryRouter initialEntries={[url]}`, mock `useAuth` → authenticated.

**Gate**: `npx vitest run` green against the CURRENT flat `App.tsx`. This is the golden baseline — it must stay green through every phase below.

---

## Phase 1 — Introduce the `admin` parent route (no behaviour change)

- [ ] 1.1 Wrap all current `/admin/*` flat children in a single `<Route path="admin">` under `<AdminLayout>`, converting each child path from `/admin/foo` to relative `foo`.
- [ ] 1.2 Keep every route flat *within* the `admin` parent for now (no per-feature grouping yet) — this isolates the "absolute→relative" change from the "grouping" change.
- [ ] 1.3 Keep redirects with absolute `to=`.

**Gate**: golden test green; `tsc --noEmit` green. Smoke: `/admin/dashboard`, `/admin/customers/search`.

---

## Phase 2 — Group `scheduling` (12 routes, highest fragility)

- [ ] 2.1 Create `<Route path="scheduling">` with relative children: `dashboard`, `projects`, `calendars`, `maps`, `archive`, `templates`, `task-categories`, `task-priorities`, `stage-colors`, `tasks`, `tasks/:id`.
- [ ] 2.2 Add `index` → `<Navigate to="/admin/scheduling/tasks" replace/>` (replaces the old `/admin/scheduling` redirect).
- [ ] 2.3 Confirm `tasks` (index) vs `tasks/:id` now resolve by ranking, not order. Keep re-export shims untouched.

**Gate**: golden test green. Smoke: `/admin/scheduling`, `/admin/scheduling/tasks`, `/admin/scheduling/tasks/<id>`, `/admin/scheduling/templates`.

---

## Phase 3 — Group `customers` (8 routes, catch-all collision)

- [ ] 3.1 `<Route path="customers">` with: `list`, `add`, `search`, `vouchers`, `map`, `view/:id`, `view/:id/edit`, `:id` (CustomerIdRedirect).
- [ ] 3.2 Verify ranking resolves `search`/`vouchers`/`map` over `:id` regardless of declaration order.

**Gate**: golden test green, especially `/admin/customers/search` (must NOT hit `:id`) and `/admin/customers/<uuid>` (must redirect to `/view/<uuid>`). Smoke both.

---

## Phase 4 — Group `finance` (12 routes, index landing)

- [ ] 4.1 `<Route path="finance">` with `index` → `FinanzasDashboardPage`; `dashboard` → `<Navigate to="/admin/finance">`; children `invoices`, `payments`, `transactions`, `credit-notes`, `proforma-invoices`, `proformas`(redirect), `history`, `payment-statements`, `dunning`, `payment-plans`.

**Gate**: golden test green. Smoke: `/admin/finance`, `/admin/finance/invoices`, `/admin/finance/proformas`(redirect).

---

## Phase 5 — Group `networking` (12 routes)

- [ ] 5.1 `<Route path="networking">` with: `routers/list`, `network-sites`, `sites`(redirect), `cpe`, `tr069`, `hardware`, `gpon`, `radius-sessions`, `ipv4-networks`, `ipv6-networks`, `map`, `topology`.

**Gate**: golden test green. Smoke: `/admin/networking/network-sites`, `/admin/networking/sites`(redirect), `/admin/networking/topology`.

---

## Phase 6 — Group `tickets` (9 routes)

- [ ] 6.1 `<Route path="tickets">` with `index` → `TicketsDashboardPage`; `dashboard`(redirect→index), `opened`, `list`(redirect→opened), `trash`, `archive`(redirect→trash), `new`, `requesters`, `:id`.
- [ ] 6.2 Verify `new`/`opened`/`requesters` rank over `:id`.

**Gate**: golden test green. Smoke: `/admin/tickets`, `/admin/tickets/new`, `/admin/tickets/<id>`, `/admin/tickets/list`(redirect).

---

## Phase 7 — Group remaining multi-route sections

- [ ] 7.1 `tariffs` (7): `index`→TarifasPage, `internet`, `voice`, `recurring`, `one-time`, `bundles`, `huawei-groups`.
- [ ] 7.2 `voice` (6): `index`→VozPage, `categories`, `processing`, `rate-tables`, `prefixes`, `cdr`.
- [ ] 7.3 `inventory` (5): `list`, `dashboard`, `items`, `products`, `supply`.
- [ ] 7.4 `support` (4): `inbox`, `mass-send`, `messengers`, `news`.
- [ ] 7.5 `crm` (4): `leads`, `dashboard`, `quotes`, `map`.
- [ ] 7.6 `sla` (2): `index`→SLADashboardPage, `list`.
- [ ] 7.7 `resellers` (2): `index`→ResellersListPage, `:id`.
- [ ] 7.8 `portal` (2): `index`→PortalConfigPage, `users`.

**Gate** (after each subsection): golden test green. Smoke one URL per subsection.

---

## Phase 8 — Singletons & cleanup

- [ ] 8.1 Leave singletons as direct relative children of `<Route path="admin">`: `reports`, `profile`, `partners`, `locations`, `monitoring`, `notifications`, `api-docs`, `config/main`, `administration/administrators`.
- [ ] 8.2 Place top-level alias redirects `leads`→`/admin/crm/leads`, `messages`→`/admin/support/inbox` as relative children with absolute targets.
- [ ] 8.3 Remove now-obsolete order-dependency comments (L184-189, L217-219, L238) — nesting makes them unnecessary.
- [ ] 8.4 Confirm catch-all `*` and root `/`, `/login` are untouched.

**Gate**: golden test green; `tsc --noEmit` green.

---

## Phase 9 — Final verification

- [ ] 9.1 `npx vitest run` — all routing + existing tests green.
- [ ] 9.2 `tsc --noEmit` green.
- [ ] 9.3 `vite build` succeeds; confirm lazy chunks still generated (shims intact, no empty-chunk warning).
- [ ] 9.4 Playwright smoke (MCP): visit one deep link per feature group (`/admin/scheduling/tasks/<id>`, `/admin/customers/view/<id>`, `/admin/finance/invoices`, `/admin/networking/topology`, `/admin/tickets/<id>`) + 3 redirects (`/admin/leads`, `/admin/messages`, `/admin/scheduling`). Assert each renders the right screen and the URL bar shows the expected (possibly redirected) path.
- [ ] 9.5 Confirm `App.tsx` `<Routes>` is fully nested; no remaining flat 94-line block.

**Definition of done**: all gates green; every pre-refactor URL resolves identically; no order-dependency comments remain.

---

## Verification reference — URLs to probe per group

| Group | Probe URLs |
|-------|-----------|
| scheduling | `/admin/scheduling` (→tasks), `/admin/scheduling/tasks`, `/admin/scheduling/tasks/123` |
| customers | `/admin/customers/search`, `/admin/customers/view/123`, `/admin/customers/123` (→view) |
| finance | `/admin/finance`, `/admin/finance/invoices`, `/admin/finance/proformas` (→proforma-invoices) |
| networking | `/admin/networking/network-sites`, `/admin/networking/sites` (→network-sites) |
| tickets | `/admin/tickets`, `/admin/tickets/new`, `/admin/tickets/123`, `/admin/tickets/list` (→opened) |
| catch-all | `/admin/zzz-nope` (→NotFound) |
