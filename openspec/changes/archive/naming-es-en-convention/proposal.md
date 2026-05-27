# Proposal — naming-es-en-convention

## Intent

Establish a **single, consistent naming language for code identifiers** across the frontend
codebase, resolving the current mixed Spanish/English state that forces developers to context-
switch within the same domain. This is a planning-only proposal: no code is renamed here; the
actual migration is gated on team decision and executed phase-by-phase per `tasks.md`.

---

## Context — Real Numbers

The following inventory was gathered by static scan (`rg`, `ls`) of `src/` on 2026-05-27.

### `src/pages/` — folder names

| Language | Folders | Files inside |
|----------|--------:|-------------:|
| Spanish  | `clientes`, `empresa`, `finanzas`, `informes`, `mensajes`, `sistema`, `crm`* | ~82 |
| English  | `scheduling`, `networking`, `inventory`, `monitoring`, `tickets`, `support`, `resellers`, `portal`, `voice`, `radius`, `sla`, `api-docs` | ~117 |
| Mixed or singleton (PascalCase)† | `DashboardPage`, `FacturasPage`, `FinanzasDashboardPage`, `LoginPage`, `NotFoundPage`, `PagosPage`, `TransaccionesPage` | ~18 |

*`crm` is an acronym, language-neutral.
†Seven folders use PascalCase component names directly as folder names — a separate structural
inconsistency (dir = `FacturasPage/FacturasPage.tsx`) that is NOT in scope here.

**Total pages files scanned: ~217**

### Same concept — different language in different layers

This is the most damaging form of inconsistency: the same business concept lives under a
Spanish name in one layer and an English name in another.

| Concept | Pages folder | API module | Hook | Type file |
|---------|-------------|------------|------|-----------|
| Clientes / Customers | `pages/clientes/` (ES) | `clients.api.ts` (EN) | `useClients.ts` (EN) | `customer.ts` (EN) |
| Empresa / Company config | `pages/empresa/` (ES) | `empresa.api.ts` (ES) | `useEmpresa.ts` (ES) | `empresa.ts` (EN types inside) |
| Voz / Voice | `pages/empresa/VozPage.tsx` + `pages/voice/` (duplicate domain, mixed) | `voz.api.ts` (ES) + `voiceProcessing.api.ts` (EN) | `useVoz.ts` (ES) + `useVoiceProcessing.ts` (EN) | `voz.ts` (ES) |
| Finanzas / Finance | `pages/finanzas/` (ES) + `pages/FacturasPage/` (ES component) | `billing.api.ts` (EN) | `useBilling.ts` (EN) | `billing.ts` (EN) |
| Informes / Reports | `pages/informes/` (ES) | `reports.api.ts` (EN) | `useReports.ts` (EN) | `report.ts` (EN) |
| Mensajes / Messages | `pages/mensajes/` (ES) | `messages.api.ts` (EN) + `messenger.api.ts` (EN) | `useMessages.ts` (EN) | `message.ts` (EN) |
| Ubicaciones / Locations | `pages/sistema/UbicacionesPage.tsx` (ES) | `ubicaciones.api.ts` (ES) | `useUbicaciones.ts` (ES) | `ubicacion.ts` (ES) |
| Sistema / Admin/System | `pages/sistema/` (ES) | `admin.api.ts` (EN) + `settings.api.ts` (EN) | `useAdmins.ts` (EN) + `useSettings.ts` (EN) | `admin.ts` (EN) |
| Inventario / Inventory | `pages/empresa/InventarioPage.tsx` (ES) + `pages/inventory/` (EN, newer) | `empresa.api.ts` (ES, mixed) | `useEmpresa.ts` (ES) | `empresa.ts` (ES) |
| Tarifas / Tariffs | `pages/empresa/TarifasPage.tsx` + `pages/empresa/tarifas/` (ES) | (no dedicated api — uses billing + empresa) | (no dedicated hook) | (no dedicated type) |

