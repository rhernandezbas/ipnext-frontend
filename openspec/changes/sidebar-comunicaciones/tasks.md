# Tasks: sidebar-comunicaciones

## Completed

- [x] Verificar (código) si `SupportInboxPage`/`MassSendPage`/`MessengersPage`/`NewsPage` tienen
      lógica real conectada a API antes de borrar — `SupportInboxPage` SÍ (axios `/messages`),
      las otras 3 son mock/estáticas.
- [x] TDD — actualizar tests primero (RED esperado):
  - [x] `src/__tests__/layout/Sidebar.test.tsx` — reemplazar asserts de "Mensajes" por ausencia del
        item; borrar el test de "Envío masivo" bajo Mensajes.
  - [x] `src/__tests__/components/organisms/Sidebar/SidebarWhatsapp.test.tsx` — regex del label del
        grupo `/^whatsapp$/i` → `/^comunicaciones$/i` (children intactos).
  - [x] `src/__tests__/routing/App.routing.test.tsx` — borrar mocks + casos directos de
        `/admin/support/*` y el caso de redirect `/admin/messages`.
  - [x] Borrar `src/__tests__/support/{MassSendPage,MessengersPage,NewsPage}.test.tsx`.
- [x] Implementación (GREEN):
  - [x] `Sidebar.tsx` — quitar item "Mensajes" de `CRM_ITEMS`; renombrar `WhatsApp` → `Comunicaciones`
        + reescribir el comentario que advertía la colisión.
  - [x] `App.tsx` — quitar lazy imports de las 4 páginas Support, el redirect `/admin/messages`, y el
        bloque `<Route path="support">`.
  - [x] Borrar `src/pages/support/{MassSendPage.tsx,MassSendPage.module.css,MessengersPage.tsx,NewsPage.tsx}`.
  - [x] `CustomerDetailPage.tsx` — botón "Enviar mensaje" ahora navega a `/admin/whatsapp` (antes
        `/admin/support/inbox`, ruta eliminada).
- [x] Primer commit `cd1c064d` — `feat(sidebar): eliminar Mensajes (Support legacy) y renombrar
      WhatsApp a Comunicaciones` (con `SupportInboxPage` preservada pendiente de decisión).

## Segundo commit — borrado total (decisión del usuario 2026-07-16: "se borra Mensajes TODO")

- [x] Verificar consumidores de `useMessages`/`messages.api.ts` — únicos: `SupportInboxPage.tsx` y
      `MessagesPage.tsx` (ambas huérfanas) + comentario en `src/types/whatsapp.ts`. Types
      `message`/`messenger`/`news` también huérfanos (verificado).
- [x] Borrar `src/pages/support/SupportInboxPage.tsx` + `.module.css` +
      `src/__tests__/support/SupportInboxPage.test.tsx` → carpetas `pages/support/` y
      `__tests__/support/` eliminadas (vacías).
- [x] Borrar `src/pages/messages/MessagesPage.tsx` + `.module.css` +
      `src/__tests__/messages/MensajesPage.test.tsx` → carpetas `pages/messages/` y
      `__tests__/messages/` eliminadas.
- [x] Borrar hooks: `src/hooks/{useMessages,useMessengers,useNews}.ts`.
- [x] Borrar api clients: `src/api/{messages.api,messenger.api,news.api}.ts`.
- [x] Borrar types huérfanos: `src/types/{message,messenger,news}.ts`.
- [x] Actualizar comentario en `src/types/whatsapp.ts` (referenciaba `useMessages.ts`/`messages.api.ts`).
- [x] Actualizar `docs/business/features.md` — "Mensajes/Soporte" → "Comunicaciones".
- [x] Actualizar artefactos SDD (proposal/spec/este tasks.md) con la decisión final.
- [x] Grep de limpieza ampliado
      (`admin/support|support\.read|SupportInboxPage|MassSendPage|MessengersPage|NewsPage|useMessages|messages\.api|useMessengers|useNews`)
      sobre `src/` → CERO matches.
- [x] Tests afectados verdes + `npx tsc --noEmit` sin errores.
- [x] Segundo commit local `chore(support): remove legacy messages feature completely`.

## Deuda registrada (fuera de scope FE)
- **BE**: el API `/messages` del backend (`ipnext-backend`) queda como dead code sin ningún
  consumidor FE — limpiarlo en un change BE aparte.
