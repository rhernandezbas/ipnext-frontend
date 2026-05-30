# customers-settings Specification

## Purpose

A tabbed **Configuración** page in the Customers section that hosts customer-scoped
settings, extensible by adding tabs without new routes. Its first (and currently only)
tab relocates the **Gestión Real client-sync** configuration that previously lived in the
Scheduling settings page. Reachable at `/admin/customers/settings`, gated by `clients.read`,
exposed through a sidebar sub-item under "Clientes". The relocated body, hooks, api, and
types are reused unchanged; the frontend does not own their data shape.

## Requirements

### Requirement: Customers settings route renders the page

The application SHALL register a lazy route `settings` under `<Route path="customers">`,
guarded by `RequirePermission permission="clients.read"`, rendering `CustomersSettingsPage`
at `/admin/customers/settings`. The route MUST be declared after the specific customers
paths and before the `:id` catch-all so it resolves (flat-route order is load-bearing).

#### Scenario: navigating to the settings URL renders the page
- GIVEN a user holding `clients.read`
- WHEN they navigate to `/admin/customers/settings`
- THEN `CustomersSettingsPage` MUST render with a level-1 heading "Configuración"
- AND no existing customers route (list/add/search/vouchers/map/view/:id) MUST change resolution

#### Scenario: the settings path is not swallowed by the :id catch-all
- GIVEN the customers route block
- WHEN `/admin/customers/settings` is matched
- THEN it MUST resolve to `CustomersSettingsPage`, NOT to the `:id` redirect

### Requirement: GR sync tab present as the first tab

`CustomersSettingsPage` SHALL render a `Tabs` molecule (lazy mount-once, hash-synced)
whose first tab is `{ id: 'gr-sync', label: 'Sincronización GR', content: <GestionRealSyncBody/> }`.
Selecting it MUST mount the relocated `GestionRealSyncBody` and set the URL hash.

#### Scenario: the GR sync tab is present and labelled
- GIVEN `CustomersSettingsPage` renders
- WHEN the tab list is read
- THEN a tab labelled "Sincronización GR" MUST be present
- AND it MUST be the first/default tab

#### Scenario: selecting the tab mounts the body and sets the hash
- GIVEN `CustomersSettingsPage` rendered with hooks mocked
- WHEN the "Sincronización GR" tab is selected
- THEN the `GestionRealSyncBody` sections (Configuración heading + activation toggle) MUST render
- AND `window.location.hash` MUST become `#gr-sync`

#### Scenario: deep-link opens directly on the GR sync tab
- GIVEN the URL hash is `#gr-sync`
- WHEN `CustomersSettingsPage` renders
- THEN the "Sincronización GR" tab MUST be selected (aria-selected="true")

### Requirement: Sidebar sub-item gated by permission

The "Clientes" sidebar group SHALL include a child `{ to: '/admin/customers/settings', label: 'Configuración' }`.
Because sidebar children are not individually gated, this child MUST inherit the group's
`requiredPermission: 'clients.read'` — it MUST be visible when the user holds `clients.read`
and hidden when they do not.

#### Scenario: sub-item visible with permission
- GIVEN `useMyPermissions().can` returns true for `clients.read`
- WHEN the sidebar renders the "Clientes" group
- THEN a "Configuración" child linking to `/admin/customers/settings` MUST appear

#### Scenario: sub-item hidden without permission
- GIVEN permissions are loaded AND `can('clients.read')` returns false
- WHEN the sidebar renders
- THEN the entire "Clientes" group (including its "Configuración" child) MUST NOT appear

### Requirement: Scheduling settings no longer shows the sync tab

`SchedulingSettingsPage` SHALL NOT register the `gestion-real-sync` ("Sincronización") tab
and MUST NOT import `GestionRealSyncBody`. Its `TABS` array MUST contain exactly six tabs in
their original order; all other tabs and deep links MUST remain intact.

#### Scenario: scheduling settings shows six tabs without Sincronización
- GIVEN `SchedulingSettingsPage` renders
- WHEN the tab list is read
- THEN it MUST equal `['Categorías', 'Prioridades', 'Colores de estados', 'Plantillas', 'IClass', 'Gestión Real']`
- AND no tab labelled "Sincronización" MUST be present

#### Scenario: removed import leaves no dead reference
- GIVEN the project type-checks (`tsc --noEmit`)
- WHEN `SchedulingSettingsPage.tsx` is compiled
- THEN it MUST NOT reference `GestionRealSyncBody` (no unused import, no broken path after the move)

### Requirement: Relocated body and tests retargeted

`GestionRealSyncBody.tsx` and `GestionRealSync.module.css` SHALL reside in
`src/pages/customers/settings/`, and consumers (the page and the body's config test) MUST
import it from `@/pages/customers/settings/GestionRealSyncBody`. The body's behavior and its
hooks/api/types MUST be unchanged by the move.

#### Scenario: body test runs from the customers path
- GIVEN the moved body config test
- WHEN it imports the body
- THEN the import MUST be `@/pages/customers/settings/GestionRealSyncBody`
- AND all of its existing assertions MUST still pass unchanged
