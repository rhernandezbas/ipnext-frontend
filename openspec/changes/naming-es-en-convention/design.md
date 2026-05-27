# Design — naming-es-en-convention

## Architecture Decision Record

### ADR-1: Converge to English

**Decision**: All code identifiers use English. UI copy stays in Spanish.

**Rationale**: 91% of API modules, 94% of hooks, 94% of type files and all component files are
already English. Converging to Spanish would require renaming ~117+ files and contradicts
industry norms for TypeScript/React codebases. Full justification in `proposal.md §Decision`.

**Alternatives considered**:
- A: Converge to Spanish — rejected (higher churn, contradicts existing majority, not idiomatic).
- B: Enforce language per layer (ES for pages, EN for API/hooks) — rejected (perpetuates the
  cross-layer confusion which is the root problem).
- C: Accept the mix as-is — rejected (the `empresa` god-folder is actively harmful; new devs have
  no convention to follow).

---

### ADR-2: Split `empresa.api.ts` into domain modules

**Decision**: Decompose the `empresa.api.ts` catch-all into domain-aligned modules.

**Proposed split**:

| New module | Exports | Replaces in empresa.api.ts |
|------------|---------|---------------------------|
| `service-plans.api.ts` | `getServicePlans`, `getServicePlan`, `createServicePlan`, `updateServicePlan`, `deleteServicePlan` | ServicePlan section |
| `network-devices.api.ts` | `getNetworkDevices`, `getNetworkDevice`, `createNetworkDevice`, `updateNetworkDevice` | NetworkDevice section |
| `inventory.api.ts` | all `getInventory*`, `createInventory*`, `updateInventory*`, `deleteInventory*`, `getSupplyOrders` | All inventory sections |

`billing.api.ts` already exists for the finance domain; no change there.

**Rationale**: Each new module aligns with an existing English page folder (`inventory/`, `voice/`).
The `useEmpresa.ts` hook will be split into `useServicePlans.ts`, `useNetworkDevices.ts`, and the
existing `useHardware.ts` absorbs hardware (it already exists). Inventory goes to the existing
`useHardware.ts` is a misnomer — inventory-specific queries get their own hook file.

**Alternative considered**: Keep `empresa.api.ts` intact and only rename it to `company.api.ts`.
Rejected because `company` doesn't map to any real domain — the file's problem is breadth, not
just language.

---

### ADR-3: Rename the `empresa` folder and distribute its pages

**Decision**: Dissolve `pages/empresa/` into target domain folders.

| Current path | Target path | Reason |
|-------------|------------|--------|
| `pages/empresa/GestionRedPage.tsx` | `pages/networking/GestionRedPage.tsx` | Belongs with networking pages |
| `pages/empresa/NetworkSitesPage.tsx` | `pages/networking/NetworkSitesPage.tsx` (already a near-duplicate) | Networking domain |
| `pages/empresa/CpePage.tsx` | `pages/networking/CpePage.tsx` | CPE = networking equipment |
| `pages/empresa/Tr069Page.tsx` | `pages/networking/Tr069Page.tsx` | TR-069 = device mgmt protocol |
| `pages/empresa/HardwarePage.tsx` | `pages/networking/HardwarePage.tsx` | Hardware inventory |
| `pages/empresa/InventarioPage.tsx` | `pages/inventory/InventarioPage.tsx` → rename to `InventoryLegacyPage.tsx` | Already superseded by inventory/ pages |
| `pages/empresa/VozPage.tsx` | `pages/voice/VozPage.tsx` → rename to `VoiceLegacyPage.tsx` | Voice domain |
| `pages/empresa/TarifasPage.tsx` | `pages/tariffs/TariffsPage.tsx` | New `tariffs/` folder |
| `pages/empresa/tarifas/` | `pages/tariffs/` | Entire subfolder moves |
| `pages/empresa/SchedulingPage.tsx` | Already commented-out/unused | Delete (or keep as orphan — no route) |

After this migration the `pages/empresa/` folder is empty and deleted.

