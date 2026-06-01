# Design — contratos-naming-fe (v2, rebuilt on origin/main aef5474)

## Context & Constraints

- **Branch base**: origin/main (aef5474). All file paths and state reflect this exact origin.
- **Pinned BE contract** (architect-fixed, LOCKSTEP):
  - Wire: `/api/clients/:id/contracts`, `/api/contracts`, `/api/contracts/stats`
  - Payload key `contractId` (replaces `serviceId` in task-linked contexts)
  - Error code `CONTRACT_NOT_FOUND` (replaces `SERVICE_NOT_FOUND`)
  - FE deploys only after `contratos-naming-be` is live in production
- **RENAME-ONLY rule**: zero functionality removed. Every feature that works today must keep working — we rename, we do not delete.
- **Conflict surface**: `CreateTaskModal.tsx`, `types/scheduling.ts`, `SchedulingTaskDetailPage.tsx` overlap with `tickets-redesign-fe`. This change is the **base layer**; `tickets-redesign-fe` stacks on top. The rename we do here will be in the worktree used as the base for tickets-redesign-fe.

---

## Architecture — What Origin Already Has

### Already partially renamed (no work needed on naming itself):

| Artifact | Status |
|---|---|
| `src/types/contract.ts` — `ContractSummary` | Done |
| `src/hooks/useContracts.ts` — `useContracts`, `useContractStats` | Done |
| `src/pages/contracts/ContractsListPage.tsx` | Done (page already says "Contratos") |
| `src/pages/contracts/ContractStatsCards.tsx` | Done |
| `src/api/contracts.api.ts` — exports `listContracts`, `getContractStats` | File exists |
| Sidebar — "Contratos" sub-item under Clientes, `contracts.read` permission | Done |

### NOT yet renamed / still using service naming:

| Artifact | Current State | Target State |
|---|---|---|
| `src/api/contracts.api.ts` line 20 | `GET /services` | `GET /contracts` |
| `src/api/contracts.api.ts` line 27 | `GET /services/stats` | `GET /contracts/stats` |
| `src/api/customers.api.ts` line 74 | `GET /clients/${id}/services` | `GET /clients/${id}/contracts` |
| `src/api/customers.api.ts` fn name | `getClientServices` | `getClientContracts` |
| `src/api/customers.api.ts` fn name | `addClientService` | `addClientContract` |
| `src/api/customers.api.ts` fn name | `updateClientService` | `updateClientContract` |
| `src/api/customers.api.ts` fn name | `deleteClientService` | `deleteClientContract` |
| `src/api/customers.api.ts` payload type | `AddServiceData`, `UpdateServiceData` | `AddContractData`, `UpdateContractData` |
| `src/types/customer.ts` | `Service`, `AddServiceData`, `UpdateServiceData` | `Contract`, `AddContractData`, `UpdateContractData` |
| `src/types/customer.ts` `Customer.services` | `services: Service[]` | `contracts: Contract[]` |
| `src/types/scheduling.ts` `CreateTaskPayload.serviceId` | `serviceId: string \| null` | `contractId: string \| null` |
| `src/types/scheduling.ts` `ScheduledTask.serviceId` | `serviceId: string \| null` | `contractId: string \| null` |
| `src/hooks/useCustomers.ts` | `useClientServices`, `useAddService`, `useUpdateService`, `useDeleteService` | `useClientContracts`, `useAddContract`, `useUpdateContract`, `useDeleteContract` |
| `src/pages/customers/tabs/ServicesTab.tsx` | file + component name | `ContractsTab.tsx`, `ContractsTab` |
| `src/pages/customers/CustomerDetailPage.tsx` tab | id `'services'`, label `'Servicios'` | id `'contracts'`, label `'Contratos'` |
| `src/pages/customers/CustomerDetailPage.tsx` | `TAB_IDS` array | include `'contracts'` not `'services'` |
| `src/pages/customers/CustomerDetailPage.tsx` import | `ServicesTab` | `ContractsTab` |
| `src/pages/scheduling/.../DatosForm.tsx` | label `'Servicio'`, picker option `{s.plan} ({s.type})` | label `'Contrato'`, picker option `buildContractLabel(s)` |
| `src/pages/scheduling/.../DatosForm.tsx` | field name `serviceId` in `DatosFormValues` | `contractId` |
| `src/pages/scheduling/.../DatosForm.tsx` | `useClientServices` import | `useClientContracts` |
| `src/pages/scheduling/.../ServiceCard.tsx` | heading `'Servicio'`, fallback `Servicio #${serviceId}` | `'Contrato'`, `Contrato #${contractId}` |
| `src/pages/scheduling/.../ServiceCard.tsx` | prop `serviceId` | `contractId` |
| `src/pages/scheduling/.../ServiceCard.tsx` | link `#servicios` | `#contratos` |
| `src/pages/scheduling/.../CustomerSidebar.tsx` | prop `serviceId` | `contractId` |
| `src/pages/scheduling/.../CustomerSidebar.tsx` | `useClientServices` | `useClientContracts` |
| `src/pages/scheduling/.../CustomerSidebar.tsx` | maps `{ plan, type }` to ServiceCard | maps `{ plan, type, address, technology }` to ContractCard |
| `src/pages/scheduling/SchedulingTasksPage/.../CreateTaskModal.tsx` | label `'Servicio'`, option `{s.plan} ({s.type})`, merge var `servicio` | label `'Contrato'`, option `buildContractLabel(s)`, merge var `contrato` |
| `src/pages/scheduling/SchedulingTasksPage/.../CreateTaskModal.tsx` | `serviceId` state | `contractId` state |
| `src/pages/scheduling/SchedulingTasksPage/.../CreateTaskModal.tsx` | `useClientServices` | `useClientContracts` |
| `src/pages/scheduling/lib/taskVariables.ts` | `servicio` only | `servicio` + `contrato` alias |
| `src/pages/scheduling/SchedulingTaskDetailPage.tsx` | `serviceId` field references | `contractId` |

