# Design: Recaptación — Asignación inline descubrible

**Change**: recapture-inline-assign
**Nature**: ADD inline assign + REMOVE recargar button + ADD multi-select hint.
**Date**: 2026-06-20

---

## 1. Por qué inline editable y no un botón por fila

ui-ux-pro-max (Forms / Inline Validation, Bulk Actions) y el patrón ya establecido
en el repo dicen: para asignación, **checkbox column + action bar contextual**, nunca
botones por fila. Eso se mantiene para el flujo en LOTE.

Para el flujo de a UNO, un `<select>` editable inline en la celda "Asignado" es el
affordance más directo: el control vive donde el dato se muestra, el cambio es de un
solo gesto (sin modal, sin drawer), y el estado actual (`value = assigneeId ?? ''`)
es visible de un vistazo. Es la traducción de "inline edit en celda de tabla" —
el control reemplaza el texto read-only solo para quien puede editar.

Decisión: el select se renderiza SOLO si `canAssign`. El agente sigue viendo el
texto read-only (`assigneeName ?? assigneeId ?? '—'`) — sin regresión y sin exponer
un control que el BE le rechazaría (gate de permisos intacto).

## 2. Dónde vive la lógica

| Pieza | Ubicación | Por qué |
|---|---|---|
| `handleAssignSingle(leadId, operatorId)` | `RecaptacionPage.tsx` | Espeja `handleBulkAssign`: try/catch + toast. La page es dueña del side-effect y del feedback. |
| `useAssignLead` | hook existente | REUSO. Invalida `['recaptacion']` + la key del lead → la lista se refresca sola (de ahí que el botón Recargar sobre). |
| `assigningId` (state) | `RecaptacionPage.tsx` | Id del lead en vuelo. Lo pasamos a la tabla para deshabilitar SOLO ese select. |
| Render del `<select>` inline | `RecaptacionTableView.tsx` | Componente presentacional: recibe `operators`/`canAssign`/`onAssign`/`assigningId`. |

`useAssignLead` no expone `isPending` por-fila (es una sola mutación). Por eso el
pending por fila se modela en la page con `assigningId`: lo seteo antes de
`mutateAsync` y lo limpio en `finally`. Mientras esté seteado, la tabla deshabilita
ese `<select>`.

## 3. Columna "Asignado" — render condicional

La columna hoy tiene `render: (r) => r.assigneeName ?? r.assigneeId ?? '—'`. El wrapper
de la tabla envuelve TODO `render` en un `<span onClick={onRowClick}>`. Para el select
eso es un problema: un click en el select abriría el drawer.

Solución: el `<select>` hace `onClick={e => e.stopPropagation()}` (y el `onChange`
no burbujea como click). Eso corta el evento antes de llegar al `<span>` wrapper —
más simple que sacar la columna del wrapping y no toca el `DataTable`.

La columna pasa de ser estática (definida a nivel módulo) a construirse dentro del
componente, porque ahora depende de props (`canAssign`, `operators`, `onAssign`,
`assigningId`). El resto de columnas siguen estáticas.

`value` del select = `lead.assigneeId ?? ''`. Opción `''` = "— Sin asignar —" → al
elegirla, `onAssign(leadId, null)`. Cualquier otra opción → `onAssign(leadId, value)`.

## 4. Quitar el botón Recargar

El `<Button variant="icon">` con `IconRefresh` se elimina del header. `IconRefresh`
queda huérfano → se elimina también. `refetch` sigue disponible del hook (no se usa
explícitamente tras asignar porque `useAssignLead` ya invalida la query, pero queda
accesible internamente sin warning porque la página lo desestructura; si TS marca
no-usado se renombra a `_refetch` o se quita de la desestructuración).

Decisión: quitar `refetch` de la desestructuración si queda sin uso (evita lint
no-unused). La invalidación de TanStack Query cubre el refresh.

## 5. Pista del multi-select

Banner sutil (no `role="alert"`, no invasivo) que aparece SOLO cuando
`canAssign && selectedIds.length === 0`. Texto:
"Marcá leads con los checkbox para asignarlos en lote, o asignalos uno por uno desde
la columna Asignado." Cuando hay selección, el banner desaparece y vuelve el
`BulkAssignToolbar` (comportamiento actual intacto). Estilo: fondo `--color-surface`
suave, borde `--color-border`, texto `--color-text-secondary`, ícono opcional. Tokens
solamente.

## 6. Accesibilidad

- `<select>` inline: `aria-label="Asignar lead {contactName}"` para distinguir filas.
- Pending: `disabled` en el select en vuelo (cursor + opacidad vía CSS, como el
  BulkAssign select).
- Feedback: toast existente (`role="status"` éxito / `role="alert"` error) —
  reuso de `showToast`.
- La pista es texto plano en un `<div role="note">` (informativo, no alerta).

## 7. Riesgos

- **stopPropagation insuficiente**: si el `DataTable` cambiara a capturar en fase
  capture, fallaría. Hoy es bubbling → cubierto. Test explícito lo bloquea.
- **assigneeName desincronizado tras asignar**: la invalidación refetchea la lista,
  así que el nombre se actualiza solo. No hace falta optimistic update.
- **operators vacío mientras carga RbacUsers**: el select muestra solo "— Sin
  asignar —". Aceptable (transitorio); igual que el bulk toolbar hoy.
