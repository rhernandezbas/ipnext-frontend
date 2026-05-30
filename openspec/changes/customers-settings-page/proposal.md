# Proposal: customers-settings-page

## Intent

Information-architecture fix. The GR client-sync config currently lives as the
"Sincronización" tab of **Scheduling → Configuración**, but client sync is a
**Clientes** concern, not a scheduling one. Relocate it: create a new tabbed
**Configuración** page in the Customers section, make **"Sincronización GR"** its
first tab, expose it via route + sidebar sub-item, and remove the tab from
`SchedulingSettingsPage`. The page is built tabbed/extensible so future customer
settings slot in without new routes.

## Scope

### In Scope
- New page `src/pages/customers/CustomersSettingsPage.tsx` — mirrors
  `SchedulingSettingsPage` (hash-synced, lazy mount-once tabs). One tab:
  `{ id:'gr-sync', label:'Sincronización GR', content:<GestionRealSyncBody/> }`.
- `git mv` the body `GestionRealSyncBody.tsx` + `GestionRealSync.module.css` from
  `src/pages/scheduling/settings/` → `src/pages/customers/settings/` (hooks/api/types stay).
- New route `<Route path="settings"><CustomersSettingsPage/></Route>` under `customers`
  (permission `clients.read`) → `/admin/customers/settings`. Additive, no reorder.
- Sidebar: add `{ to:'/admin/customers/settings', label:'Configuración' }` child to the
  "Clientes" group (inherits the group's `clients.read` guard).
- Remove the `gestion-real-sync` tab + unused import from `SchedulingSettingsPage` (7→6 tabs).
- Test migration: move the body test, retarget its import, drop the Sincronización
  assertions from both scheduling settings tests.

### Out of Scope
- Body internals, hooks (`useGestionRealSyncConfig`, `useGestionRealSync`), api, types,
  feature-flag hooks — reused unchanged; they already live outside scheduling.
- Backend, RBAC, endpoints, feature flag `gestion-real-sync`.
- New `gestionReal.read` frontend permission (not currently exposed via `/me`).
- Breadcrumbs entry (optional polish, deferred).

## Capabilities

### New Capabilities
- `customers-settings`: a tabbed Configuración page in the Customers section whose first
  tab hosts the GR client-sync config (relocated from Scheduling), reachable at
  `/admin/customers/settings` and gated by `clients.read`.

### Modified Capabilities
- None. The Scheduling change is a pure removal (tab + import) with no spec-level
  requirement change for the remaining six scheduling tabs; it is covered by a scenario
  in the new capability's spec asserting the tab no longer appears there.

## Approach

Mirror, don't abstract. `CustomersSettingsPage` copies the proven tab scaffold from
`SchedulingSettingsPage` (useState from `window.location.hash`, `mountedIds` ref,
`hashchange` listener, `Tabs` molecule `mountMode="lazy"`). The body moves wholesale via
`git mv` (preserves history) — its imports already use `@/hooks`, `@/types`, `@/api`
aliases, so no internal edits are needed. Route is lazy() + the single top-level Suspense
in `App.tsx`, declared inside the existing `<Route path="customers">` block, AFTER the
specific paths and BEFORE the `:id` catch-all (order-sensitive). Sidebar reuses the
group-level permission model — no per-child gating change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/customers/CustomersSettingsPage.tsx` (+css) | New | Tabbed page, 1 tab |
| `src/pages/customers/settings/GestionRealSyncBody.tsx` (+`GestionRealSync.module.css`) | Moved | `git mv` from `scheduling/settings/` |
| `src/pages/scheduling/SchedulingSettingsPage.tsx` | Modified | Remove tab + import (7→6) |
| `src/App.tsx` | Modified | +1 lazy import, +1 route under `customers` (additive) |
| `src/components/organisms/Sidebar/Sidebar.tsx` | Modified | +1 child in "Clientes" group |
| `src/__tests__/pages/customers/settings/GestionRealSyncBody.config.test.tsx` | Moved | from `scheduling/settings/`, retarget import |
| `src/__tests__/scheduling/SchedulingSettingsPage.test.tsx` | Modified | 7→6 tabs, drop sync mocks/assertion |
| `src/__tests__/pages/scheduling/SchedulingSettingsPage.test.tsx` | Modified | drop Sincronización describe + mocks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Two scheduling tests assert "Sincronización" → break on removal | High | Tracked: update both in the same change (test-first) |
| Broken import after `git mv` (body test still points at old path) | Med | Retarget import in the moved test; `tsc --noEmit` gate |
| Route declared after `:id` catch-all → `/settings` 404s | Med | Place route before `:id`; spec scenario asserts it renders |
| Gating on `gestionReal.read` (absent in FE) → page invisible to all | Med | Choose `clients.read` (see design); `gestionReal.read` deferred |
| Stale `GestionRealSync.module.css` filename assumption | Low | Verified: body imports `./GestionRealSync.module.css` — move both together |

## Rollback Plan

Revert the change's commits. `git mv` is reversible (move files back, restore the
`SchedulingSettingsPage` tab + import, drop the customers route/sidebar child). No FE state,
no migration. The backend keeps syncing; the flag stays controllable elsewhere.

## Dependencies

- Existing hooks/api/types: `useGestionRealSyncConfig`, `useGestionRealSync`,
  `useFeatureFlags`, `@/types/gestionRealSync`, `@/api/gestionRealSync.api` — unchanged.
- `clients.read` permission already returned by `/me` and used by the Customers routes.

## Success Criteria

- [ ] `/admin/customers/settings` renders `CustomersSettingsPage` with the "Sincronización GR" tab.
- [ ] The GR sync body renders under that tab (deep-link `#gr-sync`).
- [ ] "Configuración" sub-item appears under Clientes, gated by `clients.read`.
- [ ] `SchedulingSettingsPage` shows six tabs; no "Sincronización"; no dead import.
- [ ] Body test runs from its new customers path; both scheduling tests green; `tsc --noEmit` clean.
