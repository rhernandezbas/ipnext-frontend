# Proposal: task-send-to-iclass-fe

## Intent

Contraparte frontend del backend `task-send-to-iclass`. Cuando el usuario mueve una tarea al stage **"Enviar a IClass"**, el backend valida y crea una Orden de Servicio en IClass. El front debe manejar las 3 respuestas de error y el éxito:
- **422 `MISSING_REQUIRED_FIELDS`** (con `missingFields[]`): modal listando los campos faltantes; NO se confirma el move (revertir optimistic update).
- **422 `ICLASS_NODE_NOT_FOUND`**: la ciudad de la tarea no corresponde a un nodo de IClass → mensaje claro; no se mueve.
- **502 `ICLASS_UNAVAILABLE`**: IClass caído → mensaje + opción de reintentar; no se mueve.
- **Éxito**: la tarea avanza a "Registrado en IClass" (refetch) y se muestra el `iclassOrderCode` (toast).

## Scope

### In Scope
- `iclassOrderCode: string | null` en el tipo `ScheduledTask`.
- Componente reusable `IClassSendResultModal` (los 3 estados de error).
- Wiring del manejo de error en los DOS puntos de move: `TasksKanbanView` (drag-drop, con rollback del optimistic update) y `TasksTableView`/`StageSelect`.
- Toast de éxito con `iclassOrderCode`.

### Out of Scope
- Toggle del feature flag desde la UI (se hace por API/admin).
- Editar los campos faltantes dentro del modal (el modal navega al detalle de la tarea con "Editar tarea"; la edición usa el form existente).
- Bulk move (la barra de acciones masivas queda fuera de esta iteración).

## Capabilities
- `scheduling-iclass-send` (nuevo, FE): manejo de errores y feedback del alta de OS al mover de stage.

## Approach

El move ya existe (`useMoveTaskToStage` → `PATCH /api/scheduling/:id/stage`). Se intercepta el `onError` de la mutation: se lee `error.response.data.{code, missingFields, message}` y se abre `IClassSendResultModal` con el estado correspondiente; en kanban se revierte el optimistic update (ya hay rollback por snapshot). En éxito (`onSuccess`), si la respuesta trae `iclassOrderCode`, se muestra un toast. El modal: para `MISSING_REQUIRED_FIELDS` lista los campos (mapeados a labels es: nombre, teléfono, dirección, ciudad, descripción) + botón "Editar tarea" (navega al detalle) + "Cerrar"; para node/unavailable, mensaje + "Reintentar" + "Cerrar".

## Affected Areas
| Area | Impact |
|------|--------|
| `src/types/scheduling.ts` | Modified — `iclassOrderCode` |
| `src/components/molecules/IClassSendResultModal/` | New — componente + CSS |
| `src/pages/scheduling/SchedulingTasksPage/components/TasksKanbanView.tsx` | Modified — error state + modal + rollback |
| `src/pages/scheduling/SchedulingTasksPage/components/TasksTableView.tsx` | Modified — StageSelect error handling |
| `src/__tests__/...` | New — tests del modal + del wiring |

## Risks
| Risk | Mitigation |
|------|------------|
| Optimistic update no revierte ante 422 → tarjeta queda movida visualmente | El rollback por snapshot ya existe en kanban; el test debe cubrir el caso 422 |
| Labels de `missingFields` desincronizados con backend | Mapa explícito code→label; default al code crudo si falta |

## Rollback Plan
Revertir los commits del front. No hay migración ni estado persistido. El backend ya ignora todo si el flag está OFF, así que sin el front la feature simplemente no tiene UI (no rompe nada existente).

## Success Criteria
- [ ] 422 MISSING_REQUIRED_FIELDS → modal con los campos faltantes; la tarjeta NO queda movida (rollback).
- [ ] 422 ICLASS_NODE_NOT_FOUND y 502 ICLASS_UNAVAILABLE → mensaje claro; sin mover.
- [ ] Éxito → tarea en "Registrado en IClass" + toast con `iclassOrderCode`.
- [ ] Tests (Vitest) verdes; no romper los existentes.
