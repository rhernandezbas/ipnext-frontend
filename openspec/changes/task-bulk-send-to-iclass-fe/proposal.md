# Proposal: task-bulk-send-to-iclass-fe

## Intent

Contraparte frontend del backend `task-bulk-send-to-iclass`. La acción masiva "Mover estado" hoy hace un loop secuencial que **traga los errores en silencio**. Reemplazarla por una llamada al **endpoint bulk** (`POST /api/scheduling/bulk/stage`) que devuelve resultado por tarea, y mostrar un **modal de resultado** al final con las que fallaron (y su motivo), con opción de **reintentar solo las fallidas**.

## Scope

### In Scope
- `api/scheduling.api.ts`: `bulkMoveToStage(ids, stageId)` → `POST /scheduling/bulk/stage`.
- Hook `useBulkMoveTasksToStage` (TanStack mutation).
- `BulkMoveResultModal`: resumen "X de N enviadas OK" + lista de fallidas con motivo legible (reusar `FIELD_LABELS`/labels de `useIClassSendFeedback`) + botones "Reintentar las fallidas" y "Cerrar".
- `TasksTableView` BulkActionBar `onMoveStage`: reemplazar el loop por `bulkMoveToStage`; si `failed > 0` → abrir el modal; si todo OK → toast.
- "Reintentar las fallidas" → re-llama el endpoint con solo los ids fallidos y actualiza el modal.

### Out of Scope
- Cambios de backend (ya hechos).
- Bulk close / bulk delete.

## Capabilities
### Modified
- `scheduling` (FE): la acción masiva de stage ahora reporta y permite reintentar fallos.

## Approach
El backend devuelve `{summary{total,ok,failed}, results:[{taskId, ok, errorCode?, reason?, missingFields?}]}` (siempre 200). El handler del bulk: llama el endpoint, si `summary.failed === 0` → toast de éxito; si hay fallos → abre `BulkMoveResultModal` con los `results`. El modal mapea cada `errorCode` a texto legible (reusando los labels existentes). "Reintentar" toma `results.filter(!ok).map(taskId)` y vuelve a llamar `bulkMoveToStage`.

## Affected Areas
| Area | Impact |
|------|--------|
| `src/api/scheduling.api.ts` | Modified — `bulkMoveToStage` |
| `src/hooks/useScheduling.ts` (o nuevo hook) | Modified/New — `useBulkMoveTasksToStage` |
| `src/components/molecules/BulkMoveResultModal/` | New — modal + CSS |
| `src/pages/scheduling/SchedulingTasksPage/components/TasksTableView.tsx` | Modified — `onMoveStage` usa el endpoint bulk + modal |

## Risks
| Risk | Mitigation |
|------|------------|
| Reintento en loop infinito si siempre fallan | el reintento es manual (botón), no automático |
| Modal confuso con muchos fallos | resumen arriba + lista scrolleable con tarea + motivo |
| Romper el bulk para stages no-IClass | el endpoint maneja cualquier stage; si `failed:0` no se abre modal (comportamiento igual al actual pero robusto) |

## Rollback Plan
Revertir el commit. El endpoint bulk del backend queda disponible pero sin usar.

## Success Criteria
- [ ] Bulk move con fallos parciales → modal con resumen + lista de fallidas (motivo legible).
- [ ] "Reintentar las fallidas" reprocesa solo esas y actualiza el modal.
- [ ] Todo OK → toast, sin modal.
- [ ] Tests (Vitest) verdes; sin regresiones.
