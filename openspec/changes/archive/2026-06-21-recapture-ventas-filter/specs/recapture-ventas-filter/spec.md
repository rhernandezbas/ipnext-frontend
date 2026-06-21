# Spec: Recaptación assignee pool restricted to sales role

## REQ-1: El pool de asignatarios SOLO incluye usuarios active con rol 'ventas'
El pool de asignatarios que alimenta los TRES selects de asignación de la página
Recaptación — (1) dropdown inline de la columna "Asignado", (2) `BulkAssignToolbar`
de asignación masiva, y (3) el select "Operador" del `LeadDetailDrawer` — MUST
contener únicamente `RbacUser` que cumplan AMBAS condiciones: `status === 'active'`
Y poseer al menos un rol con `code === 'ventas'`. Cualquier usuario que no cumpla
AMBAS condiciones MUST NOT aparecer en ninguno de los tres selects.

### Scenario: usuario active con rol ventas SÍ aparece en los tres selects
- **Given** un `RbacUser` con `status === 'active'` cuyo `roles` incluye un rol con `code === 'ventas'`
- **When** se renderiza la página Recaptación como admin (`recapture.assign`) y se abre el `LeadDetailDrawer`
- **Then** ese usuario MUST aparecer como `<option>` en el dropdown inline, en el toolbar de asignación masiva Y en el select "Operador" del drawer

### Scenario: usuario active SIN rol ventas NO aparece
- **Given** un `RbacUser` con `status === 'active'` cuyo `roles` NO incluye ningún rol con `code === 'ventas'`
- **When** se renderiza la página Recaptación como admin
- **Then** ese usuario MUST NOT aparecer como `<option>` en el dropdown inline, ni en el toolbar masivo, ni en el select "Operador" del drawer

### Scenario: admin sin rol ventas NO aparece
- **Given** un `RbacUser` active con un rol `code === 'administrador'` y SIN rol `code === 'ventas'`
- **When** se renderiza la página Recaptación como admin
- **Then** ese admin MUST NOT aparecer en el pool de asignatarios de ninguno de los tres selects

### Scenario: usuario disabled con rol ventas NO aparece
- **Given** un `RbacUser` con `status === 'disabled'` aunque tenga rol `code === 'ventas'`
- **When** se renderiza la página Recaptación como admin
- **Then** ese usuario MUST NOT aparecer en el pool (la condición active sigue vigente) en ninguno de los tres selects

## REQ-3: El predicado del pool está centralizado (single source of truth)
El filtro `status === 'active'` + rol `code === 'ventas'` MUST estar implementado
UNA sola vez, en un hook compartido (`useAssignableOperators`). Los tres selects
(inline, bulk y drawer) MUST consumir ese hook — NINGUNO MUST reimplementar el
filtro ni mapear `useRbacUsers` crudo. Esto impide que el predicado vuelva a
divergir entre selects.

### Scenario: el predicado vive en un único hook
- **Given** el hook compartido `useAssignableOperators(enabled)` que envuelve `useRbacUsers` y aplica el predicado active + ventas con guard defensivo `(u.roles ?? [])`
- **When** cualquiera de los tres selects necesita el pool de operadores
- **Then** MUST obtenerlo llamando a `useAssignableOperators` (gateado por su `canAssign`), y NO MUST duplicar el `.filter(...).map(...)` localmente

### Scenario: el guard defensivo tolera un user sin roles
- **Given** un `RbacUser` que el BE devuelve sin el array `roles` (undefined)
- **When** `useAssignableOperators` calcula el pool
- **Then** MUST excluir a ese usuario sin lanzar una excepción (gracias a `(u.roles ?? [])`)

## REQ-2: Un lead asignado a alguien fuera del pool sigue mostrando su nombre (fantasma intacto)
El filtro de rol ventas MUST NOT borrar el historial de asignación visible. Si
un lead está asignado a un usuario que ya no pertenece al pool (ej. un admin sin
rol ventas), tanto el `InlineAssignSelect` como el select "Operador" del
`LeadDetailDrawer` MUST seguir reflejando al asignatario real vía la "option
fantasma" — el `value` del select MUST igualar el `assigneeId` real y existir una
`<option>` con el `assigneeName`.

### Scenario: lead asignado a usuario fuera del pool conserva el nombre (inline)
- **Given** un lead con `assigneeId` apuntando a un usuario que NO está en el pool de ventas (ej. admin sin rol ventas), con su `assigneeName` poblado
- **When** se renderiza la fila en modo admin con select inline editable
- **Then** el `value` del select MUST ser el `assigneeId` real
- **And** MUST existir una `<option>` (fantasma) cuyo label sea el `assigneeName` real

### Scenario: lead asignado a usuario fuera del pool conserva el nombre (drawer)
- **Given** un lead con `assigneeId` apuntando a un usuario que NO está en el pool de ventas, con su `assigneeName` poblado
- **When** se abre el `LeadDetailDrawer` en modo admin (`recapture.assign`)
- **Then** el `value` del select "Operador" MUST ser el `assigneeId` real
- **And** MUST existir una `<option>` (fantasma) cuyo label sea el `assigneeName` real

## REQ-4: Hint de pool vacío (opcional, informativo)
Cuando el actor PUEDE asignar (`recapture.assign`) pero el pool de operadores
ventas está vacío, el select "Operador" del `LeadDetailDrawer` SHOULD mostrar un
texto sutil que explique por qué no hay a quién asignar.

### Scenario: pool vacío muestra el hint
- **Given** un admin (`recapture.assign`) y CERO `RbacUser` que cumplan active + ventas
- **When** se abre el `LeadDetailDrawer`
- **Then** el select "Operador" SHOULD mostrar un texto del tipo "No hay usuarios con rol ventas para asignar"

### Scenario: con al menos un operador ventas, NO hay hint
- **Given** un admin y al menos un `RbacUser` active con rol ventas
- **When** se abre el `LeadDetailDrawer`
- **Then** el hint de pool vacío MUST NOT mostrarse
