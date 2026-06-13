# Proposal — ticket-detail-datos-to-comment (#77)

## Intent

En el DETALLE de ticket (redesign #44/#48), la sub-page "Datos" solo mostraba `ticket.description` en un tab aparte. Esto fragmenta la lectura: el usuario tiene que cambiar de tab para ver de qué se trata el ticket, separado del hilo de conversación donde ocurre el resto del trabajo.

Este cambio:

1. **Elimina la sub-page "Datos"** del detalle de ticket.
2. **Convierte ese contenido en el primer comentario del feed** ("comentario de apertura"), atribuido a quién creó el ticket (reporter, #48) y fechado con la creación del ticket.
3. **Centraliza el formato de fechas** del detalle en un helper compartido para consistencia es-AR (legibilidad humana).

## Scope

- Repo: **ipnext-frontend** (FE-only, CERO cambios de backend).
- Tocado: `TicketTabs`, `TicketCommentsTimeline`, `TicketSidebar`, `TicketDetailPage`, nuevo `src/utils/formatDate.ts`, y sus tests.

## Approach (resumen)

- **Comentario VIRTUAL/derivado, NO persistido.** `ticket.description` ya vive en el objeto ticket. El FE inyecta un item sintético al tope del feed (`description` + `reporterName` + `createdAt`) reusando el componente `CommentItem` existente. No se persiste, no hay migración ni backfill, no se duplica data.
- Fecha legible vía helper compartido `formatDateTime` / `formatRelative` (Intl nativo es-AR).

## Out of scope

- Persistir el comentario de apertura como `TicketComment` real (rechazado: duplicaría data + migración/backfill BE sin beneficio).
- Cambios al endpoint de comentarios o al modelo de datos del BE.

## Decisión clave

**Virtual vs persistido → VIRTUAL.** Justificación: la descripción ya es la fuente de verdad en el ticket; renderizarla derivada es idempotente y sin costo de migración. Persistir sería introducir una copia desincronizable y un proceso de backfill para tickets históricos, sin ganancia funcional.
