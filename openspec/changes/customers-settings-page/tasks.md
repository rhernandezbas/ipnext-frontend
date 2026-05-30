# Tasks: customers-settings-page

> STRICT TDD: red → green → refactor. Runner: `npx vitest run`. Each phase leaves the
> app building (`tsc --noEmit`) and all URLs resolving. Paths relative to repo root.

## Phase 1: Relocate the body (move, stay green)

- [x] 1.1 `git mv src/pages/scheduling/settings/GestionRealSyncBody.tsx src/pages/customers/settings/GestionRealSyncBody.tsx`
- [x] 1.2 `git mv src/pages/scheduling/settings/GestionRealSync.module.css src/pages/customers/settings/GestionRealSync.module.css` (body imports `./GestionRealSync.module.css` — keep co-located)
- [x] 1.3 `git mv src/__tests__/pages/scheduling/settings/GestionRealSyncBody.config.test.tsx src/__tests__/pages/customers/settings/GestionRealSyncBody.config.test.tsx`
- [x] 1.4 In the moved test, retarget import to `@/pages/customers/settings/GestionRealSyncBody`. RED: `npx vitest run src/__tests__/pages/customers/settings/GestionRealSyncBody.config.test.tsx` (fails on old path) → GREEN after retarget.
- [x] 1.5 In `src/pages/scheduling/SchedulingSettingsPage.tsx` temporarily point the import at `../customers/settings/GestionRealSyncBody` so it still compiles (removed in Phase 4). Verify `tsc --noEmit` clean.

## Phase 2: CustomersSettingsPage (RED → GREEN)

- [x] 2.1 RED: create `src/__tests__/pages/customers/CustomersSettingsPage.test.tsx` covering spec scenarios — tab "Sincronización GR" present & first; selecting mounts body (Configuración heading + activar-sincronización toggle) and sets `#gr-sync`; deep-link `#gr-sync` selects it. Mock GR hooks with **stable refs via `vi.hoisted`** (ConfigSection `useEffect([config])` loops on fresh objects). Run → fails (no page).
- [x] 2.2 GREEN: create `src/pages/customers/CustomersSettingsPage.tsx` — clone the `SchedulingSettingsPage` scaffold (hash `useState`, `mountedIds` ref, `hashchange` listener, `Tabs` `mountMode="lazy"` size="compact"), `TABS = [{ id:'gr-sync', label:'Sincronización GR', content:<GestionRealSyncBody/> }]`, default `gr-sync`, breadcrumb "Clientes /".
- [x] 2.3 GREEN: create `src/pages/customers/CustomersSettingsPage.module.css` (copy header/breadcrumb styles from the scheduling page module). Run 2.1 → green.

## Phase 3: Route + Sidebar wiring (RED → GREEN)

- [x] 3.1 RED (sidebar): create/extend `src/__tests__/components/organisms/Sidebar/Sidebar.test.tsx` — "Configuración"→`/admin/customers/settings` visible when `can('clients.read')`; whole Clientes group hidden when false. Run → fails.
- [x] 3.2 GREEN: in `src/components/organisms/Sidebar/Sidebar.tsx` add `{ to:'/admin/customers/settings', label:'Configuración' }` to the Clientes group `children` (inherits group `clients.read`). Run 3.1 → green.
- [x] 3.3 Wire route in `src/App.tsx`: add `const CustomersSettingsPage = lazy(() => import('@/pages/customers/CustomersSettingsPage'))`; add `<Route path="settings" element={<RequirePermission permission="clients.read"><CustomersSettingsPage/></RequirePermission>} />` inside `<Route path="customers">`, AFTER `view/:id/edit` and BEFORE the `:id` catch-all. Verify `/admin/customers/settings` resolves (not `:id`).

## Phase 4: Remove the scheduling tab (RED → GREEN)

- [x] 4.1 RED: update `src/__tests__/scheduling/SchedulingSettingsPage.test.tsx` — "seven"→"six tabs", drop `'Sincronización'` from the tab-list `toEqual`; remove the `grSyncHandles` const + the `@/hooks/useGestionRealSyncConfig` and `@/hooks/useGestionRealSync` `vi.mock` blocks. Run → fails (page still has 7 tabs).
- [x] 4.2 RED: update `src/__tests__/pages/scheduling/SchedulingSettingsPage.test.tsx` — delete the `describe('… — Sincronización tab')` block; drop `'Sincronización'` from the Gestión Real tab-list `toEqual`; remove `syncHandles` + the two sync `vi.mock` blocks.
- [x] 4.3 GREEN: in `src/pages/scheduling/SchedulingSettingsPage.tsx` remove the `gestion-real-sync` `TABS` entry (line ~19) and delete the `GestionRealSyncBody` import (the temp one from 1.5). Run 4.1 + 4.2 → green.

## Phase 5: Full verification

- [x] 5.1 `tsc --noEmit` clean (strict, noUnusedLocals — catches any dead import).
- [x] 5.2 `npx vitest run` — full suite green (moved body test, new page test, sidebar test, both scheduling tests, untouched `useGestionRealSyncConfig.test.ts`).
- [x] 5.3 Playwright MCP smoke (manual): `/admin/customers/settings` renders the GR sync tab; Scheduling → Configuración shows six tabs; Clientes sidebar shows "Configuración".
