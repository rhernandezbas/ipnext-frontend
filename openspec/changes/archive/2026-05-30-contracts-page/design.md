# Design: contracts-page

## RBAC Permission Decision (CRITICAL — resolved, updated)

### The decision: use `contracts.read`
Both new pages (`/admin/contracts/list` and `/admin/contracts/technologies`) are guarded by **`contracts.read`** — a dedicated permission created in the backend branch `feat/service-technology`.

**History:** The original design chose `clients.read` because `contracts.read` did not exist at the time (the `contracts` RBAC module was absent from `RBAC_MODULES`). That premise is no longer valid.

**Current state (backend `feat/service-technology`):**
- The backend added a `contracts` RBAC module with four permissions: `contracts.read`, `contracts.write`, `contracts.delete`, `contracts.manage`.
- Roles seeded with `contracts.read`: `super_admin`, `administrador`, `administracion`, `ventas`, `noc`, `tecnico`.
- `/me` now emits `contracts.read` for any user whose role is in that list.
- The frontend `can('contracts.read')` check in `RequirePermission` will correctly grant or deny access.

**User decision:** use the semantically correct, dedicated `contracts.read` permission — NOT `clients.read`. This is more precise, future-proof, and aligned with the backend's own authorization boundary for the contracts domain.

**Approaches (for historical reference):**
- **A — reuse `clients.read` (previously chosen, now superseded).** Was the safe fallback when `contracts.read` didn't exist.
- **B — use `contracts.read` (NOW CHOSEN).** Semantically correct. Backend created the module; permission is live. Both pages use `RequirePermission permission="contracts.read"`.

> This section supersedes the previous design decision. The correct permission string is `contracts.read`.

---

## Architecture Decisions

### AD-1: ContractsListPage mirrors CustomersListPage exactly
`CustomersListPage` (`src/pages/customers/CustomersListPage.tsx`) is the established list-page pattern:
- `useSearchParams` for `search` / `status` / `page` URL state, synced via `useEffect` (`{ replace: true }`).
- `FilterBar` (search + filter dropdowns) → on change, reset page to 1.
- `DataTable<T>` for rows + `Pagination` for paging.
- A per-domain hook (`useClientList`) returning `{ data, isLoading }` where `data` has `{ data: T[], total, totalPages }`.

ContractsListPage adds a **technology** filter on top of **status**. State keys: `search`, `status`, `technology`, `page`.

**Filters:**
- `status`: static options matching `Service.status` (`active`, `inactive`, `blocked`, `late`, `baja`) — mirror `STATUS_FILTERS` shape from CustomersListPage.
- `technology`: **dynamic**, populated from `useServiceTechnologies()` (the catalog hook). The dropdown is `[{ value:'', label:'Todas' }, ...catalog.map(t => ({ value: t.name, label: t.name }))]`. Empty catalog → only the "Todas" option renders (CP-4.3, graceful).

### AD-2: Two hooks, two API modules — one per concern
- `src/api/contracts.api.ts` + `src/hooks/useContracts.ts` → list of contracts (`Service`) from `GET /api/services` with `?search&status&technology&page`. Returns the same `PaginatedResponse<ContractSummary>` shape the backend already uses (do NOT reinvent pagination — reuse the `{ data, total, totalPages }` contract, per CP constraint).
- `src/api/serviceTechnologies.api.ts` + `src/hooks/useServiceTechnologies.ts` → CRUD against `GET/POST/PUT/DELETE /api/service-technologies` (the catalog from the backend `service-technology` change).

Search debounce is **300ms** to match CustomersListPage (the spec constraint). Implement with a debounced setter feeding the hook param (same approach as the customers page — FilterBar `onSearch` → `setSearch` → effect updates URL + query).

### AD-3: ServiceTechnologiesPage mirrors the TaskCategories catalog UI
The catalog admin UI follows `TaskCategoriesBody` (`src/pages/scheduling/settings/TaskCategoriesBody.tsx`):
- Toolbar with "+ Nueva tecnología" → modal.
- Table: Nombre / Descripción / acciones (Editar / Eliminar).
- Create/Edit via a shared modal component; name required.
- 409 `SERVICE_TECHNOLOGY_NAME_CONFLICT` → inline "Ya existe una tecnología con ese nombre." (no crash, CP-7.3).
- 409 `SERVICE_TECHNOLOGY_IN_USE` on delete → alert "No se puede eliminar: hay servicios que usan esta tecnología." (CP-7.6).
- `useConfirm()` for delete confirmation.
- TanStack Query `invalidateQueries` after every mutation (CP constraint) — same as `useTaskCategories` hooks.

