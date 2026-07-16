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

### Part A.2 — Borrado total (decisión del usuario, 2026-07-16, segundo commit)
En el primer commit, `SupportInboxPage.tsx` se había preservado en disco (desconectada de la app)
porque usa `useMessages()` → `src/api/messages.api.ts`, que pega contra un backend real vía
`axiosClient` (`GET/POST/PATCH/DELETE /messages`) — el mandato original exigía parar y reportar.
Reportado, el usuario confirmó: **"se borra Mensajes TODO"**. El segundo commit completa la
limpieza. Verificación previa: los ÚNICOS consumidores de `useMessages`/`messages.api.ts` eran las
dos páginas huérfanas (`SupportInboxPage` y `MessagesPage`, esta última ya sin ruta ANTES de este
change) + una mención en comentario en `src/types/whatsapp.ts` (actualizada).

Borrado en el segundo commit:
- `src/pages/support/SupportInboxPage.tsx` + `.module.css` + test → carpetas `src/pages/support/`
  y `src/__tests__/support/` eliminadas (quedaron vacías).
- `src/pages/messages/MessagesPage.tsx` + `.module.css` + `src/__tests__/messages/MensajesPage.test.tsx`
  → carpetas `src/pages/messages/` y `src/__tests__/messages/` eliminadas.
- Hooks: `src/hooks/useMessages.ts`, `useMessengers.ts`, `useNews.ts`.
- API clients: `src/api/messages.api.ts`, `messenger.api.ts`, `news.api.ts`.
- Types huérfanos: `src/types/message.ts`, `messenger.ts`, `news.ts` (verificado: sin consumidores
  fuera del lote borrado).
- `docs/business/features.md`: la sección "Mensajes/Soporte" reemplazada por "Comunicaciones".

**Deuda BE registrada**: el endpoint `/messages` del backend (`ipnext-backend`) queda como dead code
sin ningún consumidor FE — a limpiar en un change BE aparte.

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
No hay contrato de backend nuevo — esto es un cambio 100% FE. El contrato `/messages` del BE queda
huérfano tras el borrado total (ningún consumidor FE) — dead code a remover en un change BE aparte.
