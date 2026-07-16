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
  - [x] NO borrado (excepción documentada, ver proposal.md): `SupportInboxPage.tsx` +
        `SupportInboxPage.module.css` + `SupportInboxPage.test.tsx`.
- [x] `npx vitest run` sobre los 5 archivos tocados/relevantes — 166/166 tests verdes.
- [x] `npx tsc --noEmit` — sin errores.
- [x] `rg` de limpieza — CERO matches excepto la excepción documentada (`SupportInboxPage.*`).
- [x] Crear artefactos openspec (`proposal.md`, `specs/support-legacy-removal.md`,
      `specs/whatsapp-rename.md`, este `tasks.md`).
- [ ] Commit local (conventional commits, sin push) — pendiente al momento de escribir este archivo.

## Pendiente / seguimiento (fuera de scope de este change)
- Decidir el destino final de `SupportInboxPage.tsx` (borrar en un follow-up vs. reutilizar/migrar
  su lógica de `/messages` a Comunicaciones).
- `src/pages/messages/MessagesPage.tsx` + `src/__tests__/messages/MensajesPage.test.tsx`: página
  "Mensajes" completa (compose, tabs inbox/sent/draft) YA huérfana (sin ruta) antes de este change.
  No se tocó — mencionar para una futura limpieza de dead code.
- `src/hooks/useMessengers.ts` + `src/api/messenger.api.ts` y `src/hooks/useNews.ts` +
  `src/api/news.api.ts` quedan sin consumidores tras borrar `MessengersPage`/`NewsPage` — candidatos
  a limpieza en un follow-up (no borrados acá: fuera del scope explícito de la tarea).
- `docs/business/features.md:25` sigue documentando "Mensajes/Soporte" como feature — desactualizado,
  no tocado (fuera de scope; el grep de limpieza pedido era sobre `src/`).
