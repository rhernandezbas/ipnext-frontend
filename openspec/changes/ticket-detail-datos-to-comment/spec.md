# Spec (delta) — ticket-detail-datos-to-comment (#77)

## ADDED — Comentario de apertura en el feed del ticket

### Requirement: El detalle de ticket muestra la descripción inicial como primer comentario del hilo

El feed de Conversación DEBE mostrar, como primer ítem, un comentario de apertura derivado del ticket cuando la descripción no esté vacía.

#### Scenario: Apertura presente con descripción
- **GIVEN** un ticket con `description = "X"`, `reporterName = "Juan"` y `createdAt = <iso>`
- **WHEN** se renderiza el feed de comentarios
- **THEN** el primer ítem muestra autor "Juan", la fecha formateada legible (es-AR) y el texto "X"

#### Scenario: Apertura ausente con descripción vacía
- **GIVEN** un ticket con `description` vacío o solo espacios
- **WHEN** se renderiza el feed de comentarios
- **THEN** NO se muestra un comentario de apertura

#### Scenario: Autor fallback
- **GIVEN** un ticket sin `reporterName` ni `reporter`
- **WHEN** se renderiza el comentario de apertura
- **THEN** el autor mostrado es "Sistema"

## REMOVED — Sub-page "Datos" del detalle de ticket

### Requirement: El detalle de ticket NO expone un tab "Datos"

#### Scenario: Tabs disponibles
- **GIVEN** el detalle de ticket
- **WHEN** se renderizan los tabs
- **THEN** existen únicamente "Conversación" (default) y "Relacionado", y NO existe un tab "Datos"

## ADDED — Formato de fechas centralizado y legible

### Requirement: El detalle de ticket usa helpers de fecha compartidos en es-AR

#### Scenario: Fecha absoluta de comentario
- **GIVEN** un timestamp ISO válido
- **WHEN** se formatea con `formatDateTime`
- **THEN** se muestra en formato es-AR legible (día, mes corto, año, hora:minuto)

#### Scenario: ISO inválido
- **GIVEN** un string que no es una fecha válida
- **WHEN** se formatea con `formatDateTime`
- **THEN** se devuelve el input sin romper

#### Scenario: Fecha relativa en sidebar ("Creado")
- **GIVEN** una fecha reciente
- **WHEN** se formatea con `formatRelative`
- **THEN** se muestra en forma relativa es-AR (ej. "hace 3 días")
