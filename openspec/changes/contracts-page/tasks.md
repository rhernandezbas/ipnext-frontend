# Tasks: contracts-page

STRICT TDD (Vitest + Testing Library): write the test first (red), then the component/hook (green), then refactor.
Mock the axios-client API layer, NOT TanStack Query internals.
Reference patterns: `CustomersListPage` (list), `TaskCategoriesBody` (catalog CRUD).

RBAC: both routes are guarded with **`contracts.read`** — a dedicated permission created by the backend in branch `feat/service-technology`. See design.md "RBAC Permission Decision".

## 1. Types + API layer (infra)

- [ ] 1.1 Create `src/types/contract.ts` — `ContractSummary` (clientName, plan, status, technology|null, startDate, id...) + reuse/define `PaginatedResponse<T>` `{ data, total, totalPages }`
- [ ] 1.2 Create `src/types/serviceTechnology.ts` — `ServiceTechnology` `{ id, name, description }`
- [ ] 1.3 Create `src/api/contracts.api.ts` — `list({ page, limit, search?, status?, technology? })` hitting `GET /api/services` via axios-client
- [ ] 1.4 Create `src/api/serviceTechnologies.api.ts` — `list/getById/create/update/remove` hitting `/api/service-technologies`

## 2. Hooks (test-first)

- [ ] 2.1 Test + impl `src/hooks/useContracts.ts` — TanStack Query list hook wrapping `contracts.api.list`; returns `{ data, isLoading, isError }`
- [ ] 2.2 Test + impl `src/hooks/useServiceTechnologies.ts` — `useServiceTechnologies` (list) + `useCreate/Update/Delete` mutations, each calling `invalidateQueries` on success

## 3. Contracts list page (TDD)

- [ ] 3.1 Write `src/__tests__/contracts/ContractsListPage.test.tsx`: data/empty/loading/error (CP-1); search debounce 300ms with fake timers + URL `?search` (CP-2); status filter + URL (CP-3); technology dropdown from catalog + filter + URL (CP-4); pagination + page-reset-on-filter (CP-5); permission guard allow/block (CP-6)
- [ ] 3.2 Create `src/pages/contracts/ContractsListPage.tsx` (mirror CustomersListPage): `useSearchParams` for search/status/technology/page; `FilterBar` (status static + technology dynamic from `useServiceTechnologies`); `DataTable<ContractSummary>` (columns incl. technology rendering "—" when null); `Pagination`; reset page to 1 on any filter change
- [ ] 3.3 Add `ContractsListPage.module.css` if styling is needed (mirror CustomersListPage.module.css)

## 4. Service technologies catalog page (TDD)

- [ ] 4.1 Write `src/__tests__/contracts/ServiceTechnologiesPage.test.tsx`: render rows (CP-7.1); create + table update (CP-7.2); duplicate-name 409 inline error (CP-7.3); edit in-place (CP-7.4); delete unused (CP-7.5); delete in-use 409 error (CP-7.6)
- [ ] 4.2 Create `src/pages/contracts/ServiceTechnologiesBody.tsx` (mirror TaskCategoriesBody): toolbar + table + create/edit modal + delete via `useConfirm`; handle 409 `SERVICE_TECHNOLOGY_NAME_CONFLICT` and `SERVICE_TECHNOLOGY_IN_USE`; loading/error states on every mutation
- [ ] 4.3 Create `src/pages/contracts/ServiceTechnologiesPage.tsx` — thin wrapper (header + breadcrumb) rendering `<ServiceTechnologiesBody />` (mirror SchedulingTaskCategoriesPage)
- [ ] 4.4 Add `ServiceTechnologiesPage.module.css` (reuse the TaskCategories CSS pattern)

## 5. Routing (App.tsx — order-sensitive)

- [ ] 5.1 Add two `lazy()` imports (`ContractsListPage`, `ServiceTechnologiesPage`) near the other lazy imports
- [ ] 5.2 Insert the `contracts` route block at line ~279 (between the `crm` block close and the `sla` block), guarded with `permission="contracts.read"`, with comment `{/* Contracts (contracts.read) — 2 routes */}`
- [ ] 5.3 Update `src/__tests__/routing/App.routing.test.tsx`: assert `/admin/contracts/list` and `/admin/contracts/technologies` resolve, no existing route broken, total route count = 96 (CP-8)

## 6. Doc alignment

- [x] 6.1 Updated all artifacts (`proposal.md`, `design.md`, `specs/contracts-page/spec.md`, `tasks.md`) to use `contracts.read` — the actual backend permission (supersedes prior instruction to use `clients.read`).

## 7. Verification

- [ ] 7.1 `npm test` (vitest) — all green
- [ ] 7.2 `npx tsc --noEmit` (or `npm run typecheck`) — clean
- [ ] 7.3 Manual sanity: navigate to both routes as a user with `contracts.read`; confirm visible; as a user without it, confirm `NoPermissionPage`
- [ ] 7.4 Conventional commit
