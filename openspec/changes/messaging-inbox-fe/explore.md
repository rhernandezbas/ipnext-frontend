# Exploration: messaging-inbox-fe (F1-FRONTEND del EPIC "Mensajería omnicanal WhatsApp en Prominense")

**Change**: messaging-inbox-fe
**Project**: splynx-frontend (ipnext-frontend)
**Phase**: explore
**Date**: 2026-07-12
**Status**: complete — listo para proposal, con 6 decisiones abiertas

---

## Contexto / Objetivo de F1-FE

El BE (`messaging-inbox`, F1-BE, ya en prod) expone `GET /api/messaging/conversations`,
`GET /api/messaging/conversations/:id`, `GET /api/messaging/conversations/:id/messages` y
`POST /api/messaging/conversations/:id/messages`, gateado por `messaging.read`/`messaging.send`.
F1-FE construye el apartado "Mensajes" (inbox 3 paneles: lista de conversaciones estilo WhatsApp,
thread + composer, panel de contexto del cliente) que consume ese contrato. Esta exploración es
READ-ONLY sobre código — no se tocó nada.

---

## Hallazgos por punto

### 1. Routing + sidebar + permisos

- **Router**: `src/App.tsx` — un único `<Routes>` plano dentro de `<ProtectedRoute>` →
  `<AdminLayout>` (`App.tsx:177-178`). Cada page es `lazy()` (`App.tsx:16-167`) montada dentro del
  único `<Suspense fallback={<Spinner fullPage />}>` (`App.tsx:172`). Cada ruta hoja se envuelve en
  `<RequirePermission permission="modulo.accion">` (ver ~90 ocurrencias, p.ej.
  `App.tsx:216,218,220-221,223-224,227-228` para tickets). El orden es semánticamente relevante:
  paths literales (`recaptacion`, `mis-clientes`, `acciones`) DEBEN declararse antes del catch-all
  `:id` (`App.tsx:196-209`, comentario explícito "MUST be before :id catch-all").
- **Ya existe una entrada `admin/messages`**: `App.tsx:213` — `<Route path="messages" element={<Navigate to="/admin/support/inbox" replace />} />`. Es un redirect de bookmark viejo, NO la ruta nueva de WhatsApp.
- **Permiso**: `RequirePermission` (`src/components/auth/RequirePermission.tsx:30-41`) — mientras
  carga `useMyPermissions()` renderiza `loadingFallback` (default `null`); si `isError` o
  `!can(permission)` renderiza `<NoPermissionPage>`; si OK, `children`. Existe también `<Can>`
  (`src/components/auth/Can.tsx:34-44`) para gating inline (no de página completa), soporta
  `permission` único o `permissions[]` con `mode: 'any'|'all'`.
- **`useMyPermissions()`** (`src/hooks/useMyPermissions.ts:28-62`) — `useQuery(['auth','me'])`,
  `staleTime: 5min`, `gcTime: 30min`, `refetchOnWindowFocus: false`. `can(permission | permission[], mode)`
  chequea membership en `data.permissions: string[]` (sentinel `'*'` = super_admin, siempre true). **NO
  hay catálogo estático de permisos válidos en el FE** — cualquier string `modulo.accion` que el `/me`
  del BE devuelva en el array ya es reconocido por `can()` sin tocar código. Confirmado el formato con
  punto: `MeResponse.permissions: string[]` en `src/types/myPermissions.ts:16-21` (comentario propio:
  `// Permission codes, e.g. "scheduling.delete"`).
- **Sidebar**: `src/components/organisms/Sidebar/Sidebar.tsx` — arrays estáticos `CRM_ITEMS` /
  `EMPRESA_ITEMS` / `SISTEMA_ITEMS` (`:41-244`) agrupados en `SECTIONS` (`:246-250`). Cada
  `NavParentItem` tiene `matchPaths` + `requiredPermission` opcional + `children: SubItem[]`
  (cada child puede tener su propio `requiredPermission`, si no lo tiene HEREDA el del padre —
  `canSeeChild`, `:429-434`). Un item contenedor es visible si AL MENOS UN hijo es visible
  (`canSee`, `:445-452`) — permite que un item "padre" sobreviva aunque el usuario solo tenga permiso
  de un hijo. Mientras `isLoading` se muestran TODOS los items (evita layout shift, `:430,450`).
