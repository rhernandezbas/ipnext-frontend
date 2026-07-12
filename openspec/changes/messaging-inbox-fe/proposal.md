# Proposal: WhatsApp Inbox (F1-FRONTEND)

## Intent

F1-BE (`messaging-inbox`, en prod) expone `/api/messaging/*` sin UI. Agentes de atención
necesitan responder WhatsApp (Chatwoot) sin salir de Prominense. F1-FE construye ese apartado:
inbox de 3 paneles (conversaciones, thread, contexto de cliente).

## Scope

### In Scope
- Page `/admin/whatsapp`: lista + thread + panel de contexto de cliente.
- Consumo de los 4 endpoints `/api/messaging/*` (list, detail, messages, send).
- Polling (`refetchInterval`) como único real-time.
- Composer con gating de ventana 24h (`canReply`) + manejo de 422.
- Contexto de cliente: 3 estados (`matched`/`unknown`/`ambiguous`).
- Gating: `messaging.read` (page), `messaging.send` (responder). Sidebar item "WhatsApp".

### Out of Scope
- Bulk/segmentación (F2). Templates fuera de ventana 24h (F2 — el composer solo avisa).
- Websockets/SSE. Tocar `useMessages`/`messages.api.ts`/`types/message.ts`/`SupportInboxPage`
  (módulo interno, intacto).

## Capabilities

### New Capabilities
- `whatsapp-inbox`: inbox admin de 3 paneles sobre `/api/messaging/*`, namespace FE propio
  (`whatsapp.*`), real-time por polling.

### Modified Capabilities
- None.

## Approach

| Tema | Estado | Resolución |
|------|--------|------------|
| Naming | Decidido | Cero `messages`/`messaging` en identificadores — colisiona con módulo interno (sidebar "Mensajes"→`support.read`, `useMessages`/`messages.api.ts`). Namespace propio: `src/pages/whatsapp/`, `whatsapp.api.ts`, hooks `useWhatsapp*`, `types/whatsapp.ts` |
| Polling | Mecanismo decidido, valores a confirmar | Lista `refetchInterval` ~15s; thread ~5s con `enabled: !!id`; pausa si `document.visibilityState !== 'visible'`. Molde `useUispSyncStatus.ts` |
| Layout | A confirmar | 3 columnas full-height sin tocar `AdminLayout.tsx` (~94 rutas compartidas): `WhatsappInboxPage.module.css` cancela el padding de `.content` con margin negativo local + `height` propio |
| Composer/24h | Decidido | `canReply=false` → composer deshabilitado + aviso "Ventana de 24h expirada — template (F2)". 422 capturado en `onError` de la mutation (interceptor global solo maneja 401) |
| Contexto cliente | Decidido | Extiende `CustomerCard.tsx` (avatar+nombre+link+contacto) de 2 a 3 estados, sumando `ambiguous` (candidatos) |
| Sidebar | A confirmar | Singleton top-level con `to` directo + `requiredPermission: 'messaging.read'`, en vez de grupo `children` en `CRM_ITEMS` (F1 = una sola vista) |
| Diseño | Innegociable | `ui-ux-pro-max` (Data-Dense Dashboard + bubbles, tokens `var(--color-*)`) para estático; skills Emil para motion; `review-animations` obligatorio pre-merge |

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/pages/whatsapp/*` | New | Page + ConversationList/Item, MessageThread/Bubble/Composer, ClientContextPanel |
| `src/api/whatsapp.api.ts` | New | 4 funciones sobre `/api/messaging/*` |
| `src/hooks/useWhatsapp*.ts` | New | Query/mutation hooks con polling |
| `src/types/whatsapp.ts` | New | DTOs conversación/mensaje/contexto |
| `src/App.tsx` | Modified | +2 rutas leaf, append al final, sin reordenar las 94 existentes |
| `Sidebar.tsx` | Modified | +1 item top-level "WhatsApp" |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Colisión de naming residual (copiar CSS legacy) | Low | Prohibir `MessagesPage.module.css`/`SideCard.module.css` como referencia visual |
| Sin precedente de 3-pane full-height | Med | Opt-out de padding local a la page, cero cambio en `AdminLayout.tsx` |
| 422 de ventana 24h mal manejado | Med | `onError` dedicado + composer deshabilitado por `canReply` |
| Grant BE pendiente (`messaging.*` no otorgado al rol agentes) | Med (operacional) | Verificar antes de cerrar F1-FE; `NoPermissionPage` es correcto mientras tanto |
| Motion sin revisar a prod | Low | `review-animations` como gate obligatorio pre-merge |

## Rollback Plan

Aditivo y stateless: borrar `src/pages/whatsapp/`, `whatsapp.api.ts`, `useWhatsapp*.ts`,
`whatsapp.ts`, quitar 2 rutas de `App.tsx` + item de `Sidebar.tsx`. No toca `/admin/messages`
(redirect existente) ni `support.*`/módulo interno.

## Dependencies

- BE `messaging-inbox` F1 en prod (confirmado).
- Grant operacional de `messaging.read`/`messaging.send` al rol de agentes (a verificar).
- `ui-ux-pro-max` + skills de Emil disponibles en design/apply.

## Success Criteria

- [ ] `/admin/whatsapp` renderiza el inbox, gateado por `messaging.read`, accesible desde
  "WhatsApp" en el sidebar.
- [ ] Lista y thread pollean según intervalo de design; se pausan sin foco.
- [ ] Composer deshabilitado + aviso si `canReply=false`; 422 sin crash.
- [ ] Contexto cubre `matched`/`unknown`/`ambiguous`.
- [ ] Cero `messages`/`messaging`/`support.*` legacy en código nuevo; 94 rutas existentes
  siguen resolviendo.
- [ ] `review-animations` pasado antes de merge.
