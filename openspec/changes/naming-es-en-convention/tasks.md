# Tasks — naming-es-en-convention

## Execution Rules (read before starting)

- **One domain per phase** — never rename two domains in the same commit.
- **Each phase MUST leave the app in a working state**: `tsc --noEmit` + `npx vitest run` green.
- **Use `git mv`** for every rename — never copy+delete.
- **Find all consumers before renaming** with `rg "<old-name>"` across `src/` and `src/__tests__/`.
- **No push until a phase is fully verified**.
- Phases are ordered by risk (low → high) and dependency (types/api before hooks before pages).

---

## Phase 0 — Inventory & Verification Baseline

> Goal: confirm which files reference each Spanish name before touching anything.

- [ ] Run `rg "empresa" src/ --include="*.ts" --include="*.tsx" -l` and save the list.
- [ ] Run `rg "clientes|ClientesListPage|ClienteDetail|AddClientePage|EditClientePage" src/ -l` and save.
- [ ] Run `rg "ubicacion|Ubicacion" src/ -l` and save.
- [ ] Run `rg "from.*voz\b|import.*voz\b" src/ -l` and save.
- [ ] Run `npx vitest run` — confirm baseline is green before any change.
- [ ] Run `tsc --noEmit` — confirm zero errors at baseline.

---

## Phase 1 — Types: `voz.ts` → `voice.ts` and `ubicacion.ts` → `location.ts`

Low risk: only 2 consumers each. Start here to build muscle memory on the process.

- [ ] `git mv src/types/voz.ts src/types/voice.ts`
- [ ] Update import in `src/api/voz.api.ts`: `from '@/types/voz'` → `from '@/types/voice'`
- [ ] Update import in `src/hooks/useVoz.ts`: `from '@/types/voz'` → `from '@/types/voice'`
- [ ] `tsc --noEmit` — green.
- [ ] `git mv src/types/ubicacion.ts src/types/location.ts`
- [ ] Update import in `src/api/ubicaciones.api.ts`: `from '@/types/ubicacion'` → `from '@/types/location'`
- [ ] Update import in `src/hooks/useUbicaciones.ts`: `from '@/types/ubicacion'` → `from '@/types/location'`
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename voz.ts → voice.ts, ubicacion.ts → location.ts`

---

## Phase 2 — API: `voz.api.ts` → `voice.api.ts` and `ubicaciones.api.ts` → `locations.api.ts`

- [ ] `git mv src/api/voz.api.ts src/api/voice.api.ts`
- [ ] `rg "voz\.api" src/ -l` — update every import found.
- [ ] Known consumer: `src/hooks/useVoz.ts` — update its import.
- [ ] `git mv src/api/ubicaciones.api.ts src/api/locations.api.ts`
- [ ] `rg "ubicaciones\.api" src/ -l` — update every import found.
- [ ] Known consumer: `src/hooks/useUbicaciones.ts` — update.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename voz.api.ts → voice.api.ts, ubicaciones.api.ts → locations.api.ts`

---

## Phase 3 — Hooks: `useVoz.ts` → `useVoice.ts` and `useUbicaciones.ts` → `useLocations.ts`

- [ ] `git mv src/hooks/useVoz.ts src/hooks/useVoice.ts`
- [ ] `rg "useVoz\b" src/ -l` — update every import and usage.
- [ ] `git mv src/hooks/useUbicaciones.ts src/hooks/useLocations.ts`
- [ ] `rg "useUbicaciones\b" src/ -l` — update every import and usage.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename useVoz → useVoice, useUbicaciones → useLocations`

---

## Phase 4 — Pages: `sistema/` → `system/` + component renames

- [ ] `git mv src/pages/sistema src/pages/system`
- [ ] `git mv src/pages/system/UbicacionesPage.tsx src/pages/system/LocationsPage.tsx`
- [ ] `git mv src/pages/system/AdministracionPage.tsx src/pages/system/AdminPage.tsx`
- [ ] `git mv src/pages/system/ConfiguracionPage.tsx src/pages/system/SettingsPage.tsx`
- [ ] Update App.tsx lazy imports: `sistema/UbicacionesPage` → `system/LocationsPage`, etc.
- [ ] Update App.tsx component variable names: `UbicacionesPage` → `LocationsPage`, `AdministracionPage` → `AdminPage`, `ConfiguracionPage` → `SettingsPage`
- [ ] Rename export identifiers inside each .tsx file to match new names.
- [ ] `git mv src/__tests__/sistema src/__tests__/system`
- [ ] Update test file imports referencing the old page paths.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename sistema/ → system/, UbicacionesPage → LocationsPage, etc.`

---

## Phase 5 — Pages: `mensajes/` → `messages/` + `informes/` → `reports/`

