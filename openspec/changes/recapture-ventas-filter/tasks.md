# Tasks: recapture-ventas-filter

## Tests (TDD — red primero)
- [x] T1 — En `RecaptacionPage.test.tsx`: agregar fixtures de rol (`VENTAS_ROLE`,
  `ADMIN_ROLE`) y darle el rol `ventas` a `RBAC_USERS`/`DISABLED_USER`; agregar
  `NO_VENTAS_USER` (active sin ventas) y `ADMIN_NO_VENTAS_USER` (active admin sin ventas).
- [x] T2 — Test A12: usuarios active SIN rol ventas excluidos del pool del bulk toolbar.
- [x] T3 — Test A13: usuarios active SIN rol ventas excluidos del pool inline.
- [x] T4 — Test A14: lead asignado a usuario fuera del pool de ventas sigue mostrando
  su nombre (option fantasma intacta).

## Implementación (green)
- [x] T5 — En `RecaptacionPage.tsx`: definir `const VENTAS_ROLE_CODE = 'ventas';`.
- [x] T6 — Cambiar el armado de `operators` para exigir además
  `u.roles.some((r) => r.code === VENTAS_ROLE_CODE)`. NO tocar `InlineAssignSelect`.

## Verificación
- [x] T7 — `npm run typecheck` limpio.
- [x] T8 — `npx vitest run RecaptacionPage.test.tsx RecaptacionTableView.test.tsx` verde (50/50).

## Cierre del 3er select (drawer) + centralización (review fix)
El review encontró que el filtro NO se aplicaba al select "Operador" del
`LeadDetailDrawer` (hacía `useRbacUsers` + map crudo). Se centraliza el predicado.

### Tests (TDD — red primero)
- [x] T9 — `useAssignableOperators.test.ts`: tests U1–U6 del hook compartido
  (filtro active+ventas, multi-rol, guard `(u.roles ?? [])`, pool vacío, undefined data,
  forward del flag `enabled`).
- [x] T10 — `LeadDetailDrawer.test.tsx`: fixtures de rol + tests R10/R11 (excluir
  non-ventas y disabled del select del drawer).
- [x] T11 — `LeadDetailDrawer.test.tsx`: test R12 (phantom — lead asignado fuera del
  pool conserva su assignee en el drawer).
- [x] T12 — `LeadDetailDrawer.test.tsx`: tests R13/R14 (hint de pool vacío).

### Implementación (green)
- [x] T13 — Crear `src/hooks/useAssignableOperators.ts`: envuelve `useRbacUsers(enabled)`,
  aplica el predicado active + `VENTAS_ROLE_CODE` con guard `(u.roles ?? [])`, devuelve
  `{ operators, isLoading }`. Single source of truth.
- [x] T14 — `RecaptacionPage.tsx`: reemplazar el armado manual de `operators` (y el
  `VENTAS_ROLE_CODE` local) por `useAssignableOperators(canAssign)`.
- [x] T15 — `LeadDetailDrawer.tsx`: reemplazar `useRbacUsers` + map crudo por
  `useAssignableOperators(canAssign)`; agregar option fantasma + hint de pool vacío
  (`.operatorHint` en el module CSS).

### Verificación
- [x] T16 — `npm run typecheck` limpio.
- [x] T17 — `npx vitest run` (hook + RecaptacionPage + LeadDetailDrawer) verde (63/63).
- [x] T18 — Suite completa verde (sin regresiones).
