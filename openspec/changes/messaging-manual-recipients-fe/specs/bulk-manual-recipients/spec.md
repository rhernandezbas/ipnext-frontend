# Spec — bulk-manual-recipients (new capability, nivel 4 EPIC Bulk)

RFC-2119. Cada scenario cubierto por al menos un test Vitest + Testing Library (sdd-verify).
Capability nueva — se documenta completa (no delta).

## Capability: tipos del contrato

### Requirement: TYPE-1 — `manualClientIds` en preview y create
`PreviewSegmentInput` MUST aceptar `manualClientIds?: string[]` FLAT (junto a `statuses`).
`CreateCampaignInput` MUST aceptar `manualClientIds?: string[]` top-level, PARALELO a `segment`.
El campo MUST ser opcional (cero regresión con los flujos que no usan lista manual).

#### Scenario: preview con lista manual
- **GIVEN** un input de preview con `statuses: []` y `manualClientIds: ['a','b']`
- **WHEN** se llama `previewSegment(input)`
- **THEN** el body posteado incluye `manualClientIds` FLAT junto a `statuses`

#### Scenario: create con lista manual
- **GIVEN** un `CreateCampaignInput` con `segment` y `manualClientIds: ['a']`
- **WHEN** se llama `createCampaign(input)`
- **THEN** el body incluye `manualClientIds` top-level, sin anidarlo dentro de `segment`

## Capability: gate de criterio

### Requirement: CRIT-1 — `hasRecipients` acepta segmento O lista manual
`hasRecipients(segment, manualClientIds)` MUST devolver `true` si el segmento filtra
(`hasSegmentCriteria`) O si la lista manual no está vacía; `false` sólo si ambos están vacíos.
`hasSegmentCriteria` existente MUST quedar intacto.

#### Scenario: sólo lista manual
- **GIVEN** `segment = { statuses: [] }` y `manualClientIds = ['a']`
- **WHEN** se evalúa `hasRecipients`
- **THEN** devuelve `true`

#### Scenario: vacío total
- **GIVEN** `segment = { statuses: [] }` y `manualClientIds = []`
- **WHEN** se evalúa `hasRecipients`
- **THEN** devuelve `false`

#### Scenario: sólo segmento
- **GIVEN** `segment = { statuses: ['late'] }` y `manualClientIds = []`
- **WHEN** se evalúa `hasRecipients`
- **THEN** devuelve `true`

## Capability: picker multi-select

### Requirement: PICK-1 — agregar, quitar, dedup, exclusión
`ManualRecipientsPicker` MUST envolver el `CustomerPicker`: elegir un cliente lo AGREGA a la
lista (chip con nombre + teléfono), con dedup por id; un ✕ por chip lo QUITA; los ya-agregados
MUST excluirse de los resultados del typeahead.

#### Scenario: agregar un cliente
- **GIVEN** el picker vacío
- **WHEN** el operador busca y elige "Juan García"
- **THEN** aparece un chip con "Juan García" y su teléfono, y `onChange` recibe la lista con ese id

#### Scenario: dedup
- **GIVEN** "Juan García" ya agregado
- **WHEN** el operador lo vuelve a elegir
- **THEN** la lista NO agrega un duplicado

#### Scenario: exclusión de ya-agregados
- **GIVEN** "Juan García" ya agregado
- **WHEN** el operador vuelve a buscar
- **THEN** "Juan García" NO aparece en los resultados

#### Scenario: quitar un cliente
- **GIVEN** "Juan García" agregado
- **WHEN** el operador clickea "Quitar Juan García"
- **THEN** el chip desaparece y `onChange` recibe la lista sin ese id

### Requirement: PICK-2 — a11y y contador
La lista de chips MUST exponer `aria-live="polite"`; cada ✕ MUST ser un SVG con
`aria-label="Quitar {nombre}"`, target ≥44px y `focus-visible`. MUST haber un estado vacío
explicado y un contador de destinatarios manuales (con `aria-live`). Cero hex/px crudo (tokens).

#### Scenario: estado vacío
- **GIVEN** el picker sin destinatarios
- **WHEN** se renderiza
- **THEN** muestra un texto que explica que no hay destinatarios manuales

#### Scenario: botón de quitar accesible
- **GIVEN** "Juan García" agregado
- **WHEN** se inspecciona el botón de quitar
- **THEN** tiene `aria-label` "Quitar Juan García" y es alcanzable por teclado

## Capability: integración en el composer

### Requirement: COMP-1 — combinar segmento + lista manual
`CampaignComposer` MUST tener estado de lista manual; el `ManualRecipientsPicker` MUST ubicarse
después de `SegmentBuilder`. El preview MUST re-dispararse al agregar/quitar un manual; el gate
de preview y `canCreate` MUST usar `hasRecipients`. El create MUST incluir `manualClientIds`
cuando la lista no está vacía y OMITIRLO cuando está vacía.

#### Scenario: preview se dispara con sólo lista manual
- **GIVEN** un template mapeado, segmento vacío, y se agrega un destinatario manual
- **WHEN** pasa el debounce del preview
- **THEN** se llama `previewSegment` con `manualClientIds` incluido

#### Scenario: crear con lista manual
- **GIVEN** todo válido y una lista manual no vacía
- **WHEN** se confirma la creación
- **THEN** `createCampaign` recibe `manualClientIds` top-level

#### Scenario: canCreate con sólo manual
- **GIVEN** template mapeado, nombre, preview `count>0`, segmento vacío y lista manual no vacía
- **WHEN** se evalúa el gate
- **THEN** "Crear campaña" queda habilitado

#### Scenario: sin lista manual, payloads intactos
- **GIVEN** el flujo sin destinatarios manuales
- **WHEN** se dispara preview y create
- **THEN** los bodies NO incluyen la key `manualClientIds`

## Capability: mapeo de errores

### Requirement: ERR-1 — errores de manual recipients
`useCreateCampaign` MUST mapear: `MANUAL_RECIPIENTS_NOT_FOUND` (422) exponiendo `missingClientIds`;
`TOO_MANY_MANUAL_RECIPIENTS` (422) → "máximo 5000 destinatarios manuales";
`VALIDATION_ERROR` (400) → mensaje de validación genérico.

#### Scenario: missing recipients expone los ids
- **GIVEN** un 422 `{code:'MANUAL_RECIPIENTS_NOT_FOUND', missingClientIds:['x','y']}`
- **WHEN** falla el create
- **THEN** el hook expone `missingRecipientsError.missingClientIds = ['x','y']`

#### Scenario: demasiados destinatarios
- **GIVEN** un 422 `{code:'TOO_MANY_MANUAL_RECIPIENTS'}`
- **WHEN** falla el create
- **THEN** `serverError` menciona el máximo de 5000

#### Scenario: validación genérica
- **GIVEN** un 400 `{code:'VALIDATION_ERROR'}`
- **WHEN** falla el create
- **THEN** `serverError` muestra un mensaje de validación (sin crash)

## Capability: confirmación

### Requirement: CONF-1 — el resumen refleja los manuales
`CreateCampaignConfirmModal` MUST indicar cuántos destinatarios son manuales cuando la lista no
está vacía; el `total` sigue siendo el `count` (unión dedup) del preview.

#### Scenario: nota de manuales
- **GIVEN** una campaña con `manualCount = 3`
- **WHEN** se abre el modal de confirmación
- **THEN** el resumen menciona que 3 fueron agregados manualmente
