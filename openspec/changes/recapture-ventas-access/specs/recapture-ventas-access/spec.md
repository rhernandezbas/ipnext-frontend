# Spec: recapture-ventas-access

## Overview

Sidebar navigation and the Recaptación empty state must respect a sales agent who has
`recapture.read` + `recapture.manage` + role `ventas` but **not** `clients.read`. The agent
must see the "Clientes" group containing only the items they are entitled to (Recaptación,
Mis clientes), and the Recaptación page empty state must address them, not the admin.

## ADDED Requirements

### Requirement RVA-1: Container item visibility derives from its children

**Priority**: MUST

A nav item that has children is visible iff at least one of its children is visible (after
applying permission inheritance). The parent's own `requiredPermission` is no longer a hard
gate for container items — it is inherited by children that lack their own permission.

#### Scenario RVA-1.1: Sales agent sees the Clientes group with only Recaptación and Mis clientes

- Given the user has `recapture.read` (and `recapture.manage`, role `ventas`) but NOT `clients.read`
- When the Sidebar renders and the CRM section is opened
- Then the "Clientes" group MUST be visible
- And it MUST contain the "Recaptación" child link
- And it MUST contain the "Mis clientes" child link

#### Scenario RVA-1.2: Sales agent does NOT see any clients.read-only child (no leak)

- Given the user has `recapture.read` but NOT `clients.read`
- When the "Clientes" group is rendered
- Then "Añadir", "Lista", "Vouchers", "Mapas", "Búsqueda" and "Configuración" MUST NOT render
- And "Contratos" (needs `contracts.read`) and "TV" (needs `tv.read`) MUST NOT render

#### Scenario RVA-1.3: clients.read user still sees the full Clientes group

- Given the user has `clients.read` (only)
- When the "Clientes" group is rendered
- Then "Añadir", "Lista", "Vouchers", "Mapas", "Búsqueda", "Configuración" MUST render
  (they inherit `clients.read`)
- And children with extra permissions (Contratos, TV, Recaptación) MUST remain gated by their own
  permission (hidden when the user lacks it)

#### Scenario RVA-1.4: User with no relevant permission does not see the group or the CRM section

- Given the user has no CRM-related permission
- When the Sidebar renders
- Then the "Clientes" group MUST NOT render
- And the "CRM" section header MUST NOT render (it has no visible items)

### Requirement RVA-2: Child permission inheritance

**Priority**: MUST

#### Scenario RVA-2.1: Child without its own permission inherits the parent's

- Given a child item with no `requiredPermission` under a parent with `requiredPermission` P
- When visibility is computed
- Then the child is visible iff the user has P

#### Scenario RVA-2.2: Child with its own permission uses it (parent gate not applied)

- Given a child item with `requiredPermission` C under a parent with `requiredPermission` P
- When visibility is computed
- Then the child is visible iff the user has C (independent of P)

### Requirement RVA-3: Direct-link items keep their own permission

**Priority**: MUST

#### Scenario RVA-3.1: A direct-link item (no children) gates on its own requiredPermission

- Given a nav item with `to` set and no `children`
- When visibility is computed
- Then the item is visible iff it has no `requiredPermission` or the user has it
  (behavior unchanged from before this change)

### Requirement RVA-4: Recaptación empty state is role-aware

**Priority**: MUST

#### Scenario RVA-4.1: Admin sees the ingest-oriented empty state

- Given there are no leads and no active filters
- And the viewer `canAssign` (admin: has `recapture.assign`)
- When `RecaptacionTableView` renders its empty state
- Then it MUST show "No hay leads de recaptación"
- And it MUST mention ingesting bajas

#### Scenario RVA-4.2: Sales agent sees an assignment-oriented empty state

- Given there are no leads and no active filters
- And the viewer cannot assign (`!canAssign`)
- When `RecaptacionTableView` renders its empty state
- Then it MUST show a title indicating the agent has no assigned leads yet
- And it MUST explain the administrator has not assigned leads yet
- And it MUST NOT mention "Ingestar bajas"

#### Scenario RVA-4.3: Filtered-empty state is unchanged for both roles

- Given there are no leads but active filters are present
- When `RecaptacionTableView` renders its empty state
- Then it MUST show "Sin resultados para los filtros" with a "Limpiar filtros" action
  (regardless of `canAssign`)

## Route gating (verified, NO change)

`/admin/customers/recaptacion` and `/admin/customers/mis-clientes` are gated by
`RequirePermission permission="recapture.read"` in `App.tsx`, nested under a bare
`<Route path="customers">` prefix with no `clients.read` guard. Correct as-is.
