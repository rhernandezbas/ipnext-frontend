# Tasks: recapture-inline-assign

## 1. Tests primero (TDD — red)
- [x] 1.1 RecaptacionTableView: admin (`canAssign`) ve `<select>` inline en columna Asignado con `aria-label` por lead; value refleja `assigneeId`.
- [x] 1.2 RecaptacionTableView: cambiar el select llama `onAssign(leadId, operatorId)`; "— Sin asignar —" → `onAssign(leadId, null)`.
- [x] 1.3 RecaptacionTableView: agente (sin `canAssign`) ve texto read-only, sin `<select>`.
- [x] 1.4 RecaptacionTableView: click/cambio en el select NO dispara `onRowClick` (stopPropagation).
- [x] 1.5 RecaptacionTableView: `assigningId` deshabilita SOLO el select de esa fila.
- [x] 1.6 RecaptacionPage: cambiar el select inline dispara `useAssignLead` con (leadId, operatorId) y toastea éxito.
- [x] 1.7 RecaptacionPage: falla → toast de error (`role="alert"`).
- [x] 1.8 RecaptacionPage: el botón "Recargar" ya NO existe.
- [x] 1.9 RecaptacionPage: la pista aparece sin selección (admin) y desaparece con selección; el agente no la ve.

## 2. Implementación (green)
- [x] 2.1 RecaptacionTableView: nuevos props `canAssign`, `operators`, `onAssign`, `assigningId`; construir columna Asignado dentro del componente con render condicional (select vs read-only) + stopPropagation.
- [x] 2.2 RecaptacionTableView.module.css: estilo del select inline (tokens).
- [x] 2.3 RecaptacionPage: `handleAssignSingle` (try/catch + toast) + state `assigningId`; usar `useAssignLead`.
- [x] 2.4 RecaptacionPage: pasar `canAssign`/`operators`/`onAssign`/`assigningId` a la tabla.
- [x] 2.5 RecaptacionPage: eliminar botón Recargar + `IconRefresh` + `refetch` si queda huérfano.
- [x] 2.6 RecaptacionPage: pista del multi-select (`role="note"`) condicionada a `canAssign && selectedIds.length === 0`.
- [x] 2.7 RecaptacionPage.module.css: estilo de la pista.

## 3. Verde + typecheck
- [x] 3.1 `npm run typecheck` limpio.
- [x] 3.2 `npx vitest run` para RecaptacionTableView + RecaptacionPage (+ LeadDetailDrawer no roto) verde.
