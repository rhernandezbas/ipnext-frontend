# Proposal: Recaptación — Asignación inline descubrible (Frontend)

## Intent
Hacer que asignar un lead de Recaptación sea OBVIO. Hoy las dos vías de asignación
son poco descubribles: el multi-select (toolbar que solo aparece tras seleccionar
filas) y el `<select>` "Operador" enterrado en el drawer de detalle. Un admin que
abre la página no tiene ninguna pista visible de cómo asignar.

Solución: un `<select>` editable inline en la columna "Asignado" de la tabla
(asigna un lead de a uno, directo desde la fila), sin perder el flujo en lote.

## Scope
- `src/pages/customers/RecaptacionPage/components/RecaptacionTableView.tsx` —
  columna "Asignado" pasa a ser un `<select>` inline cuando `canAssign`; read-only
  para el agente. Nuevos props: `canAssign`, `operators`, `onAssign`,
  `assigningId` (pending por fila).
- `src/pages/customers/RecaptacionPage/components/RecaptacionTableView.module.css` —
  estilo del select inline (tokens, sin hex).
- `src/pages/customers/RecaptacionPage.tsx` — wiring: handler de single-assign con
  `useAssignLead` + toast (espeja `handleBulkAssign`); pasa `canAssign`/`operators`/
  `onAssign`/`assigningId` a la tabla; elimina el botón "Recargar" (`IconRefresh`);
  agrega la pista del multi-select cuando no hay selección.
- `src/pages/customers/RecaptacionPage.module.css` — estilo de la pista (banner sutil).
- Tests Vitest:
  - `src/__tests__/customers/RecaptacionTableView.test.tsx` (amplía)
  - `src/__tests__/customers/RecaptacionPage.test.tsx` (amplía)

## Backend Contract (ya en prod — NO se toca)
- Single-assign: `PATCH /api/recapture/leads/:id/assign` body `{ operatorId: string|null }`,
  permiso `recapture.assign`. Hook existente: `useAssignLead({ leadId, operatorId })`.
- Operadores = RbacUsers: `useRbacUsers(enabled)`. La lista (`operators`) ya se arma
  en RecaptacionPage para el bulk; se reusa para el inline.

## Approach
- REUSAR `useAssignLead` (ya lo usa el drawer). No se crean hooks nuevos ni se toca
  la API.
- El single-assign vive en RecaptacionPage (handler con try/catch + toast),
  espejando `handleBulkAssign`. La tabla es presentacional: recibe callbacks.
- Pending por fila vía `assigningId` (id del lead que se está asignando) → se
  deshabilita SOLO ese `<select>`.
- El `<select>` inline hace `stopPropagation` para no disparar el row-click
  "Ver detalle".
- Multi-select intacto: el `BulkAssignToolbar` sigue apareciendo con selección. La
  pista solo aparece cuando `canAssign && selectedIds.length === 0`.
- TDD: tests primero (Vitest), después implementación.
