# Tasks — contratos-naming-fe (v2, rebuilt on origin/main aef5474)

> TDD Mode: ACTIVE. Write the test FIRST (red), then implement (green), then clean up (refactor).
> RENAME-ONLY rule: every existing feature keeps working. Zero deletions.
> LOCKSTEP deploy: BE must be live before FE goes to production.

---

## Batch 1 — New utility (TDD-first, zero deps on other tasks)

- [ ] **T01** Write `src/__tests__/lib/buildContractLabel.test.ts` (7 cases from design spec — all RED)
- [ ] **T02** Create `src/lib/buildContractLabel.ts` with `ContractLabelInput` + `buildContractLabel()` — make T01 GREEN

---

## Batch 2 — Types (no external deps, required by all other tasks)

- [ ] **T03** `src/types/customer.ts`:
  - Rename `Service` → `Contract` (keep shape identical)
  - Add `technology?: string | null` field to `Contract`
  - Rename `AddServiceData` → `AddContractData`
  - Rename `UpdateServiceData` → `UpdateContractData`
  - Rename `Customer.services: Service[]` → `Customer.contracts: Contract[]`
- [ ] **T04** `src/types/scheduling.ts`:
  - `CreateTaskPayload.serviceId` → `contractId`
  - `ScheduledTask.serviceId` → `contractId`

---

## Batch 3 — API layer (depends on T03)

- [ ] **T05** `src/api/contracts.api.ts`:
  - Line ~20: `/services` → `/contracts`
  - Line ~27: `/services/stats` → `/contracts/stats`
- [ ] **T06** `src/api/customers.api.ts`:
  - URL `/clients/${id}/services` → `/clients/${id}/contracts`
  - Rename fn `getClientServices` → `getClientContracts`
  - Rename fn `addClientService` → `addClientContract`
  - Rename fn `updateClientService` → `updateClientContract`
  - Rename fn `deleteClientService` → `deleteClientContract`
  - Rename payload type refs `AddServiceData` → `AddContractData`, `UpdateServiceData` → `UpdateContractData`
  - Update import from `types/customer` accordingly

---

## Batch 4 — Hook layer (depends on T03, T06)

- [ ] **T07** `src/hooks/useCustomers.ts`:
  - Rename `useClientServices` → `useClientContracts` (export + internal)
  - Rename `useAddService` → `useAddContract`
  - Rename `useUpdateService` → `useUpdateContract`
  - Rename `useDeleteService` → `useDeleteContract`
  - Update all import refs from `customers.api.ts` (new fn names, new type names)

---

## Batch 5 — taskVariables extension (depends on T01/T02, isolated)

- [ ] **T08** Write test cases 8-10 in `src/__tests__/lib/taskVariables.test.ts` (or add to existing) — `{{contrato}}` alias (RED)
- [ ] **T09** `src/pages/scheduling/lib/taskVariables.ts`:
  - Add `contrato?: string | null` to `TaskVariableValues`
  - Add `contrato: /\{\{\s*contrato\s*\}\}/gi` to `TOKEN_PATTERNS`
  - Keep `servicio` untouched (backward compat)
  - Make T08 GREEN

---

## Batch 6 — Customer tabs (depends on T03, T07)

