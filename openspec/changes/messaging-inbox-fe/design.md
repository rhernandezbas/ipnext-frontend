# Design — messaging-inbox-fe (F1-FRONTEND, inbox WhatsApp)

Anclas verificadas contra código real: `AdminLayout.tsx:100-121` + `AdminLayout.module.css:1-33`,
`Navbar.module.css:1-17` (fixed, sin flex-space), `TicketDetailPage.module.css` (tokens),
`useTicketComments.ts`/`useUispSyncStatus.ts` (molde hooks), `Sidebar.tsx:41-244` (patrón `to` directo,
`Informes:224-228`), `App.tsx:382-396` (bloque "Singletons"), `Can.tsx`/`RequirePermission.tsx`. DTOs
BE verificados en código real (no el boceto): `ipnext-backend/src/application/dto/messaging.ts` +
`messaging.routes.ts` (no el design.md del BE, que es solo boceto — el código ya está en prod).

## 1. Componentes (container-presentational, patrón `TicketDetailPage`/`SchedulingTaskDetailPage`)

| Archivo | Rol |
|---|---|
| `src/pages/whatsapp/WhatsappInboxPage.tsx`+css | Container: `selectedId`, `query`, orquesta los 4 hooks, monta el grid 3-paneles |
| `.../WhatsappInboxPage/components/ConversationList.tsx`+css | Lista: loading/empty/error, click→`onSelect(id)` |
| `.../components/ConversationListItem.tsx`+css | Fila: avatar+nombre+preview+badge `status` |
| `.../components/MessageThread.tsx`+css | Header + scroll de burbujas + `aria-live="polite"` |
| `.../components/MessageBubble.tsx`+css | Burbuja inbound/outbound |
| `.../components/Composer.tsx`+css | Textarea+botón, `<Can permission="messaging.send">` + `canReply` |
| `.../components/ClientContextPanel.tsx`+css | 3 estados + neutro (contexto ausente — CONTEXT-1) |

## 2. Layout 3-paneles full-height — opt-out LOCAL (cero cambios a `AdminLayout`)

`.content` (`AdminLayout.module.css:22-29`) tiene `padding:var(--space-6)` + `overflow-y:auto`, flex
item (`flex:1`) de `.main`; `Navbar` es `fixed` (sin espacio en el flex). Mecanismo: **negative margin =
padding** (cancela el padding) + `height:100%` (no `100vh` — evita el cálculo frágil de navbar-height;
resuelve contra la altura que el flex ya le da a `.content`, cualquiera sea):

```css
.page {
  margin: calc(var(--space-6) * -1);
  height: 100%;
  overflow: hidden; /* cada panel scrollea internamente, .content nunca más */
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr) 320px;
}
@media (max-width: 1200px) { .page { grid-template-columns: 300px minmax(0,1fr); } .context { display: none; } }
@media (max-width: 860px) { .page { grid-template-columns: 1fr; } .list { display: none; } } /* thread-only en mobile cuando hay selección — toggle simple con selectedId */
```

Sin breadcrumb (ruta no está en `ROUTE_CRUMBS`), `.content` monta el `<Outlet/>` directo → `.page` es hijo
único, cero interferencia con las otras 94 rutas.

## 3. Contrato DTO (BE real, `dto/messaging.ts` — gap cerrado: el spec asumía campos que NO existen)

**Drift vs spec.md**: `ConversationListItemDto` NO tiene `unreadCount` ni `canReply` (solo existen en
`ConversationDetailDto`, fetch-on-open); el campo es `preview`, no `lastMessagePreview` (rename
deliberado BE, `messaging.ts:11-12`). **Decisión**: el badge "ventana 24h" de LIST-1/escenario-3 NO es
renderizable en la lista (dato solo disponible tras el fetch de detalle) — `ConversationListItem` usa
`status` (Chatwoot `open/resolved/pending`) como badge; el badge de ventana 24h vive en
`MessageThread`/`Composer`. `unreadCount` sale de alcance (sin tracking leído/no-leído en el mirror).
**Gap para tasks**: enmendar `spec.md` LIST-1/escenario-3.

