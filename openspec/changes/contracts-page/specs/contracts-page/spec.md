# Spec: contracts-page

## Overview

A paginated, filterable, searchable contracts list page (`/admin/contracts/list`) backed by the `Service` model, plus a backoffice admin UI for the `ServiceTechnology` catalog (`/admin/contracts/technologies`). Both pages follow the `CustomersListPage` / `SchedulingTaskCategoriesPage` patterns respectively.

## ADDED Requirements

### Requirement CP-1: Contracts list page renders with data

**Priority**: MUST

#### Scenario CP-1.1: Page renders the contracts table

- Given the user has the `clients.read` permission
- And `GET /api/services` returns a paginated response with at least one contract
- When the user navigates to `/admin/contracts/list`
- Then the page MUST render a data table with one row per contract
- And each row MUST display at minimum: client name, plan, status, technology (or "—" if null), start date

#### Scenario CP-1.2: Empty state renders gracefully

- Given `GET /api/services` returns an empty page (`items: [], total: 0`)
- When the user navigates to `/admin/contracts/list`
- Then the page MUST render an empty state message (no table rows, no error)

#### Scenario CP-1.3: Loading state is shown while fetching

- Given the API call is in progress
- When the user navigates to `/admin/contracts/list`
- Then the page MUST render a loading indicator (spinner or skeleton)

#### Scenario CP-1.4: Error state is shown on API failure

- Given `GET /api/services` returns HTTP 500
- When the user navigates to `/admin/contracts/list`
- Then the page MUST render an error message and MUST NOT crash

---

### Requirement CP-2: Search with debounce

**Priority**: MUST

#### Scenario CP-2.1: Search input debounces 300ms

- Given the user types "john" in the search input
- When less than 300ms have passed since the last keystroke
- Then the API MUST NOT be called yet

#### Scenario CP-2.2: Search fires after debounce

- Given the user types "john" and waits 300ms
- When 300ms elapse
- Then `GET /api/services?search=john` MUST be called

#### Scenario CP-2.3: Search is preserved in URL

- Given the user searches for "john"
- When the URL is observed
- Then the query param `?search=john` MUST be present (deep link preserved)

---

### Requirement CP-3: Filter by status

**Priority**: MUST

#### Scenario CP-3.1: Status filter updates query

- Given the user selects "active" in the status dropdown
- When the filter is applied
- Then `GET /api/services?status=active` MUST be called
- And `?status=active` MUST appear in the URL

#### Scenario CP-3.2: Clearing the status filter removes query param

- Given `?status=active` is in the URL
- When the user selects the blank / "All" option in the dropdown
- Then the API MUST be called without a `status` param
- And `status` MUST be removed from the URL

---

### Requirement CP-4: Filter by technology

**Priority**: MUST

#### Scenario CP-4.1: Technology filter dropdown is populated from catalog

- Given `GET /api/service-technologies` returns `[{ name: "Fiber" }, { name: "DOCSIS" }]`
- When the contracts page loads
- Then the technology dropdown MUST contain "Fiber" and "DOCSIS" as options

#### Scenario CP-4.2: Selecting a technology filters the list

- Given the user selects "Fiber" in the technology dropdown
- When the filter is applied
- Then `GET /api/services?technology=Fiber` MUST be called
- And `?technology=Fiber` MUST appear in the URL

#### Scenario CP-4.3: Empty catalog renders graceful dropdown

- Given `GET /api/service-technologies` returns `[]`
- When the contracts page loads
- Then the technology dropdown MUST render with only the "All" / blank option (no error)

---

### Requirement CP-5: Pagination

**Priority**: MUST

#### Scenario CP-5.1: Pagination controls render correctly

- Given `GET /api/services` returns `total: 50, pageSize: 20, page: 1`
- When the contracts page renders
- Then pagination controls MUST show at least: current page, total pages, next/prev buttons

#### Scenario CP-5.2: Navigating to next page updates URL and refetches

- Given the user is on page 1
- When the user clicks "Next page"
- Then `GET /api/services?page=2` MUST be called
- And `?page=2` MUST appear in the URL

#### Scenario CP-5.3: Page resets to 1 when filter changes

