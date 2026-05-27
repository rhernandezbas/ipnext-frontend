# Tasks — task-send-to-iclass-fe

STRICT TDD (Vitest): test rojo primero, luego implementación, luego verde. `npm test` debe quedar verde sin romper los existentes.

---

## Fase 1 — Tipo + Modal (TDD)

- [x] 1.1 Agregar `iclassOrderCode: string | null` a `ScheduledTask` en `src/types/scheduling.ts` (REQ-FE-TYPE-1). Ajustar fixtures de test si rompe tipos.
- [x] 1.2 (TEST ROJO) `src/__tests__/components/molecules/IClassSendResultModal.test.tsx`:
  - render MISSING_REQUIRED_FIELDS con `missingFields:["phone","description"]` → muestra "Teléfono" y "Descripción"; botones "Editar tarea" + "Cerrar".
  - código desconocido → muestra el crudo.
  - ICLASS_NODE_NOT_FOUND → mensaje de ciudad/nodo + "Reintentar"/"Cerrar".
  - ICLASS_UNAVAILABLE → mensaje de servicio no disponible + "Reintentar"/"Cerrar".
  - "Reintentar" llama `onRetry`; "Cerrar" llama `onClose`.
- [x] 1.3 Implementar `src/components/molecules/IClassSendResultModal/IClassSendResultModal.tsx` (+ `.module.css`). Reusar el patrón de `ConfirmModal` (portal, Esc, backdrop, focus). Mapa `FIELD_LABELS` code→label es.
- [x] 1.4 (TEST VERDE) 1.2 pasa.

## Fase 2 — Wiring Kanban (TDD)

- [x] 2.1 (TEST ROJO) En el test de `TasksKanbanView` (o nuevo `TasksKanbanView.iclass.test.tsx`): al mover a "Enviar a IClass" y el move rechazar con 422 MISSING_REQUIRED_FIELDS → abre el modal con los campos Y la tarjeta vuelve a su stage original (rollback). Éxito con `iclassOrderCode` → toast con el código. Mover a otro stage → sin modal.
- [x] 2.2 En `TasksKanbanView.tsx`: en `onError` de `moveMutation`, parsear `error.response.data.{code,missingFields,message}`; si el code es de IClass (MISSING_REQUIRED_FIELDS/ICLASS_NODE_NOT_FOUND/ICLASS_UNAVAILABLE) → setear `iclassError` state y abrir el modal (el rollback por snapshot ya existe). En `onSuccess`, si `data.iclassOrderCode` → toast. Renderizar `<IClassSendResultModal/>`.
- [x] 2.3 (TEST VERDE) 2.1 pasa.

## Fase 3 — Wiring Tabla (TDD)

- [x] 3.1 (TEST ROJO) En el test de `TasksTableView`/`StageSelect`: mover a "Enviar a IClass" con 422 → modal con campos; éxito → toast con `iclassOrderCode`.
- [x] 3.2 En `TasksTableView.tsx` (`StageSelect`/`onMove`): mismo manejo de error/éxito + render del modal. Extraer un hook/helper compartido si el manejo se duplica con el kanban (ej. `useIClassSendFeedback`) para no repetir el parseo.
- [x] 3.3 (TEST VERDE) 3.1 pasa.

## Fase 4 — Integración / verificación

- [x] 4.1 `npm test` (suite completa) verde, sin regresiones.
- [x] 4.2 Build de tipos OK (`tsc`/`vite build` si aplica — NO correr build pesado salvo que lo pida el usuario; al menos `tsc --noEmit` si está disponible).
- [ ] 4.3 Verificación manual (Playwright contra `http://190.7.234.37:7778`) → diferida: requiere el flag ON en prod. Se hace cuando se active el flag.

---

## Verification Checklist
- [x] V.1 Tipo `ScheduledTask.iclassOrderCode` presente.
- [x] V.2 Modal cubre los 3 estados de error + labels en español.
- [x] V.3 Kanban: 422 → modal + rollback (tarjeta no queda movida).
- [x] V.4 Tabla: 422 → modal.
- [x] V.5 Éxito → toast con `iclassOrderCode` y avance a "Registrado en IClass".
- [x] V.6 Mover a otro stage no dispara nada de IClass.
- [x] V.7 `npm test` verde.