---

## Key Design Decisions

### D1 — API wire rename scope

**Only** `contracts.api.ts` and `customers.api.ts` (client contracts endpoint) change their URL. The `/api/clients/:id/services` → `/api/clients/:id/contracts` is the LOCKSTEP rename. No other API file is affected.

### D2 — `Service` type rename strategy

`Service` → `Contract` in `src/types/customer.ts`. This is a TypeScript rename — the shape is identical. TypeScript's compiler will catch every callsite that breaks. The `Contract` type gains one new optional field:

```ts
/** Service technology name from the ServiceTechnology catalog. Null when not set. */
technology?: string | null;
```

This field is what BE will start returning on `/api/clients/:id/contracts`. It was already present on `ContractSummary` in `src/types/contract.ts`.

### D3 — `buildContractLabel` function

**Location**: new file `src/lib/buildContractLabel.ts`

**Signature**:
```ts
export interface ContractLabelInput {
  id: number | string;
  plan: string | null | undefined;
  address?: string | null;
  technology?: string | null;
}

export function buildContractLabel(contract: ContractLabelInput): string {
  if (!contract.plan) return `Contrato #${contract.id}`;
  const segments = [
    contract.plan,
    contract.address ?? null,
    contract.technology ?? null,
  ].filter((s): s is string => s != null && s !== '');
  return segments.join(' - ');
}
```

**Key design choices**:
- `technology` is the REAL field from the `ServiceTechnology` catalog (the `.name` of the entity). NOT derived from plan name. NOT classifyTech. The BE sends it.
- `address` comes from `Contract.address` (already optional on the `Service` type — the field existed for the task-service-location change).
- Fallback: if plan is empty/null → `"Contrato #${id}"`.
- Segments filter: empty string and null/undefined are dropped.
- Order: `plan → address → technology` (fixed).

**NO `classifyTech` heuristic** — the old design included it as a fallback. The v2 design drops it entirely. If `technology` is null, it's omitted. No guessing.

### D4 — Address gap in CustomerSidebar

`CustomerSidebar` currently maps only `{ plan, type }` from the resolved contract to `ServiceCard`. To show address in `buildContractLabel`, we need to pass `address` too.

**Solution**: widen the mapping in `CustomerSidebar`:
```ts
const contractDetail = resolvedContract
  ? { plan: resolvedContract.plan, type: resolvedContract.type, address: resolvedContract.address ?? null, technology: resolvedContract.technology ?? null }
  : null;
```

`ContractCard` (renamed from `ServiceCard`) receives the full detail including `address` and `technology` — used in `buildContractLabel` for its heading/fallback display.

### D5 — `{{contrato}}` alias in taskVariables.ts

The `{{servicio}}` token stays. We ADD `{{contrato}}` as an alias resolving to the same value. This is ADDITIVE — existing tasks/templates using `{{servicio}}` keep working.

```ts
export interface TaskVariableValues {
  cliente?: string | null;
  telefono?: string | null;
  servicio?: string | null;   // kept for backward compat
  contrato?: string | null;   // alias — same value as servicio at resolution time
  direccion?: string | null;
}
```

At resolution in `CreateTaskModal`, set BOTH `servicio` and `contrato` to the same `buildContractLabel(contract)` value.

### D6 — CustomerDetailPage tab rename

```ts
// Before
{ id: 'services', label: 'Servicios', content: <ServicesTab ... /> }
TAB_IDS = ['information', 'services', 'billing', ...]