- **HALLAZGO CRÍTICO — colisión de nombre en el sidebar**: el label **"Mensajes" YA EXISTE**
  (`Sidebar.tsx:92-101`), apunta a `matchPaths: ['/admin/support']`, gateado por `support.read`, con
  hijos `Bandeja de entrada` (`/admin/support/inbox`), `Envío masivo`, `Messengers`, `Noticias`. Es el
  sistema de **notificaciones/mensajería INTERNA** (ver punto 6). El nuevo inbox de WhatsApp necesita
  un label DISTINTO en el sidebar (sugerido: "Mensajería" o "WhatsApp"), no puede reusar "Mensajes" ni
  anidarse bajo `support.read` sin confundir semánticamente los dos sistemas.

### 2. Patrón de data-fetching

- **Api client**: `src/api/axios-client.ts` — instancia única `axios.create({ baseURL: '/api', withCredentials: true })` (`:3-9`). Interceptor de response dispara `window.dispatchEvent(new CustomEvent('auth:unauthorized'))` en 401 (`:11-22`) — no hay manejo especial de 422 a nivel cliente (relevante para el caso `canReply=false` → 422 al responder fuera de ventana 24h: el composer deberá capturar el error a nivel de mutation, no del cliente global).
- **Un archivo `*.api.ts` por dominio** (79 archivos en `src/api/`), funciones puras `axiosClient.get/post/...().then(r => r.data)`. Ejemplo mínimo: `src/api/ticketComments.api.ts:1-18` (`listTicketComments(ticketId)`, `addTicketComment(input)`).
- **Un archivo `use*.ts` por dominio** (src/hooks/, ~90 archivos) envolviendo TanStack Query v5.
  Molde MÁS CERCANO al inbox (lista + detalle + "agregar mensaje" con invalidación) es
  `src/hooks/useTicketComments.ts:7-24`: `useTicketComments(ticketId)` (`useQuery`, `enabled: !!ticketId`)
  + `useAddTicketComment(ticketId)` (`useMutation` → `invalidateQueries(['ticket-comments', ticketId])`).
  Para la LISTA paginada de conversaciones, el molde es `useClientList(query)`
  (`src/hooks/useCustomers.ts:46-50`): `useQuery({ queryKey: ['clients', query], queryFn: () => getClients(query) })` — el objeto `query` completo (incluye página/filtros) entra al `queryKey`, patrón a repetir para `useConversations(query)`.
- **Polling ya usado en 9 hooks** vía `refetchInterval` (grep confirmado): `usePppoe.ts`, `useGigared.ts`,
  `useRadiusAuthFailures.ts`, `useCustomers.ts`, `useScheduling.ts`, `useUispSyncStatus.ts`,
  `useIClassClosure.ts`, `useGestionRealIngest.ts`, `useGestionRealSync.ts`. El ejemplo más limpio:
  `src/hooks/useUispSyncStatus.ts:11-19` — `refetchInterval: 30_000, staleTime: 15_000, retry: false`.
  **No hay NINGÚN uso de WebSocket/socket.io/EventSource en todo `src/`** (grep sin resultados) y
  `package.json` no trae ninguna librería realtime — el único mecanismo de "tiempo real" disponible hoy
  en este codebase es polling con TanStack Query.

### 3. CSS Modules + tokens

- **Tokens**: `src/tokens/variables.css` — `--color-*` (semánticos: `--color-surface`,
  `--color-text-primary`, `--color-border`, `--color-danger`, `--color-success`, más `--badge-*-bg/fg`),
  `--space-1..12` (escala de 4px), `--font-size-*`, `--radius-*`, `--shadow-*`, `--transition-*`.
  Documentado en `variables.css:1-143`.
- **Convención ACTUAL (páginas redisenadas recientes)**: `src/pages/tickets/TicketDetailPage.module.css`
  usa exclusivamente tokens (`var(--space-5)`, `var(--color-danger)`, `var(--radius-md)`, etc. — `:7-44`,
  cero hex hardcodeado). Esta es la convención a seguir para el inbox nuevo.
