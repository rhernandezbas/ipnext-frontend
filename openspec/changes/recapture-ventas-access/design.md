# recapture-ventas-access — Design

## Problem (root cause)

`Sidebar.tsx` filters in two independent passes:

```
visibleSections = SECTIONS.map(section => ({
  ...section,
  items: section.items
    .filter(canSee)                       // (1) drop the PARENT by its own requiredPermission
    .map(item => ({ ...item,
      children: item.children?.filter(canSeeChild) }))  // (2) then filter children
})).filter(s => s.items.length > 0)
```

- `canSee(item)` looks ONLY at `item.requiredPermission`. "Clientes" has `clients.read`, so a
  sales agent (no `clients.read`) loses the whole group in pass (1) — children never evaluated.
- `canSeeChild(child)` looks ONLY at `child.requiredPermission`; a child with none is always
  shown (it "inherits parent visibility" — but only because the parent was already shown).

Net: visibility flows **parent → child**. We need it to ALSO flow **child → parent** for
container items, and we need children to inherit the parent's permission so removing the
parent gate does not leak no-permission children.

## Decision

Invert the dependency for **container items** (items WITH `children`) and make child
permission inheritance explicit.

### `canSeeChild(child, parent)` — inherit parent permission

```ts
function canSeeChild(child: SubItem, parent: NavParentItem): boolean {
  if (isLoading) return true;
  const perm = child.requiredPermission ?? parent.requiredPermission;
  if (!perm) return true;
  return can(perm);
}
```

- Child with own perm → uses it (Contratos: `contracts.read`, TV: `tv.read`, Recaptación:
  `recapture.read`).
- Child without perm → inherits parent perm (Añadir/Lista/… inherit `clients.read`).
- Neither → always visible (matches a permission-less group like "Informes" if it had children).

This **preserves** existing behavior: a `clients.read`-only user still sees Añadir/Lista (they
inherit `clients.read`, which the user has); a sales agent does NOT (they lack `clients.read`).

### `canSee(item)` — container visibility derived from children

```ts
function canSee(item: NavParentItem): boolean {
  if (isLoading) return true;
  if (item.children && item.children.length > 0) {
    return item.children.some(c => canSeeChild(c, item));   // any visible child
  }
  if (!item.requiredPermission) return true;                // direct link, no children
  return can(item.requiredPermission);
}
```

- Container item: visible iff ≥1 child visible (with inheritance). Drops the parent gate as a
  hard wall; the gate now lives in the children via inheritance.
- Direct-link item (e.g. "Informes", `to` set, no children): keeps its own `requiredPermission`.

### `visibleSections` — pass parent into the child filter

```ts
const visibleSections = SECTIONS.map(section => ({
  ...section,
  items: section.items
    .filter(canSee)
    .map(item => ({
      ...item,
      children: item.children
        ? item.children.filter(c => canSeeChild(c, item))
        : item.children,
    }))
    .filter(item => !item.children || item.children.length > 0 || !!item.to),
})).filter(section => section.items.length > 0);
```

- After filtering children, drop any container item left with zero visible children
  (defense-in-depth — `canSee` already excludes it, but the post-filter guard keeps the two
  passes consistent and protects against a child filtered out for a non-permission reason).
- `|| !!item.to` keeps direct-link items (no children) alive.

## Why this is safe (no item leaks)

A child renders iff `canSeeChild(child, parent)` is true. With inheritance, a no-perm child
requires the parent's permission. So:

- Sales agent (no `clients.read`): Añadir/Lista/Vouchers/Mapas/Búsqueda/Configuración all
  inherit `clients.read` → hidden. Contratos (`contracts.read`), TV (`tv.read`) → hidden.
  Recaptación / Mis clientes (`recapture.read`) → **visible**. Group shows with exactly those 2.
- `clients.read` user: everything that inherits `clients.read` → visible (unchanged). Children
  with extra perms still gated (Contratos needs `contracts.read`, etc.) — unchanged.
- No-permission user: every child hidden → "Clientes" dropped → CRM section dropped (unchanged).

Test guarantees no leak: a dedicated case asserts a sales agent does NOT see any
`clients.read`-inheriting child (Añadir/Lista/Configuración) while seeing Recaptación.

## Empty state (BUG 2)

`RecaptacionTableView` already receives `canAssign`. Branch the **no-filter** empty state:

- `canAssign` (admin): current copy — "No hay leads de recaptación" / "Ejecutá 'Ingestar bajas'…".
- `!canAssign` (agent): "Todavía no tenés leads asignados" / "El administrador todavía no te
  asignó leads de recaptación."

The `hasActiveFilters` branch (filtered, zero results) is unchanged for both roles.

## Route verification (no change)

`App.tsx`:

```
<Route path="customers">                               // bare prefix, NO guard
  ...
  <Route path="recaptacion"  element={<RequirePermission permission="recapture.read">…} />
  <Route path="mis-clientes" element={<RequirePermission permission="recapture.read">…} />
```

Gated by `recapture.read`, not nested under any `clients.read` guard. Correct — left as-is.