- [ ] `git mv src/pages/mensajes src/pages/messages`
- [ ] `git mv src/pages/messages/MensajesPage.tsx src/pages/messages/MessagesPage.tsx`
- [ ] Update export inside `MessagesPage.tsx`.
- [ ] Update App.tsx import and variable name.
- [ ] `git mv src/pages/informes src/pages/reports`
- [ ] `git mv src/pages/reports/InformesPage.tsx src/pages/reports/ReportsPage.tsx`
- [ ] Update export inside `ReportsPage.tsx`.
- [ ] Update App.tsx import and variable name.
- [ ] `git mv src/__tests__/mensajes src/__tests__/messages` (if exists)
- [ ] `git mv src/__tests__/informes src/__tests__/reports` (if exists)
- [ ] Update test file imports.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename mensajes/ → messages/, informes/ → reports/`

---

## Phase 6 — Pages: `finanzas/` → `finance/`

Larger folder (8 page files), but all pages within are already English-named.

- [ ] `git mv src/pages/finanzas src/pages/finance`
- [ ] Update App.tsx: all 8 lazy imports from `finanzas/` → `finance/`.
- [ ] `git mv src/__tests__/finanzas src/__tests__/finance` (if exists)
- [ ] Update test file imports.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename finanzas/ → finance/`

---

## Phase 7 — API + Hook: `clients.api.ts` → `customers.api.ts` + `useClients.ts` → `useCustomers.ts`

Do the API and hook together — they are tightly coupled (hook imports the API).

- [ ] `git mv src/api/clients.api.ts src/api/customers.api.ts`
- [ ] `git mv src/hooks/useClients.ts src/hooks/useCustomers.ts`
- [ ] Update import inside `useCustomers.ts`: `from '@/api/clients.api'` → `from '@/api/customers.api'`
- [ ] `rg "useClients\b|clients\.api" src/ -l` — update all consumers.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename clients.api.ts → customers.api.ts, useClients → useCustomers`

---

## Phase 8 — Pages + Tests: `clientes/` → `customers/` + component renames

High consumer count (16 imports in App.tsx, 16 test files). Do last after API/hook are settled.

- [ ] `git mv src/pages/clientes src/pages/customers`
- [ ] Component renames within `customers/`:
  - [ ] `git mv ClientesListPage.tsx CustomersListPage.tsx`
  - [ ] `git mv ClienteDetailPage.tsx CustomerDetailPage.tsx`
  - [ ] `git mv AddClientePage.tsx AddCustomerPage.tsx`
  - [ ] `git mv EditClientePage.tsx EditCustomerPage.tsx`
  - [ ] `git mv ClientesOnlinePage.tsx CustomersOnlinePage.tsx` (if kept)
- [ ] Tab renames within `customers/tabs/`:
  - [ ] `git mv ActividadTab.tsx ActivityTab.tsx`
  - [ ] `git mv ArchivosTab.tsx FilesTab.tsx`
  - [ ] `git mv ComentariosTab.tsx CommentsTab.tsx`
  - [ ] `git mv DocumentosTab.tsx DocumentsTab.tsx`
  - [ ] `git mv EstadisticasTab.tsx StatsTab.tsx`
  - [ ] `git mv FacturacionTab.tsx BillingTab.tsx`
  - [ ] `git mv InformacionTab.tsx InfoTab.tsx`
  - [ ] `git mv ServiciosTab.tsx ServicesTab.tsx`
- [ ] Update export identifiers inside each renamed file.
- [ ] Update App.tsx: all lazy imports + variable names.
- [ ] Update any cross-references between tab files and detail page.
- [ ] `git mv src/__tests__/clientes src/__tests__/customers`
- [ ] Update test file imports.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): rename clientes/ → customers/, ClientesListPage → CustomersListPage, etc.`

---

## Phase 9 — Types: `empresa.ts` split

Before splitting `empresa.api.ts`, establish the new type files.