- **TRAMPA a evitar**: hay CSS "legacy" (pre-tokens) en el mismo repo con hex hardcodeado —
  `src/pages/messages/MessagesPage.module.css` (`#2563eb`, `#e5e7eb`, `#6b7280`, etc. en TODO el
  archivo) y `src/pages/scheduling/SchedulingTaskDetailPage/components/SideCard.module.css` (`#E2E8F0`,
  `#2563EB`, `#64748B`, etc.). Ninguno de los dos debe copiarse tal cual como referencia visual — sirven
  solo como referencia de ESTRUCTURA (layout/grid), no de valores de color.
- **Componentes compartidos disponibles**: `DataTable` (`src/components/organisms/DataTable/`, tabular
  genérico — usado por `SupportInboxPage` para la bandeja interna, pero un mal fit para una lista de
  conversaciones estilo chat con avatar+preview+badge), `FilterBar`, `Pagination`, `Tabs`, `ConfirmModal`
  (vía `useConfirm()` de `ConfirmContext.tsx`), atoms `Button`, `Input`, `Spinner`, `StatusBadge`,
  `Breadcrumbs`, `KebabMenu`. Ninguno es un "componente de burbuja de chat" — hay que construir uno
  nuevo (`ChatBubble`/`MessageBubble` no existe en el repo).
- **Precedente de "client context card"**: `src/pages/scheduling/SchedulingTaskDetailPage/components/CustomerCard.tsx:44-100` — card con avatar (inicial), nombre, link "Ver perfil →" a `/admin/customers/view/:id`, filas de contacto (email/teléfono/ciudad) con estado loading vs "Sin dato". Es el patrón visual más cercano al panel de contexto de cliente pedido por F1 (mismo shape conceptual: "datos del cliente si matchea"), pero su CSS es legacy-hex (punto anterior) — replicar la ESTRUCTURA con tokens nuevos, no el archivo.

### 4. Layout de 3 paneles

- **No existe un layout multi-panel "app-like" (WhatsApp/Slack) en el repo hoy.**
- El más parecido es el propio `src/pages/messages/MessagesPage.tsx:101-166` — 2 paneles (`grid-template-columns: 1fr 2fr`, `MessagesPage.module.css:14-19`): lista con tabs (Inbox/Sent/Draft) a la izquierda, detalle/compose a la derecha. **Pero este archivo está HUÉRFANO**: no lo importa `App.tsx` (grep confirma que la única referencia fuera del archivo mismo es su propio test `src/__tests__/messages/MensajesPage.test.tsx`) — es código muerto de un diseño anterior del módulo interno, reemplazado por `SupportInboxPage` (tabla). Sirve solo de inspiración de grid, no de código a resucitar (data model distinto, CSS legacy).
- El patrón 2-columnas MÁS usado y VIGENTE es `TicketDetailPage.module.css:7-13` — `grid-template-columns: 8fr 4fr` con `gap: var(--space-5)`, main a la izquierda + sidebar sticky a la derecha (`TicketDetailPage.tsx:162-187`). Es un buen molde para "thread + panel de contexto" (2 de los 3 paneles), pero NINGUNA página del repo hace 3 columnas (lista + thread + contexto simultáneos).
- **`AdminLayout.module.css:22-29`** — el `.content` donde se monta cada `<Outlet>` tiene
  `padding: var(--space-6)` y `overflow-y: auto`, NO es full-bleed. Un inbox estilo WhatsApp
  típicamente quiere ocupar el 100% del alto disponible SIN el padding del layout (para que la lista y
  el thread scrolleen internamente, no la página entera). **Esto es una decisión de diseño abierta**:
  o el inbox vive dentro del padding estándar (más simple, pero se ve como "página" y no como "app"), o
  se necesita una variante de layout (negative margins para cancelar el padding + `height: calc(100vh - navbar - padding)` propio) — no hay precedente de esto último en el repo.

### 5. Estado en tiempo real

Cubierto en el punto 2: **cero infraestructura de websockets/SSE**; el único mecanismo disponible es
polling con `refetchInterval` de TanStack Query, ya usado en 9 hooks del repo. Para F1, la recomendación
es reusar ese patrón: `useConversations(query)` con `refetchInterval` corto (a decidir: 5-10s) para la
lista, y `useConversationMessages(id)` con su propio `refetchInterval` cuando el thread está abierto
(pausar/alargar cuando no hay foco de pestaña, replicando el criterio de `refetchOnWindowFocus: false`
usado en `useMyPermissions`, aunque para polling activo lo relevante es `refetchIntervalInBackground:
false`, que TanStack Query ya default-apaga).