**Approaches compared:** inline-edit-in-row (proposal mentioned) vs. modal (TaskCategories pattern). **Chosen: modal**, because it's the proven, tested catalog pattern already in the repo and keeps create/edit logic in one place. The page = thin wrapper (`ServiceTechnologiesPage.tsx`) + body component, exactly like `SchedulingTaskCategoriesPage` → `TaskCategoriesBody`.

### AD-4: Routing — insert a `contracts` block between `crm` and `sla`
`App.tsx` route blocks are alphabetically grouped. The CRM block ends at line 278 (`</Route>`), the SLA block starts at line 280. `contracts` sorts between `crm` and `sla`, so the new block is inserted at **line 279** (the blank line after CRM closes), preserving order and not touching any existing route.

```tsx
{/* ── Contracts (contracts.read) — 2 routes ─────────────────────── */}
<Route path="contracts">
  <Route path="list" element={<RequirePermission permission="contracts.read"><ContractsListPage /></RequirePermission>} />
  <Route path="technologies" element={<RequirePermission permission="contracts.read"><ServiceTechnologiesPage /></RequirePermission>} />
</Route>
```

Both pages are lazy-loaded (CP constraint): add near the other `lazy()` imports at the top of `App.tsx`:
```tsx
const ContractsListPage = lazy(() => import('@/pages/contracts/ContractsListPage'));
const ServiceTechnologiesPage = lazy(() => import('@/pages/contracts/ServiceTechnologiesPage'));
```

Route count: 94 → 96. The explicit `— 2 routes` comment makes the count auditable. `App.routing.test.tsx` will assert both new paths resolve and no existing route breaks (CP-8).

### AD-5: Page reset on filter change
Every filter/search change resets `page` to 1 (CP-5.3), exactly as CustomersListPage does (`setStatus(...); setPage(1)`). The technology filter follows the same rule.

---

## File Plan

| File | Purpose |
|------|---------|
| `src/types/contract.ts` | `ContractSummary` + `PaginatedResponse` types |
| `src/types/serviceTechnology.ts` | `ServiceTechnology` interface |
| `src/api/contracts.api.ts` | `list({ page, search, status, technology })` → axios-client |
| `src/api/serviceTechnologies.api.ts` | list/getById/create/update/delete |
| `src/hooks/useContracts.ts` | TanStack Query list hook, URL/debounce wiring helper |
| `src/hooks/useServiceTechnologies.ts` | list + create/update/delete mutations w/ invalidation |
| `src/pages/contracts/ContractsListPage.tsx` | list page (FilterBar + DataTable + Pagination) |
| `src/pages/contracts/ServiceTechnologiesPage.tsx` | thin wrapper around catalog body |
| `src/pages/contracts/ServiceTechnologiesBody.tsx` | catalog CRUD body (mirror TaskCategoriesBody) |
| `src/App.tsx` | 2 lazy imports + 1 `contracts` route block |

---

## Testing Strategy (STRICT TDD — Vitest + Testing Library)

- Mock the **API layer (axios-client)**, NOT TanStack Query internals (CP constraint).
- `ContractsListPage.test.tsx`: render with data / empty / loading / error (CP-1); debounce 300ms (CP-2, fake timers); status filter + URL (CP-3); technology dropdown populated from catalog + filter + URL (CP-4); pagination + page reset (CP-5); permission guard render/block (CP-6).
- `ServiceTechnologiesPage.test.tsx`: render rows (CP-7.1); create + invalidation (CP-7.2); duplicate 409 inline error (CP-7.3); edit (CP-7.4); delete unused (CP-7.5); delete in-use 409 error (CP-7.6).
- `App.routing.test.tsx`: both new routes resolve under `contracts.read`; existing routes intact; count = 96 (CP-8).
- Red → green → refactor for each. Verification: `npm test` (vitest) green + `npx tsc --noEmit` (or `npm run typecheck`) clean.