- [ ] Create `src/types/service-plans.ts` — move `ServicePlan`, `PlanSubtype` from `empresa.ts`.
- [ ] Create `src/types/network-devices.ts` — move `NetworkDevice` from `empresa.ts`.
- [ ] Create `src/types/inventory.ts` — move `InventoryItem`, `InventoryProduct`, `InventoryUnit`, `SupplyOrder` from `empresa.ts`. Fix Spanish field names in `SupplyOrder`: `proveedor` → `supplier`, `estado` → `status`, `fecha` → `date`.
- [ ] Delete `src/types/empresa.ts`.
- [ ] Update `src/api/empresa.api.ts` imports to new type files.
- [ ] Update `src/hooks/useEmpresa.ts` imports.
- [ ] `rg "from.*types/empresa" src/ -l` — update all remaining consumers.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): split empresa.ts → service-plans.ts, network-devices.ts, inventory.ts`

---

## Phase 10 — API: Split `empresa.api.ts` into domain modules

- [ ] Create `src/api/service-plans.api.ts` — extract ServicePlan functions.
- [ ] Create `src/api/network-devices.api.ts` — extract NetworkDevice functions.
- [ ] Create `src/api/inventory.api.ts` — extract all inventory functions (items, products, units, supply orders).
- [ ] `rg "empresa\.api" src/ -l` — for each consumer, redirect imports to the correct new module.
- [ ] Known consumers: `useEmpresa.ts`, `pages/empresa/InventarioPage.tsx`, `pages/inventory/*.tsx`.
- [ ] Delete `src/api/empresa.api.ts`.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): split empresa.api.ts → service-plans.api.ts, network-devices.api.ts, inventory.api.ts`

---

## Phase 11 — Hooks: Split `useEmpresa.ts`

- [ ] Create `src/hooks/useServicePlans.ts` — wraps `service-plans.api.ts` queries.
- [ ] Create `src/hooks/useNetworkDevices.ts` — wraps `network-devices.api.ts` queries.
- [ ] Inventory hooks: `src/hooks/useHardware.ts` may already cover some; evaluate and create `useInventory.ts` if needed.
- [ ] Update all consumers of `useEmpresa.ts` to import from the appropriate new hook.
- [ ] Delete `src/hooks/useEmpresa.ts`.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): split useEmpresa.ts → useServicePlans.ts, useNetworkDevices.ts`

---

## Phase 12 — Pages: Dissolve `empresa/` folder

Move remaining empresa pages to their domain folders (per design ADR-3).

- [ ] `git mv src/pages/empresa/GestionRedPage.tsx src/pages/networking/GestionRedPage.tsx`
- [ ] `git mv src/pages/empresa/NetworkSitesPage.tsx src/pages/networking/NetworkSitesPage.tsx` (check for name conflict with existing)
- [ ] `git mv src/pages/empresa/CpePage.tsx src/pages/networking/CpePage.tsx`
- [ ] `git mv src/pages/empresa/Tr069Page.tsx src/pages/networking/Tr069Page.tsx`
- [ ] `git mv src/pages/empresa/HardwarePage.tsx src/pages/networking/HardwarePage.tsx`
- [ ] `git mv src/pages/empresa/InventarioPage.tsx src/pages/inventory/InventoryLegacyPage.tsx`
- [ ] `git mv src/pages/empresa/VozPage.tsx src/pages/voice/VoiceLegacyPage.tsx`
- [ ] Create `src/pages/tariffs/` folder.
- [ ] `git mv src/pages/empresa/TarifasPage.tsx src/pages/tariffs/TariffsPage.tsx`
- [ ] `git mv src/pages/empresa/tarifas/ src/pages/tariffs/` (all 6 sub-pages)
- [ ] Delete `src/pages/empresa/SchedulingPage.tsx` (already commented-out in App.tsx, no route).
- [ ] Update App.tsx: all `@/pages/empresa/` imports → new paths.
- [ ] Update export identifiers in moved files.
- [ ] `git mv src/__tests__/empresa src/__tests__/networking` for networking tests; create `__tests__/tariffs/` for tariff tests; update imports.
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): dissolve empresa/ folder → networking/, inventory/, voice/, tariffs/`

---

## Phase 13 — scheduling.ts: Remove deprecated fields

- [ ] `rg "\.assignedTo\b|\.assignedToId\b|\.clientId\b|\.clientName\b|\.status\b|\.scheduledDate\b|\.scheduledTime\b" src/ -l` — confirm no remaining non-deprecated usages of the old fields.
- [ ] Remove from `ScheduledTask`: `assignedTo`, `assignedToId`, `clientId`, `clientName`, `status`, `scheduledDate`, `scheduledTime`.
- [ ] Remove `TaskStatus` type export.
- [ ] `tsc --noEmit` — green (any remaining usage will surface here).
- [ ] Fix any consumers that still use the removed fields.
- [ ] `npx vitest run` — green.
- [ ] Commit: `refactor(naming): remove deprecated fields from ScheduledTask, drop TaskStatus`

---

## Verification Checkpoint — End of All Phases

- [ ] `rg "empresa|clientes|finanzas|informes|mensajes|sistema\b|ubicacion|\.voz\b" src/ --include="*.ts" --include="*.tsx" -l` — should return zero results (except comments/strings).
- [ ] `tsc --noEmit` — green.
- [ ] `npx vitest run` — all tests green.
- [ ] `rg "empresa\.api\|voz\.api\|ubicaciones\.api\|clients\.api" src/ -l` — zero results.
- [ ] `pages/empresa/` directory no longer exists.
- [ ] `pages/clientes/` directory no longer exists.

---

## Deferral Options (if team wants to reduce scope)

If the full scope is too large for one cycle, the following subsets are independent and can be
delivered separately without breaking each other:

| Minimal batch | Phases | Files affected |
|--------------|--------|---------------|
| Quick wins (low churn) | 1-3 | voz, ubicacion, types + hooks only, ~12 files |
| Spanish API elimination | 1-3 + 7 | adds clients.api → customers.api, ~20 files |
| empresa dissolution (hardest) | 9-12 | ~60+ file path updates, high value |
| Full cleanup | 1-13 | all phases |
