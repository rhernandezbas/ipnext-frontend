# Spec: scheduling-iclass-send (FE)

**Capability**: `scheduling-iclass-send` (NEW, frontend)
**Change**: `task-send-to-iclass-fe`
**Backend contract**: `PATCH /api/scheduling/:id/stage` → en éxito devuelve `ScheduledTask` (con `iclassOrderCode` cuando aplica); en error devuelve `{ code, missingFields?, message? }` con status 422/502.

---

## Added Requirements

### REQ-FE-TYPE-1: `iclassOrderCode` en el tipo
`ScheduledTask` (`src/types/scheduling.ts`) MUST incluir `iclassOrderCode: string | null`.

### REQ-FE-MISSING-1: Modal de campos faltantes

#### Scenario: 422 MISSING_REQUIRED_FIELDS abre el modal con los campos
**Given** una tarea movida al stage "Enviar a IClass"
**And** el backend responde 422 `{ code: "MISSING_REQUIRED_FIELDS", missingFields: ["phone","description"] }`
**When** la mutation falla
**Then** se MUST abrir el modal mostrando los labels en español de cada campo faltante (phone→"Teléfono", description→"Descripción", customerName→"Nombre del cliente", address→"Dirección", city→"Ciudad")
**And** el modal MUST ofrecer "Editar tarea" (navega al detalle de la tarea) y "Cerrar"
**And** la tarea NO MUST quedar en el stage destino (en kanban: rollback del optimistic update)

#### Scenario: código de campo desconocido cae al crudo
**Given** `missingFields` incluye un código sin label mapeado
**Then** se MUST mostrar el código crudo (no romper)

### REQ-FE-NODE-1: Ciudad sin nodo

#### Scenario: 422 ICLASS_NODE_NOT_FOUND
**Given** el backend responde 422 `{ code: "ICLASS_NODE_NOT_FOUND" }`
**When** la mutation falla
**Then** el modal MUST mostrar un mensaje claro (la ciudad de la tarea no corresponde a un nodo de IClass)
**And** MUST ofrecer "Reintentar" y "Cerrar"
**And** la tarea NO MUST cambiar de stage

### REQ-FE-UNAVAILABLE-1: IClass caído

#### Scenario: 502 ICLASS_UNAVAILABLE
**Given** el backend responde 502 `{ code: "ICLASS_UNAVAILABLE" }`
**When** la mutation falla
**Then** el modal MUST mostrar un mensaje de servicio no disponible
**And** MUST ofrecer "Reintentar" y "Cerrar"
**And** la tarea NO MUST cambiar de stage

### REQ-FE-SUCCESS-1: Éxito

#### Scenario: alta exitosa muestra el código
**Given** el move responde 200 con `ScheduledTask` cuyo `iclassOrderCode` no es null
**When** la mutation resuelve
**Then** la tarea MUST reflejar el avance a "Registrado en IClass" (vía refetch/optimistic)
**And** se MUST mostrar un toast de éxito que incluya el `iclassOrderCode`

### REQ-FE-OTHER-1: Otros stages sin cambios
Mover a un stage que NO sea "Enviar a IClass" MUST conservar el comportamiento actual (sin modal, sin toast de OS).

---

## Notes
- El move se dispara en `TasksKanbanView` (drag-drop, optimistic+rollback) y en `TasksTableView`/`StageSelect`. Ambos MUST integrar el manejo de error.
- El modal `IClassSendResultModal` es reusable: recibe el estado de error (`{ code, missingFields?, message? }`), `onClose`, `onRetry`, y datos de la tarea para "Editar tarea".
