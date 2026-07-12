# Archive Report — messaging-inbox-fe (F1-FRONTEND)

**Fecha de archivo:** 2026-07-12
**Estado:** ✅ COMPLETO Y EN PRODUCCIÓN
**Repo:** ipnext-frontend (FE, consume BE `messaging-inbox`)

## Qué se entregó

Inbox de WhatsApp (`/admin/whatsapp`) — capability nueva `whatsapp-inbox`, sin solape con el
módulo interno `support`/`Message` (namespace propio `whatsapp.*`):

- **3 paneles**: `ConversationList` (orden `lastMessageAt` desc, polling ~15s), `MessageThread`
  (historial cronológico, burbujas inbound/outbound, polling ~5s pausado sin foco de pestaña,
  `aria-live` para mensajes nuevos) y `ClientContextPanel` (3 estados: `matched`/`unknown`/
  `ambiguous`).
- **Composer** gateado por `messaging.send` (`<Can>`) + `canReply` (ventana 24h): deshabilitado
  con aviso cuando expira, `onError` dedicado para el 422 del BE sin crashear la UI.
- **Sidebar + ruta**: item top-level "WhatsApp" gateado por `messaging.read` (visible en loading
  para evitar layout shift), ruta `/admin/whatsapp` con `RequirePermission`, agregada al final de
  `App.tsx` sin reordenar las 94 rutas existentes.
- **Types/API/hooks**: `src/types/whatsapp.ts` (DTOs campo a campo contra el BE real),
  `whatsapp.api.ts` (4 funciones sobre `/api/messaging/*`), `useWhatsapp*` (4 hooks con
  polling/gating).
- **Motion**: slide-up + fade en mensajes nuevos, stagger si llegan ≥2 juntos, crossfade al
  cambiar de conversación, `prefers-reduced-motion` respetado (mata translate/scale, deja
  opacity).
- **Enmienda post-diseño** (ya reflejada en `specs/whatsapp-inbox/spec.md`, LIST-1): el badge de
  fila en la lista usa `status` (`open`/`resolved`/`pending`), NO `unreadCount`/`canReply`/ventana
  24h — esos campos no existen en `ConversationListItemDto` del BE real, solo en el detalle.

## Verificación

- Sin `verify-report.md` formal en este change (no se corrió `sdd-verify` como documento
  separado). Verificación real: **BE + FE probados end-to-end contra WhatsApp real** (Chatwoot
  `.37`) por el usuario tras el deploy — conversación entrante, apertura de thread, envío de
  respuesta dentro de ventana 24h y contexto de cliente confirmados funcionando en producción.
- **Gotcha para quien retome este trail**: `tasks.md` quedó con checkboxes desactualizados
  respecto del código shipeado — FB1 y FB4 están marcados `[x]`, pero FB2 (presentacionales),
  FB3 (paneles) y FB5 (wiring Sidebar/App.tsx) figuran `[ ]` pese a que el commit `0b48e4d7`
  incluye TODOS los componentes (`ConversationList`, `MessageThread`, `Composer`,
  `ClientContextPanel`, `MessageBubble`, `Skeleton`, con sus tests) y el wiring de
  `Sidebar.tsx`/`App.tsx`. El archive NO reescribió los checkboxes (no verificado escenario por
  escenario en esta fase) — si se necesita el estado real, la fuente de verdad es el diff del
  commit, no el checklist.

## Commits / Deploy

- Commit: `0b48e4d7` — `feat(whatsapp): inbox WhatsApp — page 3-paneles + hooks/api/types +
  motion (consume /api/messaging)`.
- Dependencia: BE `messaging-inbox` F1 (commit `b4989f7f`, repo `ipnext-backend`) ya en prod
  antes de este commit.

## Notas / Deudas (F2+)

- Bulk send / segmentación por nodo o estado de conversación — **fuera de alcance F1**.
- Templates de WhatsApp aprobados por Meta para reabrir la ventana 24h — el composer solo avisa
  en F1, no permite reabrir.
- Websockets/SSE (real-time real) — F1 usa exclusivamente polling.
- Grant operacional de `messaging.read`/`messaging.send` al rol de agentes: confirmar que está
  otorgado en producción (pendiente de verificación operativa mencionada en el proposal;
  `NoPermissionPage` es el comportamiento correcto mientras tanto).
- Sin capability sincronizada a un `openspec/specs/` canónico — **este repo no mantiene esa
  carpeta** (no existe `openspec/specs/` en `ipnext-frontend`; los specs archivados de otros
  changes tampoco tienen equivalente ahí). El spec de esta capability vive únicamente en
  `specs/whatsapp-inbox/spec.md` dentro de este archive.
