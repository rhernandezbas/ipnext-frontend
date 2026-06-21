# Archive Report — recapture-admin-assign (FE)

**Fecha:** 2026-06-20
**Estado:** ✅ COMPLETO Y EN PRODUCCIÓN
**Repo:** ipnext-frontend

## Qué se entregó
Redesign de Recaptación bajo SDD formal + skill ui-ux-pro-max:
- **Admin (`recapture.assign`)**: multi-select (checkboxes + "seleccionar todos") + `BulkAssignToolbar` ("N seleccionados → asignar a [agente]") → `PATCH /leads/assign-bulk`; toast con el count real; reset de selección al cambiar página/filtro/tab/éxito.
- **Agente (read+manage)**: ve SOLO sus leads (BE filtra) y los gestiona (contacto + estado); NO ve checkboxes, asignar, ingest, CSV ni filtro de asignación.
- **Self-take eliminado**: botones "Tomar siguiente"/"Tomar lead"/"Liberar" + api/hooks `claim-next`/`claim`/`release` borrados.
- **Re-gate a `recapture.assign`** de features cross-agent: tab "Vendedores GR", selector de agente de "Mis Clientes", operator select del drawer.

## Pipeline SDD aplicado
- proposal + design + spec + tasks.
- **verify** (typecheck + vitest, corrido por el orquestador): limpio + 3455/0.
- **review adversarial (3 focos)** → cazó **1 CRITICAL funcional** + 2 warnings:
  - CRITICAL: el dropdown "Asignar a" usaba `useAdmins()` (tabla `Admin`) pero el BE valida `operatorId` contra `RbacUser` (tabla distinta) → los agentes no aparecían y daba 400. **FIX**: `useRbacUsers()` (gateado `enabled=canAssign`); arregló también el single-assign preexistente.
  - WARNING: `handleBulkAssign` sin try/catch (fallaba en silencio) → toast de error. `useGrVendedores()` sin gate → `useGrVendedores(canManage)` para no 403ear al agente.
- **re-review focalizado**: CLEAN (6 puntos confirmados).
- gate final: typecheck limpio + suite 3463/0.

## Commits / Deploy
- Commit `e3635c3` → deploy verde. Desplegado tras el BE para cerrar la ventana de incompatibilidad.

## Notas
- Skill ui-ux-pro-max: patrón "bulk actions = checkbox column + action bar" + feedback por toast.
- Lista de destinatarios = todos los RbacUser activos (no se filtró por permiso recapture — opción futura trivial).
