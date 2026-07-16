# Spec: Support legacy removal (sidebar "Mensajes")

## Requirements
1. El sidebar (`CRM_ITEMS`) no debe renderizar ningún ítem con label "Mensajes".
2. Ninguna ruta bajo `/admin/support/*` debe existir en `App.tsx` (inbox, mass-send, messengers,
   news) — navegar a esas URLs debe caer en el catch-all `NotFoundPage`.
3. El redirect legacy `/admin/messages → /admin/support/inbox` se elimina (no hay target válido).
4. `MassSendPage`, `MessengersPage`, `NewsPage` (páginas mock sin datos reales) se borran del
   filesystem junto con sus tests.
5. `SupportInboxPage.tsx` (única página del grupo con lógica real conectada a `/messages` vía
   axios) NO se borra — queda huérfana en disco (sin import ni ruta) hasta decisión explícita.
6. Ningún componente activo debe navegar a `/admin/support/*` (referencia rota) — el botón "Enviar
   mensaje" en `CustomerDetailPage` se redirige a `/admin/whatsapp`.

## Scenarios
- Given el sidebar renderizado con cualquier permiso → no existe un botón/link con nombre accesible
  "Mensajes".
- Given `App` montado en `/admin/support/inbox`, `/admin/support/mass-send`,
  `/admin/support/messengers` o `/admin/support/news` → se renderiza `NotFoundPage` (ruta ausente).
- Given `App` montado en `/admin/messages` → NO redirige a `/admin/support/inbox` (ruta ya no
  existe en `App.tsx`); cae en el catch-all.
- Given el usuario abre el dropdown "Acciones" en `CustomerDetailPage` y clickea "Enviar mensaje" →
  navega a `/admin/whatsapp`, no a una ruta 404.
- Given `rg -n "admin/support|support\.read|SupportInboxPage|MassSendPage|MessengersPage|NewsPage" src/`
  → solo debe matchear `SupportInboxPage.tsx`/`SupportInboxPage.module.css`/
  `SupportInboxPage.test.tsx` (excepción documentada); CERO matches de `admin/support`,
  `support.read`, `MassSendPage`, `MessengersPage` o `NewsPage`.