### 6. ¿Existe hoy un apartado de mensajería/chat/notificaciones?

**Sí, y es importante para no colisionar** — confirma y extiende el hallazgo equivalente del BE
(`ipnext-backend/openspec/changes/messaging-inbox/explore.md`, sección "Riesgo — colisión de nombres"):

- Ruta `admin/messages` → redirect a `/admin/support/inbox` (`App.tsx:213`).
- Página `SupportInboxPage.tsx` (`src/pages/support/SupportInboxPage.tsx:22-52`) — tabla (`DataTable`)
  de mensajes internos, columnas `subject/fromName/channel/status/createdAt`, filtro por estado
  leído/no-leído. Consume `useMessages('inbox')` (`src/hooks/useMessages.ts:5-11`) →
  `src/api/messages.api.ts` (`BASE = '/messages'`, o sea pega a `/api/messages` del BE — el MISMO
  módulo `Message` interno que el BE ya documentó, `subject/body/fromId/toId/channel('internal'|'email'|'sms')/status`).
  Tipos en `src/types/message.ts` (`Message`, `MessageChannel`, `CreateMessagePayload`).
- Sidebar: el grupo "Mensajes" (`support.read`) agrupa `Bandeja de entrada` / `Envío masivo` /
  `Messengers` / `Noticias` — **este es el sistema de notificaciones/avisos internos**, no
  WhatsApp/Chatwoot.
- El archivo huérfano `src/pages/messages/MessagesPage.tsx` (punto 4) usa el MISMO hook/api
  (`useMessages`/`messages.api.ts`) — es una UI vieja para el mismo módulo interno, no algo relacionado
  con el inbox de WhatsApp.

**Conclusión**: el nuevo inbox de WhatsApp (F1) NO puede llamarse "Mensajes" en el sidebar (ya usado),
NO puede montarse bajo `/admin/support/*` ni `/admin/messages`, y NO debe tocar `useMessages.ts` /
`messages.api.ts` / `src/types/message.ts` (son del módulo interno, canal de soporte). Necesita rutas,
hooks, api client y tipos propios con un prefijo distinto — consistente con el BE que ya usa
`/api/messaging/*` (con "ing") en vez de `/api/messages/*`. En el FE conviene el mismo criterio:
carpeta `src/pages/messaging/` (no `messages/`), `src/hooks/useMessagingConversations.ts` /
`useConversationMessages.ts` (no `useMessages`), `src/api/messaging.api.ts` (no `messages.api.ts`),
`src/types/messaging.ts` (no `message.ts`), sidebar label a decidir (NO "Mensajes").

---

## Riesgos

1. **Colisión de naming FE** (sidebar label "Mensajes", rutas `/admin/messages`/`/admin/support`, hooks
   `useMessages`/api `messages.api.ts`/tipos `message.ts`) — ya usados por el sistema de notificaciones
   internas. Bloqueante de diseño (no de código): el proposal DEBE fijar nombres distintos antes de
   escribir specs, igual que ya resolvió el BE con `/api/messaging/*`.
2. **Sin precedente de layout 3-paneles full-height** — mayor esfuerzo de diseño/CSS que una página CRUD
   típica; decisión abierta sobre romper o no el padding de `AdminLayout.content`.
3. **Sin infraestructura realtime** — polling es la única opción disponible en F1 sin agregar una
   dependencia nueva (socket.io-client, SSE); hay que fijar intervalos razonables para no generar carga
   innecesaria contra el BE/Chatwoot.
4. **Dependencia de RBAC del BE** — `messaging.read`/`messaging.send` no requieren NINGÚN cambio de
   código FE para ser reconocidos (el `/me` es dinámico, ver punto 1), pero SÍ dependen de que el BE
   haya corrido la migración de seed y otorgado esos permisos al/a los rol(es) que van a operar el
   inbox (agentes de atención). Si el rol no tiene el grant, `RequirePermission` mostrará
   `NoPermissionPage` — a verificar operacionalmente antes de considerar F1-FE "listo", no es un bug de
   código.
5. **`DataTable` no es el widget correcto** para la lista de conversaciones (fit tabular, no de lista de
   chat) — hay que construir un componente de lista nuevo (`ConversationListItem` o similar), y también
   un componente de burbuja de mensaje (`MessageBubble` — inbound/outbound, no existe hoy).