### `empresa.api.ts` — The Worst Offender

`src/api/empresa.api.ts` is a catch-all module grouping four unrelated domains under one Spanish
name: **Service Plans** (`/service-plans`), **Network Devices** (`/network-devices`),
**Inventory Items/Products/Units** (`/inventory/*`), and **Supply Orders**. None of these map
cleanly to "empresa". It imports from `types/empresa.ts` which itself contains `ServicePlan`,
`NetworkDevice`, `InventoryItem`, `InventoryProduct`, `InventoryUnit`, `SupplyOrder` — six
unrelated entities cohabiting under one file.

Meanwhile, a parallel `pages/inventory/` folder with English naming already exists and imports
from this same `empresa.api.ts`.

### `src/types/scheduling.ts` — Deprecated Fields

`scheduling.ts` carries **7 `@deprecated` fields** in `ScheduledTask` that represent the pre-
change-3 shape (`assignedTo`, `assignedToId`, `clientId`, `clientName`, `status`, `scheduledDate`,
`scheduledTime`) alongside their post-change-3 replacements. `TaskStatus` is also deprecated.
These are a naming debt of a different nature — evolution debt, not language debt.

### `src/types/empresa.ts`

Contains `SupplyOrder` with Spanish-named fields (`proveedor`, `estado`, `fecha`) mixed into an
otherwise English-named type structure. A localized anomaly.

### `src/components/`

Clean: all English except `gestionReal/GestionRealSyncBadge` — a proper noun (integration name),
not a language issue.

### `src/__tests__/`

Tests mirror page folders: 48 test files in Spanish-named dirs (`clientes`, `empresa`, `sistema`,
`finanzas`, `informes`, `mensajes`) vs 42 in English-named dirs (`inventory`, `voice`,
`networking`, `scheduling`, `tickets`, `support`, `monitoring`).

---

## Problem

1. **Layer-crossing confusion**: to trace the `clientes` domain end-to-end a developer must know
   that `pages/clientes/` → `clients.api.ts` → `customer.ts` → `/admin/customers/*`. Three
   different names, zero indication they are the same thing.

2. **`empresa` is a God-folder**: a single folder absorbs Service Plans, Network Devices,
   Inventory, Voice, and Tariffs. Partially migrated to English (`pages/inventory/`, `pages/voice/`)
   but the source files still live under `empresa/`.

3. **Parallel domains**: `pages/empresa/VozPage.tsx` AND `pages/voice/VoiceCategoriesPage.tsx`
   both represent the "Voice" domain. One is a legacy entry-point, the other is the current home.

4. **Test path mismatch**: tests in `__tests__/clientes/` cover pages in `pages/clientes/` —
   a rename of the page folder requires renaming the test folder too.

5. **Onboarding friction**: a new developer has no convention to follow. Should the next feature be
   added under a Spanish folder or an English one?

---

## Scope IN

- Rename Spanish-named `src/pages/` folders to English equivalents.
- Rename Spanish-named files in `src/api/`, `src/hooks/`, `src/types/`, `src/__tests__/` to match.
- Split `empresa.api.ts` into domain-specific modules (`tariffs.api.ts`, `service-plans.api.ts` or
  keep in `billing.api.ts`, etc. — decided in design).
- Rename `types/empresa.ts` and `types/ubicacion.ts` and `types/voz.ts` to English.
- Update all import paths (cross-layer references) to point at the renamed files.
- Clean up the 7 deprecated fields in `ScheduledTask` + `TaskStatus` (co-located debt, low churn).
- Fix `SupplyOrder` Spanish field names (`proveedor` → `supplier`, `estado` → `status`, `fecha` → `date`).

## Scope OUT

- Renaming PascalCase singleton page folders (`FacturasPage/`, `DashboardPage/`, etc.) — separate
  structural concern, not naming-language debt. Flagged but not addressed here.