```ts
// src/types/whatsapp.ts — espejo campo a campo de application/dto/messaging.ts
export interface WhatsappConversationListItem {
  id: string; contactName: string | null; contactPhone: string | null;
  lastMessageAt: string | null; preview: string | null; status: string;
}
export interface WhatsappClientContext {
  status: 'matched' | 'unknown' | 'ambiguous';
  clients: Array<{ id: string; name: string; status: string }>;
}
export interface WhatsappConversationDetail extends WhatsappConversationListItem {
  canReply: boolean; clientContext: WhatsappClientContext;
}
export interface WhatsappMessage {
  id: string; direction: 'inbound' | 'outbound'; content: string;
  senderName: string | null; sentAt: string;
}
export interface WhatsappPaginatedQuery { page?: number; limit?: number; }
export interface WhatsappPaginatedResult<T> { data: T[]; total: number; page: number; limit: number; }
```

Errores reales (`errorHandler.ts:152-154`, body `{error,code}`): 404 `CONVERSATION_NOT_FOUND`, 422
`MESSAGING_WINDOW_EXPIRED` (SendMessage), 503 `CHATWOOT_UNAVAILABLE`. Interceptor global solo cubre 401
(`axios-client.ts:11-22`) — 422/503 se capturan en `onError` de `useSendWhatsappMessage`.

## 4. API + hooks (un archivo por dominio, molde `useTicketComments.ts`/`useUispSyncStatus.ts`)

`src/api/whatsapp.api.ts` (`BASE='/messaging'`): `listWhatsappConversations(query)` → GET
`/conversations` (paginado real); `getWhatsappConversation(id)` → GET `/conversations/:id`;
`listWhatsappMessages(id)` → GET `/conversations/:id/messages` (unwrap `{data}`); `sendWhatsappMessage(id,
content)` → POST `/conversations/:id/messages`.

`src/hooks/useWhatsapp.ts` (los 4 hooks, un archivo — convención del repo, no 4 archivos):

| Hook | queryKey | refetchInterval | notas |
|---|---|---|---|
| `useWhatsappConversations(query)` | `['whatsapp','conversations',query]` | `visible?15000:false` | `placeholderData:keepPreviousData` (sin flicker) |
| `useWhatsappConversation(id)` | `['whatsapp','conversation',id]` | `visible?5000:false` | `enabled:!!id`; refresca `canReply`+`clientContext` |
| `useWhatsappMessages(id)` | `['whatsapp','messages',id]` | `visible?5000:false` | `enabled:!!id` |
| `useSendWhatsappMessage(id)` | mutation | — | ver §5 |

`visible` = `src/hooks/useDocumentVisible.ts` (NUEVO, genérico, `visibilitychange`); gatea el intervalo
(`refetchIntervalInBackground` solo controla si sigue en background, no si el intervalo corre — la
pausa real es poner el interval en `false`). **Selección no se pierde** (LIST-1): `selectedId` vive en
`WhatsappInboxPage` (state local), no en la query — el refetch reemplaza el array pero nunca la toca.

## 5. Invalidación tras enviar — optimistic append (thread) + invalidate (lista)

`onSuccess(message)`: `setQueryData(['whatsapp','messages',id], old => [...old, message])` (instantáneo —
la respuesta 201 YA es el `ChatMessageDto` persistido, no hay reconciliación porque el próximo poll
reemplaza el array completo por la versión del server) + `invalidateQueries(['whatsapp','conversations'])`
(barato, evita recomputar `preview`/`lastMessageAt` en el cliente). NO se invalida `conversation(id)` —
`canReply` no cambia al enviar, el próximo poll (≤5s) lo confirma igual.

## 6. Permisos