// After
{ id: 'contracts', label: 'Contratos', content: <ContractsTab ... /> }
TAB_IDS = ['information', 'contracts', 'billing', ...]
```

The hash anchor `#servicios` in `ServiceCard` link → `#contratos`.

**Hash backward compat**: add `'services'` to `TAB_IDS` as a read alias (the `onHashChange` handler maps it to `'contracts'`). This prevents broken links from bookmarks or external references. One extra entry in `TAB_IDS` = `'services'`, handled by:
```ts
const HASH_ALIASES: Record<string, string> = { services: 'contracts' };
// In handlers: const resolved = HASH_ALIASES[hash] ?? hash;
```

### D7 — `ServiceInventorySection` — rename consistently, keep working

`ServiceInventorySection` is embedded in `ContractsTab` (renamed from `ServicesTab`). It uses `serviceId` as its prop because it connects to `src/api/serviceInventory.api.ts` which calls `/service-inventory/:serviceId/items`. This endpoint is NOT part of the contratos-naming-be rename. Therefore `ServiceInventorySection.serviceId` prop stays as `serviceId` internally — the prop name isn't user-visible. Only the button label inside it ("Agregar SN al servicio") gets renamed to "Agregar SN al contrato".

### D8 — Conflict surface with tickets-redesign-fe

Files touched by both changes:
- `src/types/scheduling.ts` — `serviceId` → `contractId` on `CreateTaskPayload` + `ScheduledTask`
- `src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx`
- `src/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm.tsx`
- `src/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar.tsx`
- `src/pages/scheduling/SchedulingTaskDetailPage.tsx` (reads `task.serviceId`)

**Resolution**: this change (`contratos-naming-fe`) runs first on the worktree. `tickets-redesign-fe` will branch off from this worktree's result (or rebase on top). The orchestrator must enforce ordering.

---

## File Inventory — Full Change Set

### Group A — Wire rename (API layer)
| File | Change |
|---|---|
| `src/api/contracts.api.ts` | Lines 20, 27: `/services` → `/contracts`, `/services/stats` → `/contracts/stats` |
| `src/api/customers.api.ts` | URL `/clients/${id}/services` → `/clients/${id}/contracts`; rename 4 functions; rename payload types |

### Group B — Types
| File | Change |
|---|---|
| `src/types/customer.ts` | `Service` → `Contract`; `AddServiceData` → `AddContractData`; `UpdateServiceData` → `UpdateContractData`; `Customer.services` → `Customer.contracts`; add `technology?: string \| null` to `Contract` |
| `src/types/scheduling.ts` | `CreateTaskPayload.serviceId` → `contractId`; `ScheduledTask.serviceId` → `contractId` |

### Group C — New utility
| File | Change |
|---|---|
| `src/lib/buildContractLabel.ts` | New file. `ContractLabelInput` interface + `buildContractLabel()` function |

### Group D — Hook layer
| File | Change |
|---|---|
| `src/hooks/useCustomers.ts` | Rename `useClientServices` → `useClientContracts`; `useAddService` → `useAddContract`; `useUpdateService` → `useUpdateContract`; `useDeleteService` → `useDeleteContract`; update all internal imports |

### Group E — Customer tabs
| File | Change |
|---|---|
| `src/pages/customers/tabs/ServicesTab.tsx` | Rename file → `ContractsTab.tsx`, component → `ContractsTab`; update internal: hook names, UI strings ("servicio" → "contrato"), keep `ServiceInventorySection` working |
| `src/pages/customers/tabs/ServiceInventorySection.tsx` | Button label: "Agregar SN al servicio" → "Agregar SN al contrato" |
| `src/pages/customers/CustomerDetailPage.tsx` | Import `ContractsTab`; tab id `'services'`→`'contracts'`, label `'Servicios'`→`'Contratos'`; TAB_IDS update; add `HASH_ALIASES` for backward compat |

