# Proposal: Manual recipients en el composer de Bulk WhatsApp (nivel 4 EPIC Bulk)

## Intent

El composer de campañas (`CampaignComposer`) hoy sólo arma destinatarios por **segmento**
(estados + rango de deuda). El BE ya está en prod y acepta, ADEMÁS del segmento, una **lista
manual de clientes** (`manualClientIds`) que se UNE (dedup) al segmento. Este change construye
el FE de esa capacidad: un **customer picker multi-select** que produce `manualClientIds`,
combinable con el segmento existente.

## Scope

### In Scope
- Componente nuevo `ManualRecipientsPicker` (multi-select con chips) que envuelve el
  `CustomerPicker` single-select existente.
- Integración en `CampaignComposer`: preview y create combinan segmento + lista manual.
- `hasRecipients(segment, manualClientIds)`: una lista manual no vacía cuenta como criterio
  aunque el segmento esté vacío.
- Tipos: `manualClientIds?: string[]` en `PreviewSegmentInput` (flat) y `CreateCampaignInput`
  (parallel a `segment`).
- Mapeo de 3 errores nuevos del BE: `MANUAL_RECIPIENTS_NOT_FOUND` (422, con `missingClientIds`),
  `TOO_MANY_MANUAL_RECIPIENTS` (422), `VALIDATION_ERROR` (400).
- El resumen de `CreateCampaignConfirmModal` refleja cuántos destinatarios son manuales.

### Out of Scope
- Cambiar la forma en que el BE une segmento + manuales (ya en prod, `count` = unión dedup).
- Reescribir el `CustomerPicker` (se extiende de forma ADITIVA, sin romper sus 5 usos).
- Deep-linking / persistencia de la lista manual entre sesiones.
- Tocar `CustomerPicker.module.css` (fuera de convención, hex crudos) — el componente nuevo
  usa tokens.

## Capabilities

### New Capabilities
- `bulk-manual-recipients`: lista manual de destinatarios combinable con el segmento en el
  composer de Bulk WhatsApp.

### Modified Capabilities
- None (extensión aditiva del `CustomerPicker` compartido y del `CampaignComposer`).

## Approach

| Tema | Estado | Resolución |
|------|--------|------------|
| Multi-select | Decidido | Envolver el `CustomerPicker` (single) en `ManualRecipientsPicker`: cada pick empuja a una lista (dedup por id) y remonta el picker (`key`) para seguir agregando. NO se reinventa un combobox. |
| Teléfono en el chip | Decidido | Extender `CustomerPicker.onChange` con un 3er arg OPCIONAL (`client?: CustomerSummary`). Los 5 usos existentes usan `(id, name) => …` e ignoran el 3er arg → cero break. El picker ya tiene el objeto cliente al hacer click (cero re-fetch). |
| Exclusión de ya-agregados | Decidido | `CustomerPicker` gana `excludeIds?: string[]` (aditivo, junto al `excludeId` single existente). El wrapper pasa los ids ya elegidos → no reaparecen en los resultados. |
| Gate de criterio | Decidido | `hasRecipients(segment, manualClientIds)` = `hasSegmentCriteria(segment) \|\| manualClientIds.length > 0`. Gatea preview y `canCreate`. |
| Payload | Decidido | Preview: `manualClientIds` FLAT junto a `statuses`. Create: `manualClientIds` top-level, PARALELO a `segment`. Se omite la key cuando la lista está vacía (cero regresión en los payloads existentes). |
| Errores | Decidido | `MANUAL_RECIPIENTS_NOT_FOUND` expone `missingClientIds` (como `missingVariablesError`); `TOO_MANY_MANUAL_RECIPIENTS`/`VALIDATION_ERROR` → mensajes claros en `serverError`. |
| Diseño | Innegociable | CSS Modules + tokens `var(--color-*)` (molde `CampaignComposer.module.css`, NO `CustomerPicker.module.css`); chips con motion 150-300ms ease-out + `prefers-reduced-motion`; `aria-live` en la lista y el contador; ✕ como SVG de 44px con `aria-label`. |

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/components/molecules/CustomerPicker/CustomerPicker.tsx` | Modified | +3er arg opcional en `onChange`, +`excludeIds?` |
| `src/components/molecules/ManualRecipientsPicker/*` | New | Componente multi-select + CSS Modules tokenizado |
| `src/pages/whatsapp/BulkMessagingPage/components/composer/CampaignComposer.tsx` | Modified | Estado + wiring de la lista manual en preview/create |
| `src/pages/whatsapp/BulkMessagingPage/components/composer/segmentCriteria.ts` | Modified | +`hasRecipients` |
| `src/pages/whatsapp/BulkMessagingPage/components/composer/CreateCampaignConfirmModal.tsx` | Modified | +nota de destinatarios manuales |
| `src/types/messagingBulk.ts` | Modified | +`manualClientIds?` en preview/create input |
| `src/hooks/useBulkMessaging.ts` | Modified | +mapeo de 3 errores nuevos |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper uno de los 5 usos del `CustomerPicker` | Low | Extensión 100% aditiva (3er arg opcional, prop nueva opcional); tests de los 5 usos deben seguir verdes |
| Romper los payloads de preview/create existentes | Low | La key `manualClientIds` se OMITE cuando la lista está vacía; los tests CC-5/CC-7 no cambian |
| Preview no re-dispara al agregar un manual | Med | Sumar `manualClientIds.join(',')` a las deps primitivas del `useEffect` de preview |
| a11y del chip (contraste/target/foco) | Med | Tokens + contraste calculado + target 44px + `focus-visible`; `aria-live` en lista y contador |

## Rollback Plan

Aditivo: borrar `ManualRecipientsPicker/`, revertir el wiring del composer, quitar `hasRecipients`,
revertir el 3er arg/`excludeIds` del `CustomerPicker`, sacar los 3 códigos de error nuevos y la
nota del modal. El BE ignora la ausencia de `manualClientIds` (campo opcional).

## Dependencies

- BE de manual recipients en prod (confirmado por el brief): preview y create aceptan
  `manualClientIds`; `GET /api/clients?search=` ya matchea teléfono.

## Success Criteria

- [ ] Se pueden agregar/quitar clientes a una lista manual (dedup, exclusión de ya-agregados).
- [ ] El chip muestra nombre + teléfono; la lista y el contador exponen `aria-live`.
- [ ] Preview y create combinan segmento + lista manual; solo-manual habilita crear.
- [ ] Los 3 errores nuevos se mapean a mensajes claros; el 422 de missing expone los ids.
- [ ] El modal de confirmación refleja los destinatarios manuales.
- [ ] Cero hex/px crudo en el CSS nuevo; cero regresión en los 5 usos del `CustomerPicker`.
