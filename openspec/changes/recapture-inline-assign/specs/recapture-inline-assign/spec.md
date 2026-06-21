# Spec: Recaptación — Asignación inline descubrible

Deltas sobre el comportamiento actual de RecaptacionPage / RecaptacionTableView.
RFC 2119: MUST / MUST NOT / SHOULD / MAY.

---

## ADDED — Requirement: Select inline en la columna "Asignado" (admin)

El admin con `recapture.assign` MUST poder asignar un lead de a uno desde la tabla,
sin abrir el drawer.

### Scenario: admin ve el select inline en la columna Asignado
- **GIVEN** un usuario con permiso `recapture.assign`
- **AND** la lista tiene al menos un lead
- **WHEN** se renderiza la tabla
- **THEN** la celda "Asignado" de cada fila MUST contener un `<select>` editable
- **AND** el `<select>` MUST tener `aria-label` que identifique al lead (ej. el nombre de contacto)
- **AND** el valor seleccionado MUST reflejar `lead.assigneeId` (o "— Sin asignar —" cuando es null)

### Scenario: cambiar el select inline dispara el single-assign
- **GIVEN** el admin ve el select inline de un lead `L`
- **WHEN** elige un operador `op` en ese select
- **THEN** el sistema MUST invocar el single-assign con `(leadId = L.id, operatorId = op.id)`
- **AND** al elegir "— Sin asignar —" MUST invocar con `operatorId = null`

### Scenario: feedback de éxito por fila
- **GIVEN** el admin cambió el select de un lead
- **WHEN** el single-assign resuelve OK
- **THEN** el sistema MUST mostrar un toast de éxito (`role="status"`)

### Scenario: feedback de error por fila
- **GIVEN** el admin cambió el select de un lead
- **WHEN** el single-assign falla
- **THEN** el sistema MUST mostrar un toast de error (`role="alert"`)

---

## ADDED — Requirement: Pending por fila

Mientras un lead se está asignando, su select MUST quedar deshabilitado, sin afectar
las demás filas.

### Scenario: el select de la fila en vuelo se deshabilita
- **GIVEN** una asignación inline en curso para el lead `L`
- **WHEN** la mutación está pendiente
- **THEN** el `<select>` de `L` MUST estar `disabled`
- **AND** los `<select>` de las demás filas MUST seguir habilitados

---

## ADDED — Requirement: El select inline no abre el drawer

### Scenario: interactuar con el select no dispara el row-click
- **GIVEN** la tabla tiene `onRowClick` (abrir detalle) activo
- **WHEN** el admin hace click sobre el `<select>` inline o cambia su valor
- **THEN** el sistema MUST NOT abrir el drawer de detalle (stopPropagation)

---

## MODIFIED — Requirement: Columna "Asignado" read-only para el agente

El agente (sin `recapture.assign`) MUST seguir viendo la asignación como texto
read-only, sin control editable.

### Scenario: el agente ve el nombre, no un select
- **GIVEN** un usuario SIN permiso `recapture.assign`
- **WHEN** se renderiza la tabla
- **THEN** la celda "Asignado" MUST mostrar `assigneeName ?? assigneeId ?? '—'`
- **AND** MUST NOT contener ningún `<select>` de asignación

---

## REMOVED — Requirement: Botón "Recargar" del header

El botón "Recargar" (`<Button variant="icon">` con `IconRefresh`) se elimina porque
la lista se refresca sola al asignar/filtrar (invalidación de TanStack Query).

### Scenario: el header no tiene botón Recargar
- **GIVEN** cualquier usuario en RecaptacionPage
- **WHEN** se renderiza el header
- **THEN** MUST NOT existir un botón "Recargar" (ni `aria-label="Recargar"`)

---

## ADDED — Requirement: Pista del multi-select sin selección

Cuando el admin no tiene leads seleccionados, una pista visible MUST explicar ambas
vías de asignación.

### Scenario: la pista aparece sin selección (admin)
- **GIVEN** un usuario con `recapture.assign`
- **AND** `selectedIds.length === 0`
- **WHEN** se renderiza la página
- **THEN** MUST mostrarse una pista que mencione asignar en lote (checkbox) y de a uno (columna Asignado)

### Scenario: la pista desaparece con selección
- **GIVEN** un usuario con `recapture.assign`
- **WHEN** selecciona al menos un lead (`selectedIds.length > 0`)
- **THEN** la pista MUST desaparecer
- **AND** el `BulkAssignToolbar` MUST mostrarse (comportamiento actual intacto)

### Scenario: el agente no ve la pista
- **GIVEN** un usuario SIN `recapture.assign`
- **WHEN** se renderiza la página
- **THEN** la pista MUST NOT mostrarse
