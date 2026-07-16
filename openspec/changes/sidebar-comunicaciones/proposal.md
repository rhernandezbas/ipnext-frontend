# Change: sidebar-comunicaciones

## Intent
Eliminar el ítem "Mensajes" (feature Support legacy, mock/sin uso real en producción) del sidebar
y renombrar el grupo "WhatsApp" a "Comunicaciones" — nombre decidido por el usuario el 2026-07-16 —
ahora que ya no colisiona con el "Mensajes" retirado.

## Scope

### Part A — Eliminar "Mensajes" / Support legacy
- Sidebar (`Sidebar.tsx`): removido el item `label:'Mensajes'` de `CRM_ITEMS` (matchPaths
  `/admin/support`, permiso `support.read`, 4 children: inbox/mass-send/messengers/news).
- Rutas (`App.tsx`): removido el bloque `<Route path="support">` completo (4 sub-rutas), el redirect
  legacy `<Route path="messages" element={<Navigate to="/admin/support/inbox" />} />` y los lazy
  imports de `SupportInboxPage`, `MassSendPage`, `MessengersPage`, `NewsPage`.
- Archivos borrados (verificados sin lógica real — solo UI estática o datos mock hardcodeados en el
  `api/*.ts` correspondiente, no HTTP real):
  - `src/pages/support/MassSendPage.tsx` (+ `.module.css`) — formulario estático, sin `onClick` en el submit.
  - `src/pages/support/MessengersPage.tsx` — `useMessengers()` → `getMessengers()` retorna un array
    hardcodeado (no HTTP).
  - `src/pages/support/NewsPage.tsx` — `useNews()` → `getNews()` retorna un array hardcodeado (no HTTP).
  - Tests correspondientes en `src/__tests__/support/`.
- Referencia rota corregida: el botón "Enviar mensaje" del dropdown de Acciones en
  `CustomerDetailPage.tsx` navegaba a `/admin/support/inbox` (ruta eliminada) — redirigido a
  `/admin/whatsapp` (Comunicaciones).

### EXCEPCIÓN — `SupportInboxPage.tsx` NO se borró (pausa deliberada)
A diferencia de sus 3 hermanas, `SupportInboxPage.tsx` usa `useMessages()` →
`src/api/messages.api.ts`, que SÍ pega contra un backend real vía `axiosClient`
(`GET/POST/PATCH/DELETE /messages`), no datos mock. Dado el mandato explícito de la tarea
("si alguna tuviera lógica real conectada a API, PARÁ y reportalo en vez de borrar"), el archivo
y su test (`src/__tests__/support/SupportInboxPage.test.tsx`) se dejaron intactos en disco, pero
totalmente desconectados de la app: sin ruta, sin lazy import, sin entrada de sidebar — el feature
es inalcanzable desde la UI igual que el resto de Support legacy. Queda pendiente de decisión humana
si se borra en un follow-up o se reutiliza. Ver detalle en `specs/support-legacy-removal.md`.

Nota adicional: existe un segundo consumidor huérfano de `useMessages`/`messages.api.ts`:
`src/pages/messages/MessagesPage.tsx` (+ test `src/__tests__/messages/MensajesPage.test.tsx`), que
YA estaba fuera de cualquier ruta en `App.tsx` antes de este change (no se tocó — fuera de scope).

### Part B — Renombrar "WhatsApp" → "Comunicaciones"
- `Sidebar.tsx`: `label:'WhatsApp'` → `label:'Comunicaciones'` en el grupo de `CRM_ITEMS`. Solo el
  label visible cambia — `matchPaths` (`/admin/whatsapp`), `requiredPermission` (`messaging.read`) y
  las rutas/labels de los children (Bandeja de entrada, Configuración, Envío masivo, Templates)
  quedan intactos.
- Comentario del bloque actualizado: ya no advierte sobre colisión con "Mensajes" (retirado);
  documenta el rename.

## Approach
TDD: se actualizaron primero los tests que expresan el estado final (ausencia de "Mensajes", label
"Comunicaciones", rutas Support fuera del árbol de routing) y se confirmó que compilan/pasan tras el
cambio de implementación. Sin cambios de CSS (no aplica).

## Backend contract
No hay contrato de backend nuevo — esto es un cambio 100% de navegación/routing en el FE. La
excepción documentada (`SupportInboxPage`) sí depende de un contrato existente `/messages`
(`src/api/messages.api.ts`), no modificado por este change.
