# Proposal: Contracts Page (contracts-page)

## Intent

Add a first-class contracts list page at `/admin/contracts/list` that surfaces the `Service` model (the contracts entity in the backend) with filters, search, and pagination — following the `CustomersListPage` pattern exactly. Additionally, provide a backoffice admin UI for the `ServiceTechnology` catalog (list, create, edit, delete) at `/admin/contracts/technologies`. Both routes are new; App.tsx currently has 94 routes and this adds 2 more.

## Scope

### In Scope

- `src/api/contracts.api.ts`: paginated list endpoint, technology filter parameter
- `src/hooks/useContracts.ts`: TanStack Query hook wrapping the API; search debounce 300ms; URL state via `useSearchParams`
- `src/pages/contracts/ContractsListPage.tsx`: list page with FilterBar (status, technology dropdowns), search input, DataTable, Pagination
- `src/api/serviceTechnologies.api.ts`: CRUD for the `ServiceTechnology` catalog
- `src/hooks/useServiceTechnologies.ts`: TanStack Query hook for catalog CRUD
- `src/pages/contracts/ServiceTechnologiesPage.tsx`: backoffice admin page for technology catalog (inline edit/add/delete table, same UX as `SchedulingTaskCategoriesPage`)
- New route group `contracts` in `App.tsx`:
  - `admin/contracts/list` — protected by `clients.read`
  - `admin/contracts/technologies` — protected by `clients.read`
  - Total routes after change: **96** (94 existing + 2 new)
- Permission `clients.read` — existing permission emitted by `/me`; contracts are a sub-view of client data
- Tests: Vitest + Testing Library for both pages and hooks

### Out of Scope

- Creating or editing contracts (Phase 2)
- Contract detail page (Phase 2)
- Backend changes to `/api/services` endpoint (handled in `service-technology` change)
- Sidebar navigation entry (managed separately by nav config — not App.tsx)
- Any changes to `CustomersListPage` or customer-related hooks

## Capabilities

### New Capabilities

- `contracts-page`: Paginated, filterable, searchable list of contracts (`Service` model). Filters: status (active/inactive/blocked/late/baja), technology (dynamic from `ServiceTechnology` catalog). Search: debounced 300ms on client name, plan, ip. Deep links preserved via URL search params.
- `service-technology-catalog-ui`: Backoffice CRUD UI for the `ServiceTechnology` catalog. Inline table with add/edit/delete. Optimistic UI with TanStack Query invalidation.

### Modified Capabilities

- `App.tsx` routing: 2 new routes added. Route count goes from 94 to 96. Insertion point: after `crm` block, before `sla` block (alphabetical `contracts` between `crm` and `sla`). Order-sensitive insertion is documented in the task breakdown. No existing routes are reordered or removed.

## Approach

1. SDD artifacts (this change)
2. API layer: `contracts.api.ts` + `serviceTechnologies.api.ts`
3. Hook layer: `useContracts.ts` + `useServiceTechnologies.ts`
4. Page layer: `ContractsListPage.tsx` + `ServiceTechnologiesPage.tsx`
5. Route wiring in `App.tsx` (insert after CRM block — alphabetical order, safe insertion)
6. Tests: TDD red → green → refactor (Vitest + Testing Library)

### URL State Design

`ContractsListPage` uses `useSearchParams` for all filter/search/page state:
- `?search=<query>&status=<status>&technology=<tech>&page=<n>`
- Ensures deep links and browser back/forward work correctly (same as `CustomersListPage`)

### Permission Guard

`clients.read` permission is used (existing, always emitted by `/me` for authorized users). Both pages use `RequirePermission permission="clients.read"`. No backend RBAC changes needed — contracts are a sub-view of client data and share the `clients.read` authorization boundary.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| App.tsx route insertion at wrong position | Med | Task breakdown specifies exact insertion point (after CRM block, line reference). Review diff carefully. |
| Route count mismatch | Low | Add a comment in App.tsx `{/* Contracts (clients.read) — 2 routes */}` to make counting explicit |
| Filter by technology depends on ServiceTechnology catalog existing | Low | `useServiceTechnologies` hook fetches catalog on mount; if empty, technology filter dropdown shows empty (graceful). |
| Deep link breakage on page component rename | Low | URL paths are canonical (`/admin/contracts/list`); component names are internal. No redirect aliases needed for new routes. |
| Existing test suite affected by new routes | Very Low | New routes added; no existing routes modified. Existing tests unaffected. |
