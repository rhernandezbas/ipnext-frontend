# Archive Report — recapture-inline-assign (FE)

**Fecha:** 2026-06-20
**Estado:** ✅ COMPLETO Y EN PRODUCCIÓN
**Repo:** ipnext-frontend

## Qué se entregó
Mejora de UX de la asignación de leads en Recaptación (el admin no encontraba cómo asignar):
- **Asignación inline**: la columna "Asignado" de la tabla es un `<select>` editable (solo admin `recapture.assign`) → asigna directo desde la tabla vía single-assign `PATCH /leads/:id/assign`. Pending + toast por fila, `stopPropagation` (no abre el drawer). El agente la ve read-only (nombre).
- **Botón "Recargar" eliminado** (la lista refresca sola al asignar/filtrar; el ícono no se veía y confundía).
- **Pista visible** cuando no hay selección (cómo usar el multi-select / la columna).

## Pipeline SDD aplicado
- proposal + design + spec + tasks (skill ui-ux-pro-max: patrón inline-edit en celda).
- **verify** (typecheck + vitest, corrido por el orquestador): limpio + suite verde.
- **review adversarial (1 foco, bajo riesgo)**: CLEAN (8 puntos confirmados) + 2 WARNING:
  - WARNING 1: el select mostraba vacío si el assignee estaba fuera del pool → **FIX**: option fantasma con `assigneeName`.
  - WARNING 2: el pool incluía usuarios `disabled` → **FIX**: filtro a `status === 'active'`.
- gate final: typecheck limpio + suite 3484/0.

## Commits / Deploy
- Commit `06b355c` → deploy verde `27891328497`.

## Notas
- Decisión del usuario (vs multi-select-only): dropdown inline en la columna por ser lo más descubrible.
- Origen: tras el cambio `recapture-admin-assign`, el usuario no encontraba dónde asignar ("no lo veo") y el botón recargar parecía no hacer nada.
