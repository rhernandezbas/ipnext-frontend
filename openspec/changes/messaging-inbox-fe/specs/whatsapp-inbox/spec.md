# Spec — whatsapp-inbox (new capability, F1-FRONTEND)

RFC-2119. Cada scenario cubierto por al menos un test Vitest + Testing Library (sdd-verify).
Capability nueva — sin spec previa, se documenta completa (no delta).

**Enmienda (sdd-tasks, post-design)**: LIST-1/escenario-3 corregido — el DTO real del BE
(`ipnext-backend/src/application/dto/messaging.ts`) no expone `unreadCount`/`canReply`/
`lastMessagePreview` en el item de lista; ver requirement y escenario actualizados.

## Capability: sidebar, ruta y gating

### Requirement: SIDEBAR-1 — item "WhatsApp" gateado por messaging.read
El sidebar MUST mostrar un item top-level "WhatsApp" (singleton, `to` directo a
`/admin/whatsapp`) SOLO cuando el usuario tiene `messaging.read`. Mientras
`useMyPermissions()` está loading, el item MUST mostrarse igual (evita layout shift).

#### Scenario: usuario con permiso ve el item
- **GIVEN** un usuario cuyo `/me.permissions` incluye `messaging.read` (o `*`)
- **WHEN** se renderiza el Sidebar
- **THEN** el item "WhatsApp" está visible con href `/admin/whatsapp`

#### Scenario: usuario sin permiso no ve el item
- **GIVEN** un usuario cuyo `/me.permissions` NO incluye `messaging.read`
- **WHEN** se renderiza el Sidebar
- **THEN** el item "WhatsApp" NO se renderiza

#### Scenario: loading no oculta el item
- **GIVEN** `useMyPermissions()` en estado loading
- **WHEN** se renderiza el Sidebar
- **THEN** el item "WhatsApp" se muestra igual, sin asumir el permiso resuelto

### Requirement: ROUTE-1 — ruta protegida por RequirePermission
`/admin/whatsapp` MUST envolverse en `<RequirePermission permission="messaging.read">`
dentro de `<AdminLayout>`, agregada al final de `App.tsx` sin reordenar rutas existentes.

#### Scenario: acceso con permiso
- **GIVEN** un usuario con `messaging.read`
- **WHEN** navega a `/admin/whatsapp`
- **THEN** se renderiza `WhatsappInboxPage`

#### Scenario: acceso sin permiso
- **GIVEN** un usuario sin `messaging.read`
- **WHEN** navega a `/admin/whatsapp`
- **THEN** se renderiza `NoPermissionPage` y `WhatsappInboxPage` NO se monta (sin fetch)

## Capability: lista de conversaciones

### Requirement: LIST-1 — carga, orden y polling
`useWhatsappConversations` MUST traer conversaciones vía
`GET /api/messaging/conversations` ordenadas por `lastMessageAt` desc, con
`refetchInterval` ~15s. El item de lista MUST basarse en `ConversationListItemDto`
real del BE (`id, contactName, contactPhone, lastMessageAt, preview, status`) — NO
existen `unreadCount` ni `canReply` a nivel de lista (solo en el detalle,
fetch-on-open); el badge de la fila usa `status` (`open`/`resolved`/`pending`), no
ventana de 24h.

#### Scenario: loading muestra skeleton
- **GIVEN** el query en `isLoading`
- **WHEN** se renderiza `ConversationList`
- **THEN** se muestra un skeleton, no una lista vacía ni un error

#### Scenario: orden por último mensaje
- **GIVEN** una respuesta con conversaciones en cualquier orden
- **WHEN** se renderiza la lista
- **THEN** los items aparecen ordenados por `lastMessageAt` desc

#### Scenario: preview + contacto + estado
- **GIVEN** una conversación con `contactName`, `preview`, `status`
  (`ConversationListItemDto` real — sin `unreadCount` ni `canReply`, esos campos
  solo existen en el detalle)
- **WHEN** se renderiza el item
- **THEN** se muestran nombre de contacto, preview del último mensaje y un badge de
  `status` (`open`/`resolved`/`pending`); el badge de ventana 24h NO se renderiza acá
  — vive en `MessageThread`/`Composer` tras abrir el thread (ver THREAD-1/COMPOSER-1)

#### Scenario: empty state
- **GIVEN** una respuesta con 0 conversaciones
- **WHEN** se renderiza `ConversationList`
- **THEN** se muestra un mensaje "no hay conversaciones", no una lista vacía muda

#### Scenario: error state
- **GIVEN** el query en `isError`
- **WHEN** se renderiza `ConversationList`
- **THEN** se muestra un mensaje de error sin crashear la page

#### Scenario: polling refresca sin perder la selección
- **GIVEN** una conversación seleccionada en el thread
- **WHEN** el polling de la lista re-fetchea con datos actualizados
- **THEN** la conversación abierta sigue seleccionada

## Capability: thread de chat

### Requirement: THREAD-1 — historial cronológico con burbujas y polling propio
Al abrir una conversación, `useWhatsappConversationMessages(id)` MUST traer el historial
vía `GET /api/messaging/conversations/:id/messages`, cronológico ascendente, burbujas
inbound a la izquierda / outbound a la derecha; polling ~5s solo con la conversación
abierta (`enabled: !!id`), pausado sin foco de pestaña.

