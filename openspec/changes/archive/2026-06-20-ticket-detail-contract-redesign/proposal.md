# Proposal — ticket-detail-contract-redesign

## Intent

En el DETALLE de ticket (redesign #44/#48), el sidebar mostraba Cliente, Reporter, Asignado, Prioridad, Area y timestamps — pero **no mostraba el CONTRATO** del cliente. Desde que el contrato pasó a ser **obligatorio al crear un ticket** (el BE ya expone `TicketDto.contractId`), el detalle quedó desfasado: el operador ve a qué cliente pertenece el ticket pero no sobre qué contrato (qué plan, qué domicilio, qué tecnología) se abrió. Eso obliga a saltar al detalle del cliente para reconstruir el contexto.

Además, el detalle arrastraba deuda visual: header con título y acciones en filas separadas, botones nativos (`<button>`) en sidebar y composer en lugar del atom `<Button>`, y colores hex mágicos hardcodeados en CSS en vez de tokens del design system.

Este cambio:

1. **Muestra el contrato del ticket** como fila nueva en el sidebar (Detalles), justo debajo de Cliente, con su label legible (plan - dirección - tecnología) y link al cliente.
2. **Agrupa la metadata del sidebar** en bloques de lectura/edición con separadores, en vez de una lista plana.
3. **Migra botones nativos al atom `<Button>`** (sidebar Guardar, composer Adjuntar/Comentar/Reintentar) y **tokeniza el CSS** (elimina hex mágicos del header, page y timeline).

## Scope

- Repo: **ipnext-frontend** (FE-only, **CERO cambios de backend**). El BE **ya** expone `TicketDto.contractId`; este cambio solo lo consume y renderiza.
- Tocado: `src/types/ticket.ts`, `TicketSidebar` (+.module.css), `TicketHeader` (+.module.css), `TicketCommentsTimeline` (+.module.css), `TicketDetailPage.module.css`, y sus tests.

## Approach (resumen)

- **Resolución del contrato CLIENT-SIDE.** El ticket trae `contractId` (string | null). El label legible NO viene en el `TicketDto`: se resuelve en el FE con `useClientContracts(ticket.customerId)` (el mismo hook que usan CreateTicket / CreateTask), buscando el contrato cuyo `id` matchea `ticket.contractId` y formateándolo con `buildContractLabel`. Cubre estados sin-contrato → "—", cargando → "Cargando…", encontrado → label + link, y no-encontrado (contrato de baja / no listado) → fallback `Contrato #id`.
- **Redesign visual sin tocar lógica.** Header en una sola fila (título + acciones), botones nativos → atom `<Button>`, hex mágicos → tokens del design system.

## Out of scope

- Exponer el label del contrato desde el BE (rechazado: evita un cambio de backend; el FE ya tiene el hook de contratos del cliente).
- Cambios al `TicketDto`, al endpoint de tickets o al modelo de datos del BE.
- El scope de `ticket-detail-datos-to-comment` (#77): ese cambio elimina la sub-page "Datos" y la convierte en comentario de apertura — acá NO se toca el feed de comentarios ni los tabs; solo sidebar/header/composer.

## Decisión clave

**Label del contrato: resolver en FE vs. agregarlo al BE → RESOLVER EN FE.** Justificación: el FE ya tiene `useClientContracts(customerId)` (usado por los pickers de creación), así que renderizar el label es 1 fetch extra del lado del cliente vs. tocar el contrato del `TicketDto` en el backend. Trade-off aceptado: el contrato puede no venir en la lista (ej. dado de baja) → fallback determinístico `Contrato #id`, nunca un crash ni un valor vacío.

## Rollback

Revertir el commit FE de este cambio. **Sin migración, sin backfill, sin cambio de backend** — el campo `contractId` ya existía en el `TicketDto`, así que revertir el FE no deja datos huérfanos ni rompe el contrato con el BE.