**Note on `InventarioPage` and `VozPage`**: both are legacy entry-points superseded by newer
English-named pages. They are still imported in App.tsx (`/admin/inventory/list`,
`/admin/voice`). They move to their target domain folder but are NOT deleted here (that is a
separate routing/cleanup concern). Rename to `InventoryLegacyPage` / `VoiceLegacyPage` to signal
their status clearly.

---

### ADR-4: Rename `pages/clientes/` → `pages/customers/`

The domain is called `customers` everywhere else (URL: `/admin/customers/`, API: `clients.api.ts`,
hook: `useClients.ts`, type: `customer.ts`). The folder and component names are the outlier.

**Component renames within the folder**:

| Current | Target |
|---------|--------|
| `ClientesListPage.tsx` | `CustomersListPage.tsx` |
| `ClienteDetailPage.tsx` | `CustomerDetailPage.tsx` |
| `AddClientePage.tsx` | `AddCustomerPage.tsx` |
| `EditClientePage.tsx` | `EditCustomerPage.tsx` |
| `ClientesOnlinePage.tsx` | `CustomersOnlinePage.tsx` (already deprecated/no route, keep or delete) |
| `LeadsPage.tsx` | stays `LeadsPage.tsx` — name is correct in English |
| `CustomerSearchPage.tsx` | stays — already English |
| `CustomerVouchersPage.tsx` | stays — already English |
| `CustomerMapPage.tsx` | stays — already English |

**Tabs folder** (`pages/customers/tabs/`):

| Current | Target |
|---------|--------|
| `ActividadTab.tsx` | `ActivityTab.tsx` |
| `ArchivosTab.tsx` | `FilesTab.tsx` |
| `ComentariosTab.tsx` | `CommentsTab.tsx` |
| `DocumentosTab.tsx` | `DocumentsTab.tsx` |
| `EstadisticasTab.tsx` | `StatsTab.tsx` |
| `FacturacionTab.tsx` | `BillingTab.tsx` |
| `InformacionTab.tsx` | `InfoTab.tsx` |
| `LogsTab.tsx` | stays |
| `ServiciosTab.tsx` | `ServicesTab.tsx` |

**`clients.api.ts`**: rename to `customers.api.ts` to match the URL and folder. Current name
`clients` is inconsistent with the URL segment (`customers`). Low churn: only `useClients.ts`
imports it — rename that hook to `useCustomers.ts` simultaneously.

---

### ADR-5: Rename remaining Spanish-named files

| Layer | Current | Target |
|-------|---------|--------|
| `src/api/` | `empresa.api.ts` | decomposed (ADR-2) |
| `src/api/` | `ubicaciones.api.ts` | `locations.api.ts` |
| `src/api/` | `voz.api.ts` | `voice.api.ts` |
| `src/api/` | `clients.api.ts` | `customers.api.ts` |
| `src/hooks/` | `useEmpresa.ts` | decomposed → `useServicePlans.ts`, `useNetworkDevices.ts` |
| `src/hooks/` | `useUbicaciones.ts` | `useLocations.ts` |
| `src/hooks/` | `useVoz.ts` | `useVoice.ts` |
| `src/hooks/` | `useClients.ts` | `useCustomers.ts` |
| `src/types/` | `empresa.ts` | `service-plans.ts` (ServicePlan + NetworkDevice split) or `company.ts` |
| `src/types/` | `ubicacion.ts` | `location.ts` |
| `src/types/` | `voz.ts` | `voice.ts` |
| `src/pages/` | `clientes/` | `customers/` |
| `src/pages/` | `empresa/` | dissolved (ADR-3) |
| `src/pages/` | `finanzas/` | `finance/` |
| `src/pages/` | `informes/` | `reports/` |
| `src/pages/` | `mensajes/` | `messages/` |
| `src/pages/` | `sistema/` | `system/` |
| `src/__tests__/` | mirrors pages — same renames apply | |