| Elemento | Gate | Ausente |
|---|---|---|
| Sidebar "WhatsApp" (`Sidebar.tsx`, patrón `Informes:224-228`, agregado a `CRM_ITEMS`) | `requiredPermission:'messaging.read'` | oculto (loading→visible) |
| Ruta `/admin/whatsapp` (`App.tsx`, bloque Singletons `:382-396`) | `<RequirePermission permission="messaging.read">` | `NoPermissionPage` |
| Composer | `<Can permission="messaging.send">` | no se renderiza |
| Composer habilitado | `canReply===true` | disabled + aviso 24h |

## 7. Motion (Emil + Apple — ninguna acción de alta frecuencia se anima; `prefers-reduced-motion` global en `.page`)

Tokens locales en `.page` (no tocar `tokens/variables.css`): `--wa-ease-out: cubic-bezier(0.23,1,0.32,1)`, `--wa-ease-in-out: cubic-bezier(0.77,0,0.175,1)`.

| Interacción | Propiedad | Easing | Duración | Nota |
|---|---|---|---|---|
| Burbuja nueva (poll) | `translateY(8px)→0` + `opacity` | `--wa-ease-out` | 220ms | stagger 40ms si llegan ≥2 juntas |
| Selección de conversación (item) | `background-color` | `ease` | 120ms | alta frecuencia — sin transform |
| Cambio de thread/contexto (swap) | `opacity` crossfade | `--wa-ease-out` | 160ms | evita "jump"; nunca doble-expuesto (blur 2px opcional) |
| Hover fila lista | `background-color` | `ease` | 150ms | `@media (hover:hover) and (pointer:fine)` |
| Botón enviar `:active` | `scale(0.97)` | ease-out | 150ms | feedback de press, Apple §1 |
| Skeleton shimmer (lista/thread/contexto) | `background-position` | `linear` | 1.5s infinite | porta `DataTable.module.css:81-92`, local |
| Composer pasa a disabled (24h) | `opacity` del aviso | `--wa-ease-out` | 200ms | entra, nunca `ease-in` |

`@media (prefers-reduced-motion:reduce)` en `.page`: mata `translateY`/`scale`, deja `opacity` (fades
cortos), shimmer → fondo estático sin animación (Apple §14 — nada de "moving background" en loading).

## 8. Testing (Vitest+RTL, Strict TDD)

| Capa | Qué | Molde |
|---|---|---|
| Hooks | 4 hooks + `useDocumentVisible`, mock `@/api/whatsapp.api` | `useActions.test.ts` (`vi.mock`) |
| Componentes | skeleton/empty/error/estados por panel, aria-live, 44px touch | RTL + jest-dom |
| Page | routing/permiso (`RequirePermission`), sidebar visibility | `AccionesRoute.permission.test.tsx` |
| Motion | gate `review-animations` pre-merge (proposal risk) | — |

## Archivos (nuevos)

`src/pages/whatsapp/WhatsappInboxPage.tsx`+css, `.../WhatsappInboxPage/components/{ConversationList,
ConversationListItem,MessageThread,MessageBubble,Composer,ClientContextPanel}.tsx`+css,
`src/api/whatsapp.api.ts`, `src/hooks/useWhatsapp.ts`, `src/hooks/useDocumentVisible.ts`,
`src/types/whatsapp.ts`. **Tocados**: `src/App.tsx` (+1 lazy import, +1 `<Route>` en Singletons),
`src/components/organisms/Sidebar/Sidebar.tsx` (+1 item `CRM_ITEMS`).

## Migración / Rollout

Sin migración (FE puro, aditivo). Depende del grant operacional `messaging.read`/`send` (BE, ya
documentado como riesgo del proposal) — sin grant, `NoPermissionPage` es el comportamiento correcto.

## Open Questions

- [ ] Enmendar `spec.md` LIST-1/escenario-3: quitar `unreadCount`/`canReply` del item de lista (no
  existen en `ConversationListItemDto` real); badge de fila = `status`, no ventana 24h.
- [ ] Anchos (340/320px) y breakpoints (1200/860px) son default razonable sin precedente en el repo —
  ajustable en apply.
- [ ] Confirmar si el mobile "thread-only" (§2) alcanza para F1 o si hace falta botón "volver a la lista"
  explícito (hoy implícito por `selectedId=null`).