6. **Componentes "legacy" con CSS hex hardcodeado** (`MessagesPage.module.css`, `SideCard.module.css`)
   pueden confundirse como "el patrón a seguir" si se buscan por nombre parecido ("mensajes",
   "cliente card") — hay que ser explícito en el proposal de que la referencia de VALORES es
   `TicketDetailPage.module.css` (tokens), no esos dos.

---

## Decisiones abiertas que el proposal debe cerrar

1. **Nombres definitivos** — sidebar label (candidatos: "Mensajería", "WhatsApp", "Inbox"), ruta base
   (candidato: `/admin/messaging/inbox`, consistente con `/api/messaging/*` del BE), nombres de
   hooks/api/tipos (`useMessagingConversations`/`messaging.api.ts`/`types/messaging.ts`) — para no
   colisionar con el módulo interno existente (punto 6).
2. **Dónde vive en el sidebar** — ¿grupo nuevo dentro de `CRM_ITEMS` (como Tickets/Clientes, con
   `requiredPermission: 'messaging.read'`) o singleton top-level junto a Monitoreo/Notificaciones
   (`Sidebar.tsx:520-547`, sin gate hoy)? Dado que es una sección completa (no un link único), el patrón
   `CRM_ITEMS` con `children` parece más consistente, aunque F1 solo tenga UNA vista (inbox) — a decidir
   si usar `to` directo (sin acordeón) o `children` de un solo item.
3. **Layout full-height vs dentro del padding estándar** — ¿el inbox rompe el `padding: var(--space-6)`
   de `AdminLayout.content` para sentirse "app" (WhatsApp-like), o se acepta vivir dentro del padding
   estándar como el resto de las páginas (más simple, consistente, pero menos inmersivo)? No hay
   precedente de la primera opción en el repo — sería la primera página en hacerlo.
4. **Polling: intervalos exactos** — ¿cuántos segundos para la lista de conversaciones (badge de
   "nuevo") vs. el thread abierto? ¿se pausa el polling del thread cuando la pestaña no tiene foco?
   Ningún hook existente resuelve exactamente este caso (los 9 hooks con `refetchInterval` son de
   estado/sync, no de mensajería activa) — hay que fijar un valor razonable en el design, no copiarlo de
   otro hook sin ajuste.
5. **Composer + ventana de 24h (`canReply`)** — el contrato del BE devuelve `canReply` en
   `ConversationDetailDto`; el composer debe deshabilitarse/grisearse cuando es `false`, y manejar el 422
   si igual se intenta enviar (fuera de ventana) — el interceptor global de `axios-client.ts` solo
   maneja 401, así que el error 422 se debe capturar en la mutation (`onError`) del hook de enviar
   mensaje, mostrando feedback inline (patrón similar al `saveError` de `TicketDetailPage.tsx:110-119`).
6. **Panel de contexto del cliente** — reusar la ESTRUCTURA de `CustomerCard.tsx` (avatar + nombre +
   link a perfil + filas de contacto) pero con los 3 estados que trae `clientContext` del BE
   (`matched`/`unknown`/`ambiguous`) en vez de solo `customerId ? ... : 'Sin cliente asignado'` — el
   componente actual solo maneja 2 estados (con/sin cliente), hay que extender el diseño para el caso
   `ambiguous` (¿mostrar una lista de candidatos? ¿un CTA de vincular manualmente?).

---

## Ready for Proposal

**Sí** — la exploración cubre routing/sidebar/permisos, data-fetching, tokens CSS, layout, realtime y
colisión de nombres, todo con file:line del código real. El hallazgo más importante para el proposal es
la **colisión de naming de "Mensajes"** (sidebar + rutas + hooks + tipos), que espeja y confirma —del
lado FE— el mismo riesgo que el BE ya identificó con el modelo `Message`. El segundo hallazgo relevante
es que **no hay precedente de layout 3-paneles ni de realtime** en este repo — F1-FE es la primera
página que necesita ambos, mayor esfuerzo de diseño que una página CRUD típica pero sin bloqueantes
técnicos (TanStack Query + CSS Grid + polling alcanzan).

**Next**: `sdd-propose`, con foco en cerrar las 6 decisiones abiertas de arriba — en particular #1
(naming, para evitar que el proposal se escriba sobre nombres que luego colisionan) y #3 (layout
full-height, que condiciona el approach de `AdminLayout` a tocar o no).
