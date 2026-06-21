# recapture-ventas-access — Proposal

## Intent

A sales agent (`recapture.read` + `recapture.manage` + role `ventas`, **without** `clients.read`)
cannot reach the Recaptación module, and when they do they see an admin-only empty state.
Two bugs to fix on the frontend:

1. **Sidebar gating** — the "Clientes" group gates on `clients.read`. A sales agent without
   that permission never sees the group, so "Recaptación" and "Mis clientes" (gated by their
   own `recapture.read`) are dropped together with the whole group.

2. **Misleading empty state** — `RecaptacionTableView` shows the admin message
   ("No hay leads de recaptación / Ejecutá 'Ingestar bajas'…") to everyone, including the
   agent who cannot ingest.

## Scope

| File | Change |
|------|--------|
| `src/components/organisms/Sidebar/Sidebar.tsx` | `canSeeChild` inherits the parent's `requiredPermission`; `canSee` for items WITH children is "any visible child"; `visibleSections` filters children with the parent context and drops items with no visible children. |
| `src/pages/customers/RecaptacionPage/components/RecaptacionTableView.tsx` | New `canAssign` already exists; branch the no-filter empty state on `canAssign` (admin vs agent copy). |
| `src/pages/customers/RecaptacionPage.tsx` | Pass `canAssign` to the table for the empty state (the prop is already wired for the inline-assign column; this just confirms the empty-state branch is driven by it). |
| `src/__tests__/...` | TDD tests for both fixes. |

## Out of scope (NO change)

- Backend. No BE files touched.
- Route gating. `App.tsx` already gates `/admin/customers/recaptacion` and
  `/admin/customers/mis-clientes` with `RequirePermission permission="recapture.read"`,
  nested under `<Route path="customers">` (a bare path prefix, **no** `clients.read` guard
  on the parent). The route is correct — confirmed, not changed.

## Permission model recap

- The "Clientes" group is a container. Its visibility must be **derived from its children**:
  visible iff at least one child is visible.
- A child with its own `requiredPermission` uses that. A child WITHOUT one **inherits** the
  parent's `requiredPermission` (preserves today's behavior: Añadir/Lista/Vouchers/Mapas/
  Búsqueda/Configuración inherit `clients.read`, so a sales agent does NOT see them).
- "Recaptación" / "Mis clientes" carry their own `recapture.read`, so the sales agent sees
  exactly those two — and the "CRM" section reappears because the group now has visible children.

## Risks

- This touches the whole navigation tree. Every group (Clientes, Finanzas, Tickets, Gestión de
  red, Sistema, …) now computes parent visibility from children. Mitigation: full Sidebar test
  suite (existing SP1–SP9 + new ventas-access cases) must stay green.
- Direct-link items (e.g. "Informes" — no children) keep their own `requiredPermission` path.