- Changing URL paths (these are already English: `/admin/customers/`, `/admin/finance/`, etc.).
- Changing UI copy (user-facing labels are intentionally Spanish; that is correct and stays).
- Renaming `GestionReal*` — it is an integration's proper name, not a language inconsistency.
- Renaming `crm/` — it is an acronym and language-neutral.
- Data router migration or any routing refactor — orthogonal change.
- Backend API endpoint names — frontend has no ownership there.

**Honest callout**: The `empresa` folder cleanup has the highest churn (16 App.tsx imports,
15 test files, cross-references in `useEmpresa.ts`). The naming benefit is real but non-trivial.
If the team prefers to defer `empresa` cleanup to a later incremental pass, marking only the new
domains (inventory, voice, tariffs pages) as the migration target is a valid option. This proposal
covers the full cleanup but `tasks.md` phases it so any domain can be deferred.

---

## Decision: Spanish or English?

### The question

Should identifiers converge to **Spanish** (align with the UI copy and the team's language) or
**English** (align with industry convention, the framework, the type names, and the API layer)?

### Evidence

| Signal | Points to |
|--------|-----------|
| URL paths are already English (`/admin/customers/`, `/admin/finance/`) | EN |
| API modules are majority English: 46/49 files are English-named | EN |
| Hooks are majority English: 45/48 files are English-named | EN |
| Type files are majority English: 47/50 files are English-named | EN |
| Component files: 100% English | EN |
| Page folders split: ~82 files in Spanish-named dirs, ~117 in English-named dirs | EN wins |
| Test folders mirror pages — split follows the same ratio | EN |
| New features added in 2026 (inventory, voice, scheduling) chose English | EN |
| Domain language of ISP/networking is universal English terminology | EN |
| UI copy and user-facing strings remain in Spanish regardless | neutral |

### Recommendation: **converge to English**

The evidence is unambiguous: English already dominates every layer except the oldest page folders.
The migration is asymmetric — renaming ~82 files in Spanish folders to English requires updating
~82 import paths, but it eliminates the conceptual mapping overhead permanently.

Converging to Spanish would require renaming ~117+ files across API, hooks, types, and the newer
page folders — significantly higher churn with no technical benefit.

The convention to adopt is: **all code identifiers (folders, files, component names, type names,
hook names, API module names) use English**. UI copy (what the user reads) remains in Spanish.

---

## Risks

1. **Import chain breakage**: a rename without updating all consumers breaks `tsc --noEmit`.
   Mitigation: do renames by domain, run `tsc --noEmit` after each domain, never commit broken state.

2. **Lazy import chunk identity**: Vite derives chunk names from import paths. Renaming
   `pages/clientes/ClientesListPage.tsx` → `pages/customers/CustomersListPage.tsx` changes the
   chunk filename. This is harmless for functionality but will bust CDN caches on first deploy.

3. **Test path coupling**: `__tests__/clientes/` tests import from `pages/clientes/` — both must
   move together in the same commit to avoid broken test runs mid-migration.

4. **`git mv` discipline**: renames via `git mv` preserve file history. A copy+delete loses it.
   Each task MUST use `git mv` for renames.

5. **`empresa` split complexity**: decomposing `empresa.api.ts` into multiple domain modules
   requires touching every file that imports it. Current consumers: `useEmpresa.ts`, 4 inventory
   pages, `VozPage`, `TarifasPage`, and the test suite. Manageable but non-trivial.

---

## Success Criteria

- Every layer (pages, api, hooks, types, tests) for each domain uses the same English name.
- `tsc --noEmit` passes after each phase.
- `npx vitest run` passes after each phase.
- `empresa.api.ts`, `empresa.ts`, `ubicaciones.api.ts`, `ubicacion.ts`, `voz.api.ts`, `voz.ts`
  are removed and replaced by English-named equivalents.
- No new Spanish-named files are introduced (enforced by convention, not tooling — ESLint rule
  optional but not in scope).
