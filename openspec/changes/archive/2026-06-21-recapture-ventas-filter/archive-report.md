# Archive Report — recapture-ventas-filter (FE)

**Fecha:** 2026-06-21
**Estado:** ✅ COMPLETO Y EN PRODUCCIÓN
**Repo:** ipnext-frontend

## Qué se entregó
El dropdown de asignación de leads en Recaptación ahora ofrece SOLO usuarios con rol de ventas:
- Pool de asignatarios = usuarios `active` con rol `code === 'ventas'` (uno de los 6 SYSTEM_ROLES del BE).
- Predicado **centralizado** en un hook compartido `useAssignableOperators` (single source of truth) que consumen los **tres** selects de asignación: inline (columna "Asignado"), `BulkAssignToolbar`, y el select "Operador" del `LeadDetailDrawer`.
- Guard defensivo `(u.roles ?? [])`. La "option fantasma" se preserva: un lead ya asignado a alguien fuera del pool sigue mostrando su nombre. Hint "No hay usuarios con rol ventas" cuando el pool está vacío.

## Pipeline SDD aplicado
- proposal + spec + tasks.
- **verify** (typecheck + vitest, corrido por el orquestador): limpio + suite verde.
- **review adversarial**: cazó un **WARNING real** — el filtro se había aplicado a 2 de los 3 selects; el select "Operador" del drawer quedó sin filtrar (tercera vía de asignación). **FIX**: centralización en `useAssignableOperators` + aplicado al drawer.
- **re-review focalizado**: CLEAN (los 3 selects usan el mismo pool, sin `useRbacUsers` crudo restante).
- gate final: typecheck limpio + suite 3498/0.

## Commits / Deploy
- Commit `746fcd3` (rebaseado a `3dd6348`) → deploy verde `27893344701`.

## Notas
- Criterio confirmado por el usuario: "asignado en ventas" = rol RBAC `ventas` (code), no el mapeo GR ni el permiso de recaptación.
- El review evitó una inconsistencia: sin él, el drawer habría seguido permitiendo asignar a cualquiera.
