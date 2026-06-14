# Delta spec — gr-id-column (contracts-gr-id-column)

## ADDED Requirement: tipo `ContractSummary` expone `code`

`ContractSummary` MUST include the field `code: string | null`.
Este campo refleja directamente el `ContractSummaryDto.code` (= `Contract.grContratoId`)
que ya retorna el BE en `GET /contracts`. El FE no lo transforma.

## ADDED Requirement: columna "ID GR" en la tabla de contratos

La page `/admin/contracts` MUST renderizar una columna con header "ID GR" que muestre
el valor de `ContractSummary.code` para cada fila.

### Scenario: columna ID GR visible en la tabla
- GIVEN que el usuario navega a `/admin/contracts`
- WHEN la lista de contratos carga con al menos una fila
- THEN la tabla MUST contener un `<th>` con el texto "ID GR"

### Scenario: contrato con código GR muestra el código
- GIVEN un contrato con `code = "CTR-204382"`
- WHEN la fila del contrato se renderiza
- THEN la celda de la columna "ID GR" MUST mostrar el texto `"CTR-204382"`

### Scenario: contrato sin código GR muestra empty-state
- GIVEN un contrato con `code = null`
- WHEN la fila del contrato se renderiza
- THEN la celda de la columna "ID GR" MUST mostrar `"—"` (em-dash)

### Scenario: columna ID GR va primera
- GIVEN la tabla de contratos renderizada con datos
- WHEN se observa el orden de las columnas
- THEN "ID GR" MUST ser la primera columna (`<th>` index 0 en el `<thead>`)

## MODIFIED Requirement: fixtures de tests incluyen `code`

Los fixtures de tipo `ContractSummary` usados en los tests existentes MUST incluir el
campo `code` para mantener type-safety después de agregar el campo al tipo.

### Scenario: fixture con código GR
- GIVEN la fixture `mockContracts[0]` que modela un contrato de GR
- WHEN el tipo `ContractSummary` incluye `code: string | null`
- THEN la fixture MUST declarar `code: 'CTR-204382'` (u otro valor no-null)

### Scenario: fixture sin código GR
- GIVEN la fixture `mockContracts[1]` que modela un contrato sin GR
- WHEN el tipo `ContractSummary` incluye `code: string | null`
- THEN la fixture MUST declarar `code: null`

## Constraint: sin permisos nuevos

La columna "ID GR" MUST quedar dentro del gate de permiso `contracts.read` existente.
NO SE DEBE agregar ningún permiso nuevo ni modificar la lógica de `RequirePermission`.

## Constraint: sin cambios de backend

El campo `code` en el DTO ya es retornado por el BE. El FE MUST consumirlo tal cual,
sin transformación, sin nuevo endpoint, sin cambio de query params.
