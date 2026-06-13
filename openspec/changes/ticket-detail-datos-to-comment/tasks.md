# Tasks — ticket-detail-datos-to-comment (#77)

## Parte 1 — Eliminar sub-page "Datos"
- [x] Quitar tab `datos` del array de tabs en `TicketTabs.tsx`
- [x] Eliminar clave `datos` de `TAB_IDS`
- [x] Borrar función `DatosPanel`
- [x] Limpiar clases CSS huérfanas `.description` / `.descriptionEmpty` en `TicketTabs.module.css`
- [x] Verificar default tab `conversacion` intacto (sin tab vacío seleccionado)
- [x] Actualizar `TicketDetailPage.test.tsx`: eliminar casos del tab "Datos" + aserción de que ya no existe

## Parte 2 — Comentario de apertura (virtual)
- [x] Pasar `reporterName` + `createdAt` de `TicketDetailPage` → `TicketTabs` → `TicketCommentsTimeline`
- [x] Construir `openingComment` sintético (id `initial-${ticketId}`, autor reporterName/fallback, body description, createdAt, attachments [])
- [x] Inyectar como primer ítem del feed; no inyectar si description vacío
- [x] Ajustar empty-state del feed para considerar `!openingComment`
- [x] TDD: test apertura presente (reporter + fecha + texto) y test apertura ausente con description vacío

## Parte 3 — Helper de fechas
- [x] Crear `src/utils/formatDate.ts` con `formatDateTime` + `formatRelative`
- [x] Reemplazar `formatDate` inline en `TicketCommentsTimeline`
- [x] Reemplazar `relativeDate` inline en `TicketSidebar`
- [x] TDD: tests del helper (formato es-AR, fallback iso inválido, relativo)

## Gates
- [x] Tests targeted verdes: 65/65 (TicketDetailPage 26, TicketCommentsTimeline 30, TicketSidebar 2, formatDate 7)
- [x] `npm run typecheck` limpio
- [x] Commit en branch `feat/77-datos-to-comment` (SHA 2215e6b), sin atribución AI, no push
