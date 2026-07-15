# Design — Manual recipients FE (nivel 4 EPIC Bulk WhatsApp)

## 1. Cómo se obtiene el teléfono para el chip

**Decisión: extender `CustomerPicker.onChange` con un 3er argumento OPCIONAL
`client?: CustomerSummary`.**

- La firma pasa de `(id, name) => void` a `(id, name, client?) => void`.
- Los 5 usos existentes (`AssignTargetPanel`, `CreateTaskModal`, `CreateTicketModal`,
  `TransferServiceModal`, y el test) usan `onChange={(id, name) => …}` — verificado file:line.
  En JS los args extra se ignoran; en TS una función de 2 params ES asignable a un tipo de 3
  params (bivarianza de parámetros). **Cero break.**
- El `CustomerPicker` YA tiene el objeto `CustomerSummary c` (con `c.phone`) en el `onClick` de
  cada opción. Pasarlo hacia arriba es gratis: no hay re-fetch ni carrera.

**Alternativa rechazada:** que el wrapper re-derive el teléfono con una segunda búsqueda. El
`CustomerPicker` busca por texto (nombre/teléfono), no por id — resolver el phone por id
implicaría otra query, más tokens y una carrera. Peor por todos lados.

## 2. Multi-select envolviendo el single-select

`ManualRecipientsPicker` es CONTROLADO (`value: ManualRecipient[]` + `onChange`), molde
`SegmentBuilder`. Renderiza el `CustomerPicker` SIEMPRE con `value={null}` (nunca entra en su
estado de chip interno) y:

- **Agregar:** en el pick, si el id no está en la lista, lo empuja con `{id, name, phone}`.
- **Reset para seguir agregando:** un `key` que se incrementa en cada pick REMONTA el
  `CustomerPicker`, limpiando su `query`/`debounced`/`open` internos (que el componente no
  expone para limpiar desde afuera salvo por su propio path de "clear chip", inaccesible acá).
- **Dedup:** por id, en el push. Un pick repetido no agrega (y resetea igual).
- **Exclusión de ya-agregados:** el wrapper pasa `excludeIds={value.map(r => r.id)}` al
  `CustomerPicker`. Esto exige una capacidad NUEVA en el picker (ver §3), porque el filtro de
  resultados vive DENTRO del picker (el wrapper no puede filtrar su dropdown desde afuera).

`ManualRecipient = { id: string; name: string; phone: string }` — tipo FE-only (metadata para
el chip), definido y exportado desde el componente. El composer deriva
`manualClientIds = value.map(r => r.id)` para el contrato con el BE (siempre `string[]` de UUIDs,
vía `String(c.id)`).

## 3. `excludeIds` en `CustomerPicker` (aditivo)

Se agrega `excludeIds?: string[]` junto al `excludeId?` single existente. El filtro combina
ambos en un `Set`. Ningún caller existente pasa `excludeIds` (verificado) → cero regresión.
Se prefirió esto a "filtrar en el wrapper" porque el listado de resultados se renderiza dentro
del `CustomerPicker`; extenderlo mantiene UNA sola fuente de filtrado.

## 4. Gate de criterio — `hasRecipients`

```
hasRecipients(segment, manualClientIds) =
  hasSegmentCriteria(segment) || manualClientIds.length > 0
```

`hasSegmentCriteria` queda intacto (lo usa `SegmentBuilder` para su propio hint). El composer
pasa a gatear preview y `canCreate` con `hasRecipients`. Una lista manual no vacía habilita el
preview aunque el segmento esté vacío — el BE devuelve `count` = unión dedup.

## 5. Payload y omisión de la key vacía

- **Preview** (`previewSegment` postea el input FLAT): `preview({ ...segment, manualClientIds })`
  SOLO si la lista no está vacía; si está vacía, `preview(segment)` tal cual (idéntico a hoy →
  CC-5 no cambia).
- **Create** (`CreateCampaignInput`): `manualClientIds` top-level, PARALELO a `segment`, incluido
  SOLO si la lista no está vacía (CC-7/CC-13 no cambian su payload).
- **Deps del `useEffect` de preview:** sumar `manualClientIds.join(',')` a las deps primitivas
  (si no, agregar/quitar un manual no re-dispara el preview).

## 6. Mapeo de errores (BE → FE)

- `MANUAL_RECIPIENTS_NOT_FOUND` (422, body `{code, missingClientIds: string[]}`): se expone como
  `missingRecipientsError` (mismo criterio que `missingVariablesError`), para marcar esos chips /
  mostrar "N destinatarios ya no existen". `toCreateServerError` devuelve `null` para este código
  (lo maneja el error dedicado, sin doble mensaje).
- `TOO_MANY_MANUAL_RECIPIENTS` (422): mensaje "máximo 5000 destinatarios manuales".
- `VALIDATION_ERROR` (400): mensaje de validación genérico.
  Ambos se agregan a `CREATE_ERROR_MESSAGES` → salen por `serverError`.

## 7. a11y / motion (innegociables)

- Chips en un `<ul aria-live="polite">` con nombre + teléfono; ✕ como **SVG** de 44×44px con
  `aria-label="Quitar {nombre}"` y `focus-visible`. Contador con `aria-live="polite"` (anuncia
  altas y bajas; el `aria-relevant` default de la lista no anuncia removals).
- Estados: vacío ("sin destinatarios manuales" con explicación) y con lista. El fetch/loading/
  error/empty del typeahead los cubre el `CustomerPicker` interno.
- Motion: chips entran con transición 150-300ms **ease-out** (nunca ease-in para entradas);
  `@media (prefers-reduced-motion: reduce)` desactiva la animación.
