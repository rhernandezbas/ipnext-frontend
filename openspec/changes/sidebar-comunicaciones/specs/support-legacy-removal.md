# Spec: Support legacy removal (sidebar "Mensajes")

## Requirements
1. El sidebar (`CRM_ITEMS`) no debe renderizar ningún ítem con label "Mensajes".
2. Ninguna ruta bajo `/admin/support/*` debe existir en `App.tsx` (inbox, mass-send, messengers,
   news) — navegar a esas URLs debe caer en el catch-all `NotFoundPage`.
3. El redirect legacy `/admin/messages → /admin/support/inbox` se elimina (no hay target válido).
4. `MassSendPage`, `MessengersPage`, `NewsPage` (páginas mock sin datos reales) se borran del
   filesystem junto con sus tests.
5. Borrado total (decisión del usuario 2026-07-16, "se borra Mensajes TODO"): `SupportInboxPage.tsx`
   (+ css + test), `MessagesPage.tsx` (+ css + test, ya huérfana pre-change), los hooks
   `useMessages`/`useMessengers`/`useNews`, los api clients `messages.api`/`messenger.api`/`news.api`
   y los types `message`/`messenger`/`news` se eliminan del filesystem. Las carpetas
   `src/pages/support/`, `src/pages/messages/`, `src/__tests__/support/` y `src/__tests__/messages/`
   quedan eliminadas.
6. Ningún componente activo debe navegar a `/admin/support/*` (referencia rota) — el botón "Enviar
   mensaje" en `CustomerDetailPage` se redirige a `/admin/whatsapp`.
7. El endpoint `/messages` del backend queda sin consumidores FE — dead code a limpiar en un change
   BE aparte (fuera del scope de este change).
8. El botón "Enviar mensaje" en `CustomerDetailPage` requiere el permiso `messaging.read` (gateado
   con `<Can>`, igual que "Bloquear cliente" con `clients.write` y "Eliminar cliente" con
   `clients.delete`) — un usuario sin ese permiso no debe ver un botón que lo lleva a un dead-end de
   permisos (review L1).

## Scenarios
- Given el sidebar renderizado con cualquier permiso → no existe un botón/link con nombre accesible
  "Mensajes".
- Given `App` montado en `/admin/support/inbox`, `/admin/support/mass-send`,
  `/admin/support/messengers` o `/admin/support/news` → se renderiza `NotFoundPage` (ruta ausente).
- Given `App` montado en `/admin/messages` → NO redirige a `/admin/support/inbox` (ruta ya no
  existe en `App.tsx`); cae en el catch-all.
- Given el usuario abre el dropdown "Acciones" en `CustomerDetailPage` y clickea "Enviar mensaje" →
  navega a `/admin/whatsapp`, no a una ruta 404.
- Given un usuario SIN `messaging.read` → el botón "Enviar mensaje" en el dropdown "Acciones" de
  `CustomerDetailPage` NO se renderiza; el resto del dropdown ("Bloquear cliente", "Crear ticket",
  "Eliminar cliente") sigue visible según sus propios gates.
- Given
  `rg -n "admin/support|support\.read|SupportInboxPage|MassSendPage|MessengersPage|NewsPage|useMessages|messages\.api|useMessengers|useNews" src/`
  → CERO matches (limpieza total tras el segundo commit).
