# Tasks — messaging-inbox-fe (F1-FRONTEND, inbox WhatsApp)

Strict TDD: test (rojo) → implementación (verde) → refactor. Spec enmendado (LIST-1):
badge de fila = `status`, sin `unreadCount`/`canReply` en la lista.

## FB1 — Types + API + hooks (sin dependencias, primero)

- [x] 1.1 `src/types/whatsapp.ts`: DTOs campo a campo del BE real (ListItem, ClientContext,
      ConversationDetail, Message, paginated query/result) — LIST-1, CONTEXT-1
- [x] 1.2 Rojo `useDocumentVisible.test.ts` (mock `visibilitychange`) → 1.3 verde
      `src/hooks/useDocumentVisible.ts`
- [x] 1.4 Rojo `whatsapp.api.test.ts` (mock axios-client, 4 funciones) → 1.5 verde
      `src/api/whatsapp.api.ts` (`BASE='/messaging'`)
- [x] 1.6 Rojo `useWhatsapp.test.ts` — `useWhatsappConversations` (queryKey, refetchInterval
      `visible?15000:false`, keepPreviousData) — LIST-1
- [x] 1.7 Rojo `useWhatsappConversation(id)` (`enabled:!!id`, `visible?5000:false`) — THREAD-1
- [x] 1.8 Rojo `useWhatsappMessages(id)` (mismo gate/polling) — THREAD-1
- [x] 1.9 Rojo `useSendWhatsappMessage(id)` (onSuccess: append optimista + invalidate
      conversations; onError captura 422/503 sin throw) — COMPOSER-1
- [x] 1.10 Verde: `src/hooks/useWhatsapp.ts` (4 hooks, un archivo)
- [x] 1.11 Refactor + tsc limpio de FB1

## FB2 — Presentacionales + motion (depende de FB1)

- [ ] 2.1 Rojo `ConversationListItem.test.tsx`: avatar+nombre+preview+badge `status`
      (sin ventana 24h) — LIST-1 escenario "preview+contacto+estado" (enmendado)
- [ ] 2.2 Verde + CSS Module, tokens `var(--color-*)` — A11Y-1
- [ ] 2.3 Rojo `MessageBubble.test.tsx`: inbound-izq / outbound-der — THREAD-1
- [ ] 2.4 Verde + motion: slide-up `translateY(8px)→0`+opacity 220ms `--wa-ease-out`,
      stagger 40ms si llegan ≥2 juntas (design §7)
- [ ] 2.5 Hover fila (150ms, `hover:hover and pointer:fine`) + selección item
      (background-color 120ms, sin transform) + `prefers-reduced-motion` mata
      translate/scale, deja opacity
- [ ] 2.6 Skeleton shimmer compartido (porta `DataTable.module.css:81-92`) para
      lista/thread/contexto

## FB3 — Paneles (depende de FB1+FB2)

- [ ] 3.1 Rojo `ConversationList.test.tsx`: skeleton / orden desc `lastMessageAt` / empty /
      error / polling sin perder selección — LIST-1 completo
- [ ] 3.2 Verde `ConversationList.tsx`
- [ ] 3.3 Rojo `MessageThread.test.tsx`: fetch on open / loading / empty / `aria-live` /
      polling pausado sin foco — THREAD-1, A11Y-1
- [ ] 3.4 Verde `MessageThread.tsx` (crossfade swap opacity 160ms al cambiar conversación)
- [ ] 3.5 Rojo `Composer.test.tsx`: envío limpia input / `canReply=false` disabled+aviso /
      422 onError sin throw / sin `messaging.send` oculto-disabled / botón ≥44px —
      COMPOSER-1, A11Y-1
- [ ] 3.6 Verde `Composer.tsx` (`<Can permission="messaging.send">`, `:active scale(0.97)`)
- [ ] 3.7 Rojo `ClientContextPanel.test.tsx`: matched/unknown/ambiguous/ausente-neutro —
      CONTEXT-1
- [ ] 3.8 Verde `ClientContextPanel.tsx`

## FB4 — Page + layout (depende de FB1-FB3)

- [x] 4.1 Rojo integración `WhatsappInboxPage.test.tsx`: orquesta 4 hooks, `selectedId`
      sobrevive refetch de lista — LIST-1 escenario "polling sin perder selección"
- [x] 4.2 Verde `WhatsappInboxPage.tsx` (container) + `.module.css` grid 340/1fr/320,
      opt-out negative-margin de `.content`, breakpoints 1200/860 (design §2)
- [x] 4.3 Test: <1200 oculta context, <860 oculta list (thread-only si `selectedId`)
      — `WhatsappInboxPage.layout.test.tsx` (CSS-contract vía `fs.readFileSync`,
      jsdom no evalúa `@media`; ver Deviations) + `data-has-selection` JS-driven

## FB5 — Wiring (TOCA `App.tsx`/`Sidebar.tsx` compartidos — serializar con otros cambios)

- [ ] 5.1 Rojo `WhatsappRoute.permission.test.tsx`: con `messaging.read` renderiza page /
      sin permiso `NoPermissionPage` sin fetch — ROUTE-1
- [ ] 5.2 Verde: `App.tsx` +lazy import +`<Route>` en bloque Singletons (`:382-396`), al
      final, sin reordenar las 94 rutas existentes
- [ ] 5.3 Rojo `Sidebar.test.tsx`: item "WhatsApp" visible con permiso / oculto sin permiso /
      visible en loading — SIDEBAR-1
- [ ] 5.4 Verde: `Sidebar.tsx` +item top-level en `CRM_ITEMS` (patrón `Informes:224-228`)

## Gate (orquestador, antes de merge)

- [ ] G.1 Vitest completo (FB1-FB5) + tsc sin errores
- [ ] G.2 Review adversarial: contrato DTO campo a campo vs BE real, edge cases 404/422/503
- [ ] G.3 `review-animations` (design §7: easing/duración/reduced-motion) — gate obligatorio
- [ ] G.4 Playwright: navegar `/admin/whatsapp`, seleccionar conversación, enviar mensaje,
      ver contexto de cliente

## Known constraints (no bloqueante)

- Grant operacional `messaging.read`/`messaging.send` al rol agentes: verificar antes de
  cerrar — `NoPermissionPage` es comportamiento correcto mientras tanto.
- Anchos (340/320px) y breakpoints (1200/860px): default sin precedente, ajustable en apply.
- Mobile "thread-only" sin botón explícito "volver a lista" (implícito por
  `selectedId=null`) — confirmar alcance F1 en apply.