- Tokens SIEMPRE (`var(--color-*)`, `--space-*`, `--radius-*`); cero hex/px crudo. Contraste
  del texto secundario (teléfono) sobre superficie calculado ≥4.5:1 usando tokens ya validados.

## 8. Confirm modal

`CreateCampaignConfirmModal` gana `manualCount?: number` (default 0). Si > 0, muestra una nota
dentro del resumen. El `total` sigue siendo `previewData.count` (la unión dedup ya calculada por
el BE) — no se re-suma nada en el FE.

> **Fix wave (FIX 8):** el copy pasó de "incluye N" a **"incluye HASTA N agregados manualmente"**.
> `manualCount` es el largo CRUDO de la lista FE y `total` es la unión dedup del BE (descuenta
> overlap / opt-out / inexistentes), por lo que `total` puede ser MENOR que `manualCount`. Con
> "incluye N" el copy podía contradecirse ("2 clientes (incluye 3 agregados manualmente)"); "hasta N"
> lo evita.

## 9. Fix wave (post-review) — a11y, contraste y preview

Correcciones de review aplicadas sobre la implementación base (todas con test focalizado donde hay
lógica; las de puro CSS verificadas por el token/contraste correcto):

- **FIX 1 (contraste)** — `.subtitle`/`.counter` usaban `--color-text-secondary` (#6c757d). El
  fondo REAL de la app NO es blanco: es `--color-gray-50` (#f8f9fa, de `AdminLayout .content`).
  #6c757d/#f8f9fa = **4.45:1 → FALLA** el 4.5:1. Cambiado a `--color-gray-600` (#495057) = **7.76:1**.
  El comentario del header del CSS que afirmaba "sobre #ffffff → 4.84:1, pasa" era FALSO y quedó
  corregido.

- **FIX 2 (preview vs. manuales)** — `PreviewModal` sólo consulta `useSegmentRecipients(segment)`;
  el BE **no** extendió `/segment/recipients` con `manualClientIds`. Sin aviso, una campaña
  solo-manual mostraba "sin destinatarios" (mentira) y una mixta un set distinto al count. Fix
  FE-only: el modal recibe `manualCount` y muestra un aviso `role="note"` ("Sumaste N destinatario(s)
  manual(es). Se validan al enviar; el detalle de abajo muestra solo el segmento"); en el caso
  solo-manual NO se muestra el empty engañoso.

  **FIX 2 · gate del segmento vacío (fix wave 2)** — en una campaña solo-manual el segmento está
  VACÍO, pero "Ver preview" está habilitado porque `criteriaPresent = hasRecipients` incluye la
  lista manual. Al abrir, `useSegmentRecipients(segment)` disparaba `GET/POST /segment/recipients`
  con el segmento vacío, y el BE lo **rechaza con 400 UNFILTERED_SEGMENT** (`ListSegmentRecipients`
  → `assertSegmentIsFiltered`, que NO cambió) → el operador veía un error rojo `role="alert"` en un
  preview VÁLIDO (¡y solo-manual es el caso central de la feature!). Fix: la query se gatea con
  `enabled: open && hasSegmentCriteria(segment)` — el predicado **SOLO-segmento**, NO `hasRecipients`.
  Además, todo el bloque de resultados del segmento (loading / error / empty / resumen+tabla) se
  renderiza sólo si `hasSegmentCriteria(segment)`. Así: solo-manual → la query no corre, no hay 400,
  se ve SÓLO la nota; mixta / solo-segmento → comportamiento intacto (tabla del segmento + nota si
  hay manuales); un error real del endpoint (con segmento con criterio) sigue mostrándose.

  **DEUDA (BE):** extender `/segment/recipients` con `manualClientIds` para un detalle 100% preciso
  en el preview (segmento + manuales dedup) en vez del aviso aproximado (ver §Deudas).

- **FIX 3 (focus order, 2.4.3)** — al quitar un chip el foco iba al `<body>`; ahora va al ✕ del
  chip siguiente (o el anterior si era el último, o el input si la lista quedó vacía), vía refs +
  `useLayoutEffect`.

- **FIX 4 (live region) — OVERRIDE de §7** — §7 pedía `aria-live="polite"` TANTO en la `<ul>` como
  en el contador; eso genera doble anuncio al agregar y no anuncia los removals de la lista
  (`aria-relevant` default no incluye `removals`). **Decisión final:** un ÚNICO live region, el
  contador con `role="status"` (cubre altas y bajas porque el número siempre cambia). La `<ul>`
  queda como lista con su `aria-label`, SIN `aria-live`.

- **FIX 5/6 (tokens/layout)** — `.chipName` `220px` → `22ch` y `translateY(4px)` → `var(--space-1)`;
  `.chipList` gana `max-height: 12.5rem` (200px, cap de layout — la escala de 4px no llega a este
  alto) + `overflow-y: auto` para que 50+ chips no empujen el resto del formulario.

- **FIX 7 (semántica/heading)** — `<section><h3>` → `<fieldset><legend>` (igual que el hermano
  `SegmentBuilder`): agrupa input+lista y elimina el salto de heading h1→h3 (1.3.1).

### Deudas conocidas (NO se arreglan en este ciclo)

- **BE `/segment/recipients` + `manualClientIds`** — extender el endpoint para que el `PreviewModal`
  liste el detalle EXACTO (segmento + manuales dedup), en vez del aviso aproximado de FIX 2.
- **Input de búsqueda del `CustomerPicker` ~37px** (<44px best-practice) — PRE-EXISTENTE del
  componente compartido, fuera de scope.
- **Validación de manuales (opt-out / inexistentes) sólo en create-time**, no en preview —
  consistente con el contrato BE actual.
- **Cambiar de template NO limpia la lista manual** — intencional (destinatarios independientes
  del template).
