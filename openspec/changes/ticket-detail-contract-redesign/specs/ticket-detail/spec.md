# Spec (delta) — ticket-detail-contract-redesign

Capability: **ticket-detail** (detalle de ticket: sidebar, header y composer del feed).

## ADDED Requirements

### Requirement: El tipo `Ticket` (lectura) expone `contractId`

El tipo `Ticket` del FE DEBE incluir `contractId: string | null`, reflejando el `contractId` que el `TicketDto` del BE ya expone. DEBE ser `null` para tickets legacy creados antes de que el contrato fuera obligatorio.

#### Scenario: Ticket con contrato
- **GIVEN** un `TicketDto` del BE con `contractId = "contract-9"`
- **WHEN** se mapea al tipo `Ticket` del FE
- **THEN** `ticket.contractId === "contract-9"`

#### Scenario: Ticket legacy sin contrato
- **GIVEN** un `TicketDto` legacy sin contrato
- **WHEN** se mapea al tipo `Ticket` del FE
- **THEN** `ticket.contractId === null`

### Requirement: El sidebar muestra el CONTRATO del ticket

El sidebar de Detalles DEBE mostrar una fila "Contrato" (justo después de "Cliente") que resuelve el contrato del ticket. El label legible se resuelve CLIENT-SIDE vía `useClientContracts(ticket.customerId)`, buscando el contrato cuyo `id` matchea `ticket.contractId` y formateándolo con `buildContractLabel` (formato `plan - dirección - tecnología`). NO DEBE requerir ningún cambio de backend.

#### Scenario: Existe una fila "Contrato"
- **GIVEN** el sidebar del detalle de ticket
- **WHEN** se renderiza la sección Detalles
- **THEN** existe una fila con la etiqueta "Contrato"

#### Scenario: Contrato encontrado → label legible
- **GIVEN** un ticket con `contractId = "contract-1"` y un cliente cuyo `useClientContracts` devuelve un contrato con `id = "contract-1"`, `plan = "Fibra 300MB"`, `address = "Av. Siempreviva 742"`, `technology = "FTTH"`
- **WHEN** se renderiza la fila Contrato
- **THEN** la fila muestra el label `"Fibra 300MB - Av. Siempreviva 742 - FTTH"`

#### Scenario: Contrato encontrado → link al cliente
- **GIVEN** un ticket con contrato resuelto y `customerId = "<uuid>"`
- **WHEN** se renderiza la fila Contrato
- **THEN** el label es un link cuyo `href` es `/admin/customers/view/<uuid>`

#### Scenario: Ticket sin contrato → "—"
- **GIVEN** un ticket con `contractId = null`
- **WHEN** se renderiza la fila Contrato
- **THEN** la fila muestra "—" y NO dispara la query de contratos por el contrato

#### Scenario: Cargando contratos
- **GIVEN** un ticket con `contractId` set y `useClientContracts` en estado `isLoading = true`
- **WHEN** se renderiza la fila Contrato
- **THEN** la fila muestra el texto "Cargando…"

#### Scenario: Contrato no encontrado (de baja) → fallback
- **GIVEN** un ticket con `contractId = "contract-1"` cuyo `useClientContracts` NO devuelve un contrato con ese `id` (ej. contrato dado de baja o no listado)
- **WHEN** se renderiza la fila Contrato
- **THEN** la fila muestra el fallback `"Contrato #contract-1"`
- **AND** NO muestra el plan de otro contrato de la lista

#### Scenario: Sin `customerId` → no se consulta
- **GIVEN** un ticket sin `customerId` (string vacío)
- **WHEN** se renderiza el sidebar
- **THEN** `useClientContracts` se invoca con `enabled = false` (segundo argumento falsy), evitando la query

## MODIFIED Requirements

### Requirement: Los botones del detalle usan el atom `<Button>`

Los botones de acción del detalle de ticket (sidebar y composer del feed) DEBEN usar el atom `<Button>` del design system en vez de elementos `<button>` nativos con clases ad-hoc. El estado de carga DEBE manejarse vía la prop `loading` del atom.

#### Scenario: Guardar del sidebar usa Button con loading
- **GIVEN** el sidebar con permisos de escritura y un draft modificado (`isDirty`)
- **WHEN** se renderiza el botón Guardar
- **THEN** es un atom `<Button variant="primary">`
- **AND** mientras `isSaving` está en true, el botón refleja el estado `loading`

#### Scenario: Composer usa Button para Adjuntar y Comentar
- **GIVEN** el composer del feed de comentarios con un autor logueado
- **WHEN** se renderizan las acciones del composer
- **THEN** "Adjuntar imagen" es un atom `<Button variant="secondary">`
- **AND** "Comentar" es un atom `<Button variant="primary">` que refleja `loading` mientras `pending` está en true

#### Scenario: Reintentar del error-state usa Button
- **GIVEN** el feed de comentarios en estado de error de carga
- **WHEN** se renderiza la acción de recuperación
- **THEN** "Reintentar" es un atom `<Button variant="secondary">`

### Requirement: El header del detalle alinea título y acciones en una fila

El header del detalle de ticket DEBE mostrar el título junto con los controles (select de Estado + kebab de Acciones) agrupados en una sola fila, sin colores hex mágicos. Todo color DEBE provenir de tokens del design system.

#### Scenario: Título y controles en la misma fila
- **GIVEN** el detalle de ticket
- **WHEN** se renderiza el header
- **THEN** el título, el select de Estado y el menú kebab de Acciones están agrupados en el mismo bloque de fila

#### Scenario: Sin hex mágicos en el CSS del detalle
- **GIVEN** los `.module.css` nuevos o modificados por este cambio (`TicketHeader`, `TicketDetailPage`, `TicketCommentsTimeline`, `TicketSidebar`)
- **WHEN** se inspeccionan sus declaraciones de color
- **THEN** no existen literales hex mágicos (ej. `#dc2626`, `#fef2f2`, `#b91c1c`) — todos los colores usan tokens `--color-*` / `--space-*` / `--radius-*` / `--font-size-*`

### Requirement: La metadata del sidebar está agrupada por bloques

El sidebar de Detalles DEBE agrupar sus filas en bloques separados por divisores: contexto del ticket (Cliente, Contrato, Reporter), campos editables (Asignado, Prioridad, Area) y timestamps (Creado, Actualizado). La lógica de draft + GUARDAR unificado (#48) DEBE permanecer intacta.

#### Scenario: Bloques separados por divisor
- **GIVEN** el sidebar del detalle de ticket
- **WHEN** se renderiza la sección Detalles
- **THEN** las filas se agrupan en bloques (`.group`) separados por divisores (`.divider`)
- **AND** los selects editables (Asignado, Prioridad, Area) tienen un `<label htmlFor>` asociado

#### Scenario: El GUARDAR unificado sigue persistiendo en un PATCH
- **GIVEN** el sidebar con asignado/prioridad/area modificados en el draft
- **WHEN** el usuario hace click en Guardar
- **THEN** se dispara un único PATCH con los campos del draft (comportamiento #48 sin cambios)
