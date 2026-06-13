# Design — ticket-detail-datos-to-comment (#77)

## Componentes afectados

```
TicketDetailPage.tsx
  └─ TicketTabs.tsx            (props: + reporterName, + createdAt)
       └─ TicketCommentsTimeline.tsx   (props opcionales: description, reporterName, createdAt)
  └─ TicketSidebar.tsx         (usa formatRelative del helper)

src/utils/formatDate.ts        (NUEVO — formatDateTime + formatRelative)
```

## Parte 1 — Eliminar tab "Datos"

- `TAB_IDS` queda `{ conversacion, relacionado }`. Default sigue siendo `conversacion` (sin tab vacío seleccionable).
- Se borra `DatosPanel` y las clases CSS huérfanas `.description` / `.descriptionEmpty`.

## Parte 2 — Comentario de apertura (virtual)

`TicketCommentsTimeline` recibe `description`, `reporterName`, `createdAt`. Construye `openingComment` con el shape de `TicketComment`:

```
{ id: `initial-${ticketId}`, ticketId, authorName: reporterName ?? reporter ?? 'Sistema',
  body: description, createdAt, attachments: [] }
```

Reglas:
- Se inyecta como PRIMER elemento del feed (orden cronológico correcto: la creación precede a todo comentario).
- Si `description` (trim) está vacío → NO se inyecta.
- El empty-state del feed considera `!openingComment` para no mostrarse cuando hay apertura pero 0 comentarios reales.
- Forma visual: **indistinguible** de un comentario normal (reusa `CommentItem` tal cual; sin badge). Decisión por simplicidad y consistencia con el diseño existente.

## Parte 3 — Helper de fechas

`src/utils/formatDate.ts`:
- `formatDateTime(iso)`: absoluto es-AR (`Intl.DateTimeFormat`), fallback al input ante iso inválido. Usado por la timeline (comentarios reales + apertura).
- `formatRelative(iso)`: relativo es-AR (`Intl.RelativeTimeFormat numeric:'auto'`), fallback `toLocaleDateString` para >30 días. Usado por el sidebar ("Creado").

Reemplaza los dos helpers inline duplicados (`formatDate` en timeline, `relativeDate` en sidebar). El "Creado" del sidebar ya era legible (relativo + tooltip ISO) — se preserva el comportamiento, solo se centraliza.

## Riesgos

- `Intl.RelativeTimeFormat numeric:'auto'` devuelve "anteayer" para 2 días exactos — tests usan 3 días para forma numérica determinística.
- Sensibilidad a TZ en tests del helper: las aserciones verifican partes (año/mes) en vez de string exacto donde aplica.
