# Change Proposal: recapture-ventas-filter (FE)

## Intent
En la página Recaptación el pool de asignatarios que alimenta los TRES selects de
asignación —(1) dropdown inline de la columna "Asignado", (2) `BulkAssignToolbar`
y (3) el select "Operador" del `LeadDetailDrawer`— hoy listaba todos los
`RbacUser` activos. El negocio exige que asignar leads de recaptación sea una
tarea de VENTAS: los tres dropdowns deben ofrecer únicamente usuarios con el rol
de sistema `ventas` (`code: 'ventas'`).

> Nota de review: el primer intento aplicó el filtro a 2 de los 3 selects. El
> `LeadDetailDrawer` hacía `useRbacUsers` + map crudo (ni active ni ventas). Este
> proposal cierra el tercero y centraliza el predicado para que no vuelva a
> divergir.

## Scope
- Solo Frontend. Sin cambios de BE, de API ni de contrato.
- Predicado centralizado en un hook compartido `useAssignableOperators` (single
  source of truth). Los tres selects lo consumen; ninguno reimplementa el filtro.
- NO se toca la "option fantasma" del `InlineAssignSelect` ni el
  `value={lead.assigneeId}` del drawer: un lead ya asignado a alguien fuera del
  pool (ej. un admin sin rol ventas) sigue mostrando su nombre vía option
  fantasma (también en el drawer). No se borra historial de asignación.
- Hint sutil de pool vacío en el drawer cuando `canAssign` pero no hay operadores
  ventas, para explicar al admin por qué no hay a quién asignar.

## Approach
Nuevo hook `src/hooks/useAssignableOperators.ts` que envuelve `useRbacUsers(enabled)`
y aplica el predicado UNA sola vez, con guard defensivo por si el BE manda un
user sin roles:

```ts
export const VENTAS_ROLE_CODE = 'ventas';
const operators = (rbacUsers ?? [])
  .filter((u) => u.status === 'active' && (u.roles ?? []).some((r) => r.code === VENTAS_ROLE_CODE))
  .map((u) => ({ id: u.id, name: u.name }));
```

`RecaptacionPage.tsx` y `LeadDetailDrawer.tsx` reemplazan su lógica local por
`useAssignableOperators(canAssign)`. `RbacRoleDto` (`src/types/rbacRole.ts`) ya
expone `code: string`, así que no hay fetch adicional ni cambio de tipos.

## Rollback
Revertir los tres call sites a `useRbacUsers` + filtro/map local y eliminar el
hook compartido. Cambio aislado y de bajo riesgo.
