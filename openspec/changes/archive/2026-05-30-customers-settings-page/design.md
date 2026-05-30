# Design: customers-settings-page

## Technical Approach

Relocate the GR client-sync config from Scheduling to a new tabbed **Configuración** page
in Customers. The new page (`CustomersSettingsPage`) is a structural clone of
`SchedulingSettingsPage`'s tab scaffold (hash-synced `useState`, `mountedIds` ref,
`hashchange` listener, `Tabs` molecule `mountMode="lazy"`). The body moves wholesale via
`git mv`; its imports already use `@/hooks`/`@/types`/`@/api` aliases, so no internal edits.
Route is added via `lazy()` + the single top-level `<Suspense>` in `App.tsx`. The scheduling
tab + import are deleted. All four spec scenarios map to Vitest tests.

## Architecture Decisions

### Decision: Move the body (git mv), don't import-in-place

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `git mv` body+css to `customers/settings/` | Screaming-architecture correct (body is a Customers concern); preserves git history; one import retarget in the body test | **CHOSEN** |
| Leave in `scheduling/settings/`, import across | Zero moves, but a Customers page reaching into `scheduling/` is a misleading dependency that contradicts the whole IA fix | Rejected |

The body's collaborators (`useGestionRealSyncConfig`, `useGestionRealSync`,
`useFeatureFlags`, `@/types/gestionRealSync`, `@/api/gestionRealSync.api`) are NOT
scheduling-scoped and stay put. Only `GestionRealSyncBody.tsx` + its co-located
`GestionRealSync.module.css` move (verified: the body imports `./GestionRealSync.module.css`).

### Decision: Route + sidebar permission is `clients.read`, NOT `gestionReal.read`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `clients.read` | Section-consistent (all `/admin/customers/*` use it); proven present in `/me`; lets the sidebar child inherit the group guard for free | **CHOSEN** |
| `gestionReal.read` | Matches the feature's backend RBAC domain conceptually, BUT this string appears NOWHERE in the frontend; backend uses colon notation `gestionReal:read` (not dot); FE `can()` checks opaque `/me` strings — gating on a string the user never holds renders the page invisible to everyone | Rejected (deferred) |

`useMyPermissions().can(p)` returns `permissions.includes(p)` over an opaque `string[]` from
`/me` (with a `'*'` super-admin short-circuit). There is no evidence the backend emits
`gestionReal.read` to that array. Choosing it would 403 the page for all non-super-admins.
If/when the backend exposes `gestionReal.read` via `/me`, swap is a one-liner in the route
guard and the sidebar group — recorded as an open question, not done here.

### Decision: Sidebar gating via the group, no per-child guard

`Sidebar` gates at the **parent group** level (`NavParentItem.requiredPermission`); children
(`SubItem`) have no per-item permission and the `canSee` filter runs only on groups. Adding
`{ to: '/admin/customers/settings', label: 'Configuración' }` to the existing "Clientes"
group (already `requiredPermission: 'clients.read'`) inherits the guard with zero structural
change — mirroring how scheduling's "Configuración" child inherits `scheduling.read`. A
per-child gating model was rejected as scope creep unjustified by this change.

## Data Flow

    /admin/customers/settings
        └─ RequirePermission(clients.read)
            └─ CustomersSettingsPage (hash ↔ activeTab, mount-once)
                └─ Tabs[ gr-sync → <GestionRealSyncBody/> ]   (#gr-sync)
                        └─ useGestionRealSyncConfig / useGestionRealSync / useFeatureFlags
                                    (unchanged, @/hooks)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/customers/CustomersSettingsPage.tsx` | Create | Tab scaffold cloned from SchedulingSettingsPage; one tab `gr-sync`; default tab `gr-sync` |
| `src/pages/customers/CustomersSettingsPage.module.css` | Create | Reuse the scheduling page header/breadcrumb styles (copy or import shared); breadcrumb text "Clientes /" |
| `src/pages/customers/settings/GestionRealSyncBody.tsx` | Move | `git mv` from `scheduling/settings/` |
| `src/pages/customers/settings/GestionRealSync.module.css` | Move | `git mv` alongside the body |
| `src/pages/scheduling/SchedulingSettingsPage.tsx` | Modify | Remove `gestion-real-sync` TABS entry (line ~19) + the `GestionRealSyncBody` import (line 9) |
| `src/App.tsx` | Modify | +`const CustomersSettingsPage = lazy(...)`; +`<Route path="settings" element={<RequirePermission permission="clients.read"><CustomersSettingsPage/></RequirePermission>}/>` inside `<Route path="customers">`, BEFORE `:id` |
| `src/components/organisms/Sidebar/Sidebar.tsx` | Modify | +`{ to:'/admin/customers/settings', label:'Configuración' }` to the Clientes group `children` |
| `src/__tests__/pages/customers/settings/GestionRealSyncBody.config.test.tsx` | Move | `git mv` from `__tests__/pages/scheduling/settings/`; retarget import to `@/pages/customers/settings/GestionRealSyncBody` |
| `src/__tests__/scheduling/SchedulingSettingsPage.test.tsx` | Modify | "seven"→"six"; drop `'Sincronización'` from the tab-list assert; remove the `grSyncHandles` + `useGestionRealSyncConfig`/`useGestionRealSync` vi.mock blocks |
| `src/__tests__/pages/scheduling/SchedulingSettingsPage.test.tsx` | Modify | Delete the `describe('… Sincronización tab')` block; drop `'Sincronización'` from the Gestión Real tab-list assert; remove `syncHandles` + the two sync vi.mock blocks |
| `src/__tests__/pages/customers/CustomersSettingsPage.test.tsx` | Create | New page tests for the 4 spec scenarios (route/tab/hash/deep-link) |
| `src/__tests__/components/organisms/Sidebar/Sidebar.test.tsx` | Create/Modify | Assert the Configuración child shows with `clients.read`, hidden without |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit/Integration | CustomersSettingsPage: tab present + first, select mounts body + sets `#gr-sync`, deep-link `#gr-sync` selects | `render` + `@testing-library`, mock the GR hooks with **stable references** (vi.hoisted) — ConfigSection has a `useEffect([config])` that loops on fresh objects each render (carry over from existing scheduling tests) |
| Integration | Sidebar Configuración child gated by `clients.read` | Mock `useMyPermissions`; assert visible/hidden |
| Integration | SchedulingSettingsPage now six tabs, no Sincronización | Update existing two tests |
| Body | Moved body config test passes from new path | Retarget import only; assertions unchanged |
| Quality | No dead import / unused symbol | `tsc --noEmit` (strict, noUnusedLocals) |

## Migration / Rollout

No data migration. Pure FE relocation behind no flag. `git mv` preserves history and is
trivially reversible. The route is additive and order-safe (before `:id`); deep links elsewhere
are untouched. The backend keeps syncing regardless.

## Open Questions

- [ ] When the backend exposes `gestionReal.read` through `/me`, should the route + sidebar
      switch from `clients.read` to it? (One-line swap; deferred — not blocking.)
- [ ] Share the page-shell CSS (header/breadcrumb) between Scheduling and Customers settings
      via a small template, or copy the module? (Copy now; extract later if a third settings
      page appears — avoids premature abstraction.)
