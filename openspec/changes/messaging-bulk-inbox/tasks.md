# Change 2 (FE) — Inbox: el mensaje del bulk en el hilo + etiqueta/filtro por campaña

> EPIC Bulk v2 · mergea DESPUÉS de C3 · el BE ya está (contrato abajo) · TDD estricto (Vitest) · FE-puro

## Contexto (regalo del BE): el THREAD NO necesita cambios
El mensaje del bulk YA aparece en el hilo del cliente SIN tocar el FE del thread — el BE crea la fila `ChatMessage` (outbound) y el thread renderiza cualquier mensaje de la conversación. Este change FE es SOLO **la etiqueta + el filtro por campaña** en la lista del inbox.

## Contrato BE (ya implementado, CLEAN — consumilo tal cual)
- **Filtro:** `GET /api/messaging/conversations?campaignId=<id>` → devuelve solo las conversaciones de esa campaña (JOIN Conversation×CampaignRecipient).
- **DTO:** `ConversationListItemDto` ahora incluye `campaigns: { id: string, name: string }[]` (las campañas cuya audiencia incluye a ese cliente; puede ser vacío o >1). Aditivo/opcional — las conversaciones sin campaña traen `[]`.
- El resto del contrato del inbox (assignment filter, status, etc.) intacto.

## FE — approach (reglas INNEGOCIABLES: Select propio, tokens, a11y, ui-ux-pro-max + Emil)
- **Chip de campaña en la fila** (`ConversationListItem.tsx`): clonar el patrón del chip de área (`.areaDot`/`.areaName` / `areaChip`) para un chip "Campaña: {name}" (si hay >1, mostrar la más reciente + "+N"). Requiere `campaigns` en el tipo `WhatsappConversationListItem` (`src/types/whatsapp.ts`, aditivo opcional como `assignee`/`area`). Indicador NO-solo-color (texto del nombre). Contraste ≥4.5:1.
- **Filtro por campaña** (molde `ConversationAssignmentFilter.tsx`): un **`Select`/`Combobox` PROPIO** (NUNCA `<select>` nativo) con la lista de campañas → setea `query.campaignId`. Necesita un fetch de campañas para poblar el select (reusar `useCampaigns` de `useBulkMessaging` si sirve, o el endpoint de campañas). Filtro server-side. Se levanta a `WhatsappInboxPage.tsx` (estado `query`, wiring, molde de `handleAssignmentChange`). Sumar `campaignId?` a `WhatsappPaginatedQuery` (`whatsapp.ts`).
- **Opcional (cosmético):** un rótulo "enviado por campaña" en la burbuja outbound del thread si el DTO expone `origin` — SOLO si es trivial; el thread ya muestra el mensaje.
- Pasa por `ui-ux-pro-max --design-system` + principios de motion de Emil (el chip/filtro que aparezcan sin animación abrupta; reduced-motion).

## Scenarios (TDD — test primero, Vitest + Testing Library)
- La fila muestra el chip "Campaña: X" cuando `campaigns` no está vacío; sin chip cuando `[]`.
- >1 campaña → muestra la más reciente + "+N" (o el criterio elegido), sin romper el layout.
- El filtro de campaña (Select propio) setea `query.campaignId` → dispara el fetch server-side con ese param; "Todas" lo limpia.
- Round-trip del query: elegir campaña → param en la URL/query → la lista se filtra.
- a11y: el Select propio (no nativo), contraste del chip ≥4.5:1, focus-visible.
- key por conversación en los componentes con estado local (memoria `inbox-key-por-conversacion`).

## Tasks
- [ ] T1 tests + tipo `WhatsappConversationListItem.campaigns` + `WhatsappPaginatedQuery.campaignId` + api/hook (param campaignId). RED→GREEN.
- [ ] T2 tests + chip de campaña en `ConversationListItem` (tokens, no-solo-color, +N). RED→GREEN. (ui-ux-pro-max anclado.)
- [ ] T3 tests + filtro de campaña (Select propio) en `WhatsappInboxPage` (server-side, "Todas" limpia). RED→GREEN.
- [ ] T4 gate: `vitest run` archivos del change + `tsc --noEmit`. NO commitear.
```