# Proposal: contracts-refactor

## Intent
Refactor the Contracts section UI to match the Customers section visual pattern, and reorganize the sidebar navigation.

## Scope

### A) Stats bar on ContractsListPage
- New `GET /api/services/stats → { total, byStatus: Record<string, number> }` API call
- New `getContractStats()` in `contracts.api.ts`
- New `useContractStats()` hook in `useContracts.ts` (TanStack Query, staleTime 60s)
- New `ContractStatsCards` component: "Contratos totales" + one card per `byStatus` key (dynamic, not hardcoded)
- Cards act as one-click filters (toggle status filter; clicking active card clears it)
- Visual tokens identical to `ClientStatsCards` (CSS Modules, same grid/card/value/label pattern)

### B) Sidebar: Contratos → under Clientes (CRM section)
- Remove `Contratos` accordion item from `EMPRESA_ITEMS`
- Add `Contratos` (→ `/admin/contracts/list`) and `Tecnologías` (→ `/admin/contracts/technologies`) as children of `Clientes` in `CRM_ITEMS`
- Add `/admin/contracts` to `Clientes.matchPaths` so the accordion auto-expands on contracts routes
- Add `requiredPermission?: string` to `SubItem` type; filter children by permission in Sidebar render
- Contracts children use `requiredPermission: 'contracts.read'`

## Approach
- Strict TDD: red → green → refactor
- No new accordion nesting — contracts children sit flat inside existing Clientes accordion
- Permission filtering happens in Sidebar scope (same `canSee` pattern extended to children)
