# Tasks — messaging-manual-recipients-fe

Orden TDD (test que falla primero → código → refactor). Correr SOLO los archivos afectados
durante el loop (`npx vitest run <ruta>`); el gate completo lo corre el orquestador.

- [x] **T1 — Tipos** (`src/types/messagingBulk.ts`): `manualClientIds?: string[]` en
  `PreviewSegmentInput` (flat) y `CreateCampaignInput` (parallel a `segment`).
  Verificado por tsc + los tests de payload de T4/T5.

- [x] **T2 — `hasRecipients`** (`segmentCriteria.ts`): predicado que acepta segmento filtrado O
  lista manual no vacía. Test: solo-manual → true; vacío total → false; solo-segmento → true;
  `hasSegmentCriteria` intacto.
  Test: `src/__tests__/whatsapp/composer/segmentCriteria.hasRecipients.test.ts`.

- [x] **T3 — `ManualRecipientsPicker`** (nuevo, multi-select con chips): envuelve `CustomerPicker`;
  agregar (dedup), quitar, exclusión de ya-agregados, chip con nombre + teléfono, ✕ SVG 44px con
  `aria-label`, `aria-live` en lista + contador, estados vacío/con-lista, tokens.
  Extensión aditiva del `CustomerPicker`: 3er arg opcional en `onChange` + `excludeIds?`.
  Tests: `src/__tests__/components/ManualRecipientsPicker.test.tsx` +
  `src/__tests__/components/CustomerPicker.test.tsx` (nuevos casos: 3er arg, excludeIds).

- [x] **T4 — Integración en `CampaignComposer`**: estado de lista manual, picker después de
  `SegmentBuilder`, `manualClientIds.join(',')` en deps del preview, `manualClientIds` en
  preview/create, `hasRecipients` en el gate.
  Tests: nuevos CC-17/CC-18/CC-19 en `CampaignComposer.test.tsx`.

- [x] **T5 — Mapeo de errores** (`useBulkMessaging.ts`): `MANUAL_RECIPIENTS_NOT_FOUND`
  (`missingRecipientsError.missingClientIds`), `TOO_MANY_MANUAL_RECIPIENTS`, `VALIDATION_ERROR`.
  Tests: nuevos MBH-8 en `useBulkMessaging.test.ts`.

- [x] **T6 — `CreateCampaignConfirmModal`**: nota de destinatarios manuales (`manualCount`).
  Test: nuevo caso en el test del modal / composer.

## Fix wave (post-review)

- [x] **FIX 1 [HIGH]** — Contraste `.subtitle`/`.counter`: `--color-text-secondary` (#6c757d)
  sobre el fondo REAL de la página (`AdminLayout .content` = `--color-gray-50` #f8f9fa) daba
  4.45:1 y FALLABA el 4.5:1. Cambiado a `--color-gray-600` (#495057) → 7.76:1. Comentario de
  contraste del header del CSS corregido (afirmaba "sobre #ffffff → 4.84:1", falso).
  CSS puro (`ManualRecipientsPicker.module.css`).

- [x] **FIX 2 [MEDIA]** — `PreviewModal` ocultaba los manuales: gana `manualCount?: number`;
  con manuales muestra un aviso `role="note"` ("Sumaste N destinatario(s) manual(es)… el detalle
  de abajo muestra solo el segmento") y NO muestra el empty engañoso en el caso solo-manual.
  El composer le pasa `manualClientIds.length`. Deuda documentada: extender BE `/segment/recipients`.
  Tests: FIX-2 en `PreviewModal.test.tsx`.

- [x] **FIX 2 · gate segmento vacío [HIGH, fix wave 2]** — en solo-manual (segmento vacío + manuales)
  "Ver preview" abría el modal y `useSegmentRecipients(segment)` disparaba `/segment/recipients` con
  el segmento vacío → BE **400 UNFILTERED_SEGMENT** → error rojo en un preview VÁLIDO. Fix: la query
  se gatea con `enabled: open && hasSegmentCriteria(segment)` (predicado SOLO-segmento, NO
  `hasRecipients`) y todo el bloque de resultados del segmento se renderiza sólo con criterio de
  segmento. Tests: FIX-2 en `PreviewModal.test.tsx` (solo-manual no dispara la query / mixta tabla+nota
  / solo-segmento tabla / error real con criterio sigue en `role=alert`).

- [x] **FIX 3 [MEDIUM]** — Foco al quitar un chip (WCAG 2.4.3): mueve el foco al ✕ del chip
  siguiente / anterior (si era el último) / input de búsqueda (si quedó vacía), vía refs +
  `useLayoutEffect`. Tests: FIX 3 en `ManualRecipientsPicker.test.tsx`.

- [x] **FIX 4 [MEDIUM]** — Doble `aria-live`: se saca de la `<ul>` (queda lista con `aria-label`);
  el ÚNICO live region es el contador (`role="status"`), que cubre altas y bajas. Tests: FIX 4 en
  `ManualRecipientsPicker.test.tsx`. (Reemplaza el viejo caso que exigía `aria-live` en la lista.)

- [x] **FIX 5 [LOW]** — `220px` crudo en `.chipName` → `22ch` (truncado por caracteres, relativo);
  `translateY(4px)` del keyframe → `translateY(var(--space-1))`. CSS puro.

- [x] **FIX 6 [LOW]** — `.chipList` con `max-height: 12.5rem` (200px, cap de layout) + `overflow-y: auto`
  para que 50+ chips no empujen el campo Nombre / botón Crear. CSS puro.

- [x] **FIX 7 [LOW]** — `<section><h3>` → `<fieldset><legend>` (como el hermano `SegmentBuilder`):
  agrupa input+lista y elimina el salto de heading h1→h3 (1.3.1). Test FIX 7 en
  `ManualRecipientsPicker.test.tsx` (role=group nombrado por legend, sin heading).

- [x] **FIX 8 [LOW]** — Copy `CreateCampaignConfirmModal`: "incluye N" → "incluye HASTA N agregados
  manualmente" (el `total` ya es la unión dedup del BE y puede ser menor que `manualCount`). Test:
  CONF-1 en `CreateCampaignConfirmModal.test.tsx`.
