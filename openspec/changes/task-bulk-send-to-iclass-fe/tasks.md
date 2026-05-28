# Tasks — task-bulk-send-to-iclass-fe

STRICT TDD (Vitest): test rojo → implementación → verde. Sin romper los existentes.

- [x] 1 `api/scheduling.api.ts`: `bulkMoveToStage(ids: string[], stageId: string)` → `POST /scheduling/bulk/stage`, devuelve `{summary, results}`.
- [x] 2 Hook `useBulkMoveTasksToStage` (TanStack `useMutation`), invalida las queries de tareas al settle.
- [x] 3 (TDD) `BulkMoveResultModal` (`src/components/molecules/BulkMoveResultModal/`): props `{ open, summary, results, onRetryFailed, onClose }`. Render: resumen "X de N enviadas OK"; lista de fallidas (tarea + motivo legible mapeando `errorCode`→texto, reusando FIELD_LABELS de `useIClassSendFeedback` para missingFields y `reason` para ICLASS_REJECTED); botones "Reintentar las fallidas" (solo si hay fallidas) + "Cerrar". Patrón del `ConfirmModal`/`IClassSendResultModal`.
- [x] 4 (TDD) `TasksTableView` BulkActionBar `onMoveStage`: reemplazar el loop `for (id of ids) moveToStage.mutateAsync` por `bulkMoveToStage(ids, stageId)`. Si `summary.failed > 0` → abrir `BulkMoveResultModal` con `results`; si `failed === 0` → toast de éxito + cerrar diálogo.
- [x] 5 (TDD) "Reintentar las fallidas": toma `results.filter(r=>!r.ok).map(r=>r.taskId)`, re-llama `bulkMoveToStage`, actualiza el modal (nuevo summary/results). Si ya no quedan fallidas → cerrar + toast.
- [x] 6 Tests Vitest: fallo parcial abre modal con la lista + motivos; reintento reprocesa solo las fallidas; todo OK → toast sin modal; mover a stage no-IClass con todo OK → sin modal.
- [x] 7 `npm test` verde; `tsc --noEmit` sin errores nuevos en archivos tocados.