### Group F — Scheduling forms
| File | Change |
|---|---|
| `src/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm.tsx` | `DatosFormValues.serviceId` → `contractId`; label `'Servicio'` → `'Contrato'`; picker option: `buildContractLabel(s)`; `useClientServices` → `useClientContracts` |
| `src/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar.tsx` | Prop `serviceId` → `contractId`; `useClientServices` → `useClientContracts`; widen mapping to include `address` + `technology` |
| `src/pages/scheduling/SchedulingTaskDetailPage/components/ServiceCard.tsx` | Rename file → `ContractCard.tsx`, component → `ContractCard`; prop `serviceId` → `contractId`; heading `'Servicio'` → `'Contrato'`; fallback `'Servicio #'` → `'Contrato #'`; link `#servicios` → `#contratos` |
| `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskDetailsTab.tsx` | Update import: `ServiceCard` → `ContractCard` |
| `src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx` | `serviceId` state/prop → `contractId`; label `'Servicio'` → `'Contrato'`; picker option: `buildContractLabel(s)`; `useClientServices` → `useClientContracts`; merge vars: add `contrato` alias |
| `src/pages/scheduling/SchedulingTaskDetailPage.tsx` | `task.serviceId` → `task.contractId`; prop `serviceId` → `contractId` in `DatosForm` + `CustomerSidebar` |
| `src/pages/scheduling/lib/taskVariables.ts` | Add `contrato` alias (ADDITIVE — keep `servicio`) |

### Group G — Calendar & other scheduling surfaces
| File | Change |
|---|---|
| `src/pages/scheduling/SchedulingCalendarPage/index.tsx` | If it reads/passes `serviceId` → `contractId` |

### Group H — Tests
| File | Change |
|---|---|
| `src/__tests__/scheduling/components/CreateTaskModal.test.tsx` | Update `serviceId` → `contractId`; update option label assertions |
| `src/__tests__/scheduling/components/DatosForm.test.tsx` | Update `serviceId` → `contractId`; label assertions |
| `src/__tests__/scheduling/CustomerSidebar.test.tsx` | Update prop `serviceId` → `contractId` |
| `src/__tests__/scheduling/SchedulingTaskDetailPage.test.tsx` | Update `serviceId` → `contractId` |
| `src/__tests__/scheduling/TaskDetailsTab.test.tsx` | Update import if ServiceCard → ContractCard |
| New: `src/__tests__/lib/buildContractLabel.test.ts` | TDD-first. 7 test cases (see below) |

---

## `buildContractLabel` Test Specification

```
1. plan only: { id: 1, plan: 'Internet 100MB' } → 'Internet 100MB'
2. plan + address: { id: 1, plan: 'Plan A', address: 'Av. Corrientes 123' } → 'Plan A - Av. Corrientes 123'
3. plan + technology: { id: 1, plan: 'Plan A', technology: 'Fibra' } → 'Plan A - Fibra'
4. all segments: { id: 1, plan: 'Plan A', address: 'Av. 123', technology: 'Fibra' } → 'Plan A - Av. 123 - Fibra'
5. null plan → fallback: { id: 42, plan: null } → 'Contrato #42'
6. empty plan string → fallback: { id: 7, plan: '' } → 'Contrato #7'
7. empty address/tech filtered: { id: 1, plan: 'Plan A', address: '', technology: null } → 'Plan A'
```

---

## `taskVariables` Extension Test Specification

```
8. {{contrato}} resolves same as {{servicio}}: contrato = 'Plan A - Fibra' → resolved
9. {{servicio}} still resolves (backward compat): servicio = 'Plan A' → still resolved
10. Both tokens in same template: both resolve independently
```

---

## Deployment Constraint

`contratos-naming-fe` MUST deploy LOCKSTEP with `contratos-naming-be`. The BE routes `/api/clients/:id/contracts` and `/api/contracts` must be live before ANY FE code using those URLs goes to production. Feature flag is NOT required — the deploy sequence enforces this (BE first, then FE).

---

## What Does NOT Change

- `src/api/serviceInventory.api.ts` — internal URL `/service-inventory/:serviceId/items` is NOT renamed (not in scope of contratos-naming-be)
- `ServiceInventorySection` component name — stays. Only its button label changes.
- `src/api/contracts.api.ts` export names (`listContracts`, `getContractStats`, `ContractsQuery`, `ContractStats`) — already correct
- `src/hooks/useContracts.ts` — already correct
- `src/types/contract.ts` (`ContractSummary`) — already correct
- `src/pages/contracts/ContractsListPage.tsx` — already correct (no `serviceId` refs)
- `src/pages/contracts/ContractStatsCards.tsx` — already correct
- `src/components/organisms/Sidebar/Sidebar.tsx` — "Contratos" entry already present
- RBAC permission `contracts.read` — already in place