**Pages that only need folder rename (no component rename)**:
- `finanzas/DunningPage.tsx` → `finance/DunningPage.tsx` (already English name)
- `finanzas/PaymentStatementsPage.tsx` → `finance/PaymentStatementsPage.tsx`
- `informes/InformesPage.tsx` → `reports/InformesPage.tsx` → also rename to `ReportsPage.tsx`
- `mensajes/MensajesPage.tsx` → `messages/MessagesPage.tsx`
- `sistema/AdministracionPage.tsx` → `system/AdminPage.tsx`
- `sistema/ConfiguracionPage.tsx` → `system/SettingsPage.tsx`
- `sistema/PartnersPage.tsx` → `system/PartnersPage.tsx` (already English)
- `sistema/UbicacionesPage.tsx` → `system/LocationsPage.tsx`

---

### ADR-6: Clean up `scheduling.ts` deprecated fields

Remove the 7 `@deprecated` fields from `ScheduledTask` and the `TaskStatus` type. These are
co-located evolution debt that directly creates confusion (old field + new field with different
English names, e.g. `clientId` vs `customerId`). This belongs in this change because it overlaps
with the language-consistency goal (Spanish field names `clientId/clientName` replaced by
`customerId/customerName`).

**Precondition**: grep the codebase for all usages of each deprecated field before removing.

---

## Migration Strategy — Safe Rename Protocol

### Rule 1: `git mv`, never copy+delete

```bash
git mv src/pages/clientes src/pages/customers
git mv src/pages/customers/ClientesListPage.tsx src/pages/customers/CustomersListPage.tsx
```

`git mv` preserves file history. Copy+delete treats it as a new file and loses blame/log.

### Rule 2: One domain per commit, one verification checkpoint

Each domain rename is one atomic commit:
1. `git mv` the folder/files.
2. Update ALL imports that reference the renamed files (`rg` to find them, edit).
3. `tsc --noEmit` — must pass.
4. `npx vitest run` — must pass.
5. Commit.

Never push a commit that breaks tsc or tests.

### Rule 3: App.tsx import paths update in the same commit as the page rename

`App.tsx` uses absolute `@/` imports. A renamed page folder requires updating the `lazy()` call in
`App.tsx` in the same commit or tsc fails immediately.

### Rule 4: Test folder renames travel with their source folder

`__tests__/clientes/` moves to `__tests__/customers/` in the same commit as `pages/clientes/` →
`pages/customers/`. Tests import source files with `@/` paths; they break if the source path changes
without the test path updating simultaneously.

### Risk: Lazy chunk rename and CDN cache busting

Vite produces a chunk named after the import path (e.g. `clientes-ClientesListPage-abc123.js`).
After rename it becomes `customers-CustomersListPage-abc123.js`. The old chunk is no longer served.
Any user with the old HTML in browser cache (before CDN TTL expires) gets a 404 on chunk load.
**Mitigation**: deploy with a short CDN TTL window, or do the rename in a low-traffic period.
This is operational risk, not a technical blocker.

### Risk: Barrel files

There are no barrel `index.ts` files at the `src/api/`, `src/hooks/`, or `src/types/` layer
(verified: no `index.ts` found in those dirs). No barrel update needed. Each consumer imports
directly.

### Risk: Vite alias `@/` → `src/`

The `@/` alias resolves at the `src/` level. All renames stay under `src/` so the alias itself
does not change. No `tsconfig.json` or `vite.config.ts` modification needed.

---

## Tradeoffs Summary

| Approach | Churn | Risk | Benefit |
|----------|------:|-----:|---------|
| Full convergence to EN (this design) | ~200 file path updates | Medium (import chain, chunk cache) | Permanent consistency, no language context-switch |
| Partial (only empresa + clientes) | ~80 file path updates | Lower | Removes the two biggest offenders |
| Rename only, no split of empresa.api.ts | ~150 file path updates | Lower | Language consistency but god-file remains |
| Do nothing | 0 | 0 | Debt compounds with each new feature |

**Recommended**: Full convergence. The churn is real but one-time. The `empresa` god-file split is
the most complex piece — it touches the most consumers — but it's the most valuable fix because it
removes both the language ambiguity AND the domain confusion.