#### Scenario: fetch on open
- **GIVEN** el usuario hace click en una conversación de la lista
- **WHEN** se monta `MessageThread`
- **THEN** se dispara el fetch de mensajes de esa conversación (`enabled: !!id`)

#### Scenario: loading
- **GIVEN** el query de mensajes en `isLoading`
- **WHEN** se renderiza `MessageThread`
- **THEN** se muestra un estado de carga, no un thread vacío

#### Scenario: burbujas por dirección
- **GIVEN** mensajes con `direction: 'inbound'|'outbound'`
- **WHEN** se renderizan las burbujas
- **THEN** inbound se alinea a la izquierda y outbound a la derecha

#### Scenario: empty thread
- **GIVEN** una conversación sin mensajes
- **WHEN** se renderiza `MessageThread`
- **THEN** se muestra un empty state ("sin mensajes aún"), no un error

#### Scenario: polling pausado sin foco de pestaña
- **GIVEN** un thread abierto y `document.visibilityState !== 'visible'`
- **WHEN** transcurre el intervalo de polling
- **THEN** NO se dispara un nuevo fetch hasta recuperar el foco

## Capability: composer (responder)

### Requirement: COMPOSER-1 — envío gateado por permiso y ventana 24h
El composer MUST ocultarse/deshabilitarse sin `messaging.send` (vía `<Can>`), y
deshabilitarse con aviso "ventana de 24h expirada" cuando `canReply=false`; el envío
exitoso MUST reflejarse en el thread; un 422 del POST MUST manejarse en `onError` de la
mutation sin crash (el interceptor global solo cubre 401).

#### Scenario: envío exitoso
- **GIVEN** un usuario con `messaging.send` y `canReply=true`
- **WHEN** envía un mensaje desde el composer
- **THEN** el mensaje aparece en el thread y el input se limpia

#### Scenario: canReply=false deshabilita con aviso
- **GIVEN** una conversación con `canReply=false`
- **WHEN** se renderiza el composer
- **THEN** input y botón están deshabilitados y se muestra "ventana de 24h expirada"

#### Scenario: 422 fuera de ventana no rompe la UI
- **GIVEN** un envío que el BE rechaza con 422 (ventana expiró entre el render y el
  submit)
- **WHEN** la mutation resuelve en error
- **THEN** se muestra un mensaje de error claro (sin throw sin capturar) y el composer
  sigue operable

#### Scenario: sin permiso de envío
- **GIVEN** un usuario sin `messaging.send`
- **WHEN** se renderiza `MessageThread`
- **THEN** el composer no se muestra, o se muestra deshabilitado sin acción posible

## Capability: panel de contexto del cliente

### Requirement: CONTEXT-1 — 3 estados de clientContext
`ClientContextPanel` MUST renderizar 3 estados excluyentes según `clientContext.status`:
`matched` (ficha + link al cliente), `unknown` (contacto sin cliente asociado) y
`ambiguous` (lista de candidatos); la ausencia de `clientContext` NO MUST romper el
render del thread.

#### Scenario: matched
- **GIVEN** `clientContext.status === 'matched'` con `customerId` y nombre
- **WHEN** se renderiza el panel
- **THEN** se muestra ficha básica + link a `/admin/customers/view/:id`

#### Scenario: unknown
- **GIVEN** `clientContext.status === 'unknown'`
- **WHEN** se renderiza el panel
- **THEN** se muestra "contacto desconocido" sin datos de cliente

#### Scenario: ambiguous
- **GIVEN** `clientContext.status === 'ambiguous'` con `candidates: [...]`
- **WHEN** se renderiza el panel
- **THEN** se muestra la lista de candidatos (nombre + link), sin elegir uno solo
  automáticamente

#### Scenario: contexto ausente no rompe el thread
- **GIVEN** una respuesta de detalle sin `clientContext`
- **WHEN** se renderiza `WhatsappInboxPage`
- **THEN** lista y thread funcionan igual; el panel muestra un estado neutro

## Capability: accesibilidad

### Requirement: A11Y-1 — contraste, foco y touch targets
Los 3 paneles MUST cumplir contraste AA vía tokens `var(--color-*)` (cero hex
hardcodeado), foco visible en elementos navegables por teclado, targets táctiles ≥44px
en composer/items de lista, y roles/aria apropiados (`aria-live` en el thread para
mensajes nuevos, `aria-label` en items de conversación).

#### Scenario: navegación por teclado en la lista
- **GIVEN** el foco en `ConversationList`
- **WHEN** el usuario navega con Tab/flechas
- **THEN** cada item es alcanzable y muestra foco visible

#### Scenario: aria-live en mensajes nuevos
- **GIVEN** un thread abierto que recibe un mensaje nuevo por polling
- **WHEN** se agrega la burbuja
- **THEN** el contenedor expone `aria-live="polite"` (o equivalente) para lectores de
  pantalla

#### Scenario: touch target del composer
- **GIVEN** el composer en viewport táctil
- **WHEN** se mide el botón de enviar
- **THEN** su área clickeable es ≥44x44px