- [ ] **T10** Rename `src/pages/customers/tabs/ServicesTab.tsx` → `ContractsTab.tsx`:
  - Component: `ServicesTab` → `ContractsTab`
  - Imports: `useClientServices` → `useClientContracts`; `useAddService` → `useAddContract`; `useUpdateService` → `useUpdateContract`; `useDeleteService` → `useDeleteContract`
  - Type refs: `Service` → `Contract`; `AddServiceData` → `AddContractData`; `UpdateServiceData` → `UpdateContractData`
  - UI strings: "Agregar servicio" → "Agregar contrato"; "Editar servicio" → "Editar contrato"; "Eliminar servicio" → "Eliminar contrato"; "servicio" → "contrato" in confirm messages and empty states; "Este cliente no tiene servicios" → "Este cliente no tiene contratos"
  - Keep `ServiceInventorySection` import + usage exactly as-is (serviceId prop stays — it's for the inventory API which is NOT renamed)
- [ ] **T11** `src/pages/customers/tabs/ServiceInventorySection.tsx`:
  - Button label: "Agregar SN al servicio" → "Agregar SN al contrato"
  - Empty state: "Sin equipos cargados en este servicio" → "Sin equipos cargados en este contrato"
- [ ] **T12** `src/pages/customers/CustomerDetailPage.tsx`:
  - Import `ContractsTab` from `./tabs/ContractsTab` (remove `ServicesTab` import)
  - `TAB_IDS`: replace `'services'` with `'contracts'`; add `'services'` as handled-but-aliased (see HASH_ALIASES below)
  - Add `const HASH_ALIASES: Record<string, string> = { services: 'contracts' };`
  - `onHashChange` handler: `const resolved = HASH_ALIASES[hash] ?? hash; if (TAB_IDS.includes(resolved)) setActiveTab(resolved);`
  - Tab definition: `id: 'contracts'`, `label: 'Contratos'`, `content: <ContractsTab .../>`
  - Default tab init: handle `'services'` hash → resolves to `'contracts'`

---

## Batch 7 — Scheduling components (depends on T02, T04, T07)

- [ ] **T13** Rename `src/pages/scheduling/SchedulingTaskDetailPage/components/ServiceCard.tsx` → `ContractCard.tsx`:
  - Component: `ServiceCard` → `ContractCard`
  - Interface: `ServiceDetail` → `ContractDetail`; props: `serviceId` → `contractId`
  - Heading `aria-labelledby`: `"service-heading"` → `"contract-heading"`
  - Heading text: `'Servicio'` → `'Contrato'`
  - Fallback text: `'Servicio #${serviceId}'` → `'Contrato #${contractId}'`
  - Empty text: `'Sin servicio asignado'` → `'Sin contrato asignado'`
  - Link target: `#servicios` → `#contratos`
  - Link text: `'Ver servicio →'` → `'Ver contrato →'`
- [ ] **T14** `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskDetailsTab.tsx`:
  - Update import: `ServiceCard` → `ContractCard`
  - Update prop: `serviceId` → `contractId` on `ContractCard`
- [ ] **T15** `src/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar.tsx`:
  - Props interface: `serviceId` → `contractId`
  - `useClientServices` → `useClientContracts`
  - Variable naming: `clientServices` → `clientContracts`, `resolvedService` → `resolvedContract`
  - Widen mapping:
    ```ts
    const contractDetail = resolvedContract
      ? { plan: resolvedContract.plan, type: resolvedContract.type, address: resolvedContract.address ?? null, technology: resolvedContract.technology ?? null }
      : null;
    ```
  - Pass to `ContractCard`: `contractId={contractId}` + `contract={contractDetail}`
  - Import `ContractCard` instead of `ServiceCard`
- [ ] **T16** `src/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm.tsx`:
  - `DatosFormValues.serviceId` → `contractId`
  - `useClientServices` → `useClientContracts`; variable `customerServices` → `customerContracts`
  - Label `'Servicio'` → `'Contrato'`
  - Hydrate ref: update `initial.serviceId` → `initial.contractId`; `initial.serviceId` string check → `initial.contractId`
  - `watchedServiceId` → `watchedContractId`
  - Picker option: `{s.plan} ({s.type})` → `buildContractLabel(s)` (import from `@/lib/buildContractLabel`)
  - All `serviceId` refs in the form body → `contractId`
- [ ] **T17** `src/pages/scheduling/SchedulingTaskDetailPage.tsx`:
  - `task.serviceId` → `task.contractId` in all reads
  - Props passed to `DatosForm`: `serviceId` → `contractId`
  - Props passed to `CustomerSidebar`: `serviceId` → `contractId`
- [ ] **T18** `src/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal.tsx`:
  - State: `serviceId` → `contractId`; `setServiceId` → `setContractId`
  - `useClientServices` → `useClientContracts`; `customerServices` → `customerContracts`
  - Label `'Servicio'` → `'Contrato'`
  - Picker option: `{s.plan} ({s.type})` → `buildContractLabel(s)`
  - Merge vars: add `contrato: customerContracts.find(s => String(s.id) === contractId) ? buildContractLabel(...) : null`; keep `servicio` set to same value for backward compat
  - `canSave` check: `serviceId` → `contractId`
  - `onCreate` payload: `serviceId` → `contractId`
  - All hint text: "servicios" → "contratos"
  - All conditional text: "Sin servicio" → "Sin contrato"; "Cargando servicios" → "Cargando contratos"
- [ ] **T19** `src/pages/scheduling/SchedulingCalendarPage/index.tsx`:
  - If `serviceId` appears in task-related props/reads → `contractId`

---

## Batch 8 — Update existing tests (depends on T03, T04, T07, T10-T19)

- [ ] **T20** `src/__tests__/scheduling/components/CreateTaskModal.test.tsx`:
  - Prop/state refs: `serviceId` → `contractId`
  - Label assertions: "Servicio" → "Contrato"
  - Option label assertions: update to match `buildContractLabel` output
- [ ] **T21** `src/__tests__/scheduling/components/DatosForm.test.tsx`:
  - Prop refs: `serviceId` → `contractId`
  - Label assertions: "Servicio" → "Contrato"
- [ ] **T22** `src/__tests__/scheduling/CustomerSidebar.test.tsx`:
  - Prop: `serviceId` → `contractId`
- [ ] **T23** `src/__tests__/scheduling/SchedulingTaskDetailPage.test.tsx`:
  - Any `serviceId` in task fixtures → `contractId`
- [ ] **T24** `src/__tests__/scheduling/TaskDetailsTab.test.tsx`:
  - Import update if `ServiceCard` → `ContractCard` is referenced
- [ ] **T25** Any remaining test files referencing `ServicesTab`, `useClientServices`, `Service` type, `serviceId` in task context → update

---

## Dependency Order

```
T01 → T02                          (buildContractLabel: test first, then impl)
T03, T04                           (types: can run in parallel)
T05, T06                           (API: depends on T03)
T07                                (hooks: depends on T03, T06)
T08 → T09                          (taskVariables: test first, then impl)
T10, T11, T12                      (customer tabs: depends on T03, T07)
T13, T14                           (ContractCard + TaskDetailsTab: no type deps)
T15, T16, T17, T18, T19           (scheduling forms: depends on T02, T04, T07)
T20–T25                            (tests: depends on all implementation tasks)
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `npm test` passes (all 25+ tasks green)
- [ ] `/admin/contracts/list` loads and calls `GET /contracts` (not `/services`)
- [ ] `/admin/customers/view/:id#contracts` tab loads and calls `GET /clients/:id/contracts`
- [ ] Old `#services` hash redirects to `#contracts` tab (no 404, no blank tab)
- [ ] `ServiceInventorySection` still shows equipment per contract in ContractsTab
- [ ] CreateTaskModal: contract picker shows `buildContractLabel` format
- [ ] DatosForm: contract picker shows `buildContractLabel` format
- [ ] ServiceCard heading shows "Contrato", link goes to `#contratos`
- [ ] `{{contrato}}` resolves in task title/description
- [ ] `{{servicio}}` still resolves (backward compat — existing tasks not broken)
- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