- Given the user is on page 3 with `?status=active`
- When the user changes the status filter to "blocked"
- Then the page param MUST reset to 1 and `GET /api/services?status=blocked&page=1` MUST be called

---

### Requirement CP-6: Permission guard

**Priority**: MUST

#### Scenario CP-6.1: Unauthorized user cannot access the contracts page

- Given the user does NOT have the `clients.read` permission (not present in `/me` response)
- When the user navigates to `/admin/contracts/list`
- Then the `RequirePermission` wrapper MUST block rendering and show the appropriate fallback (redirect or 403 message)

#### Scenario CP-6.2: Authorized user sees the page

- Given the user has `clients.read` in their permissions
- When the user navigates to `/admin/contracts/list`
- Then the page MUST render without a permission block

---

## ADDED Requirements (service-technology-catalog-ui)

### Requirement CP-7: Service technology catalog admin page

**Priority**: MUST

#### Scenario CP-7.1: Catalog renders with existing technologies

- Given `GET /api/service-technologies` returns `[{ id: "1", name: "Fiber", description: "..." }]`
- When the user navigates to `/admin/contracts/technologies`
- Then a table MUST render with one row per technology showing name and description

#### Scenario CP-7.2: Create new technology

- Given the user fills in the name "Radio" in the add form and submits
- When `POST /api/service-technologies` is called and returns 201
- Then the catalog table MUST update to show the new entry (TanStack Query invalidation)

#### Scenario CP-7.3: Create with duplicate name shows error

- Given the user submits a name that already exists
- When `POST /api/service-technologies` returns HTTP 409
- Then an inline error message MUST be shown (MUST NOT crash the page)

#### Scenario CP-7.4: Edit existing technology

- Given a technology row with name "Fiber" is in edit mode
- When the user changes the name to "Fiber Optic" and saves
- When `PUT /api/service-technologies/:id` returns 200
- Then the row MUST update in-place and exit edit mode

#### Scenario CP-7.5: Delete unused technology

- Given a technology with no services using it
- When the user clicks delete and confirms
- When `DELETE /api/service-technologies/:id` returns 204
- Then the row MUST be removed from the table

#### Scenario CP-7.6: Delete technology in use shows error

- Given a technology currently assigned to one or more services
- When the user clicks delete and confirms
- When `DELETE /api/service-technologies/:id` returns HTTP 409
- Then an error message MUST be shown explaining the technology is in use

---

## ADDED Requirements (routing)

### Requirement CP-8: New routes in App.tsx

**Priority**: MUST

#### Scenario CP-8.1: Route /admin/contracts/list is registered

- Given the App.tsx routing is loaded
- When a user navigates to `/admin/contracts/list`
- Then `ContractsListPage` MUST be rendered inside `AdminLayout` with `RequirePermission permission="clients.read"`

#### Scenario CP-8.2: Route /admin/contracts/technologies is registered

- Given the App.tsx routing is loaded
- When a user navigates to `/admin/contracts/technologies`
- Then `ServiceTechnologiesPage` MUST be rendered inside `AdminLayout` with `RequirePermission permission="clients.read"`

#### Scenario CP-8.3: No existing routes are reordered or broken

- Given the 94 existing routes were working before this change
- When the 2 new `contracts` routes are inserted after the `crm` block
- Then all 94 existing routes MUST continue to resolve correctly
- And the total route count MUST be 96

## Constraints

- Search debounce MUST be exactly 300ms (match `CustomersListPage` behavior)
- All filter/search/pagination state MUST be stored in URL search params (deep links MUST work)
- `useContracts` hook MUST NOT duplicate pagination logic — it MUST use the same `PaginatedResponse<ContractSummary>` shape returned by the backend
- `useServiceTechnologies` hook MUST use TanStack Query's `invalidateQueries` after every mutation
- Both pages MUST be lazy-loaded via `React.lazy` in App.tsx (consistent with all other pages)
- The `clients.read` permission string is used — it is an existing permission already emitted by `/me`. No new RBAC module is needed for Phase 1.
- `ServiceTechnologiesPage` MUST handle loading and error states for every mutation (create, update, delete)
- Tests MUST mock the API layer (axios-client), not TanStack Query internals
