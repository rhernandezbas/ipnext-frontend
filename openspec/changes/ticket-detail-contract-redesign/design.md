# Design — ticket-detail-contract-redesign

## Componentes afectados

```
src/types/ticket.ts                        (+ contractId: string | null en Ticket)

TicketDetailPage.module.css                (tokeniza .saveError — sin hex mágicos)

TicketDetailPage/components/
  ├─ TicketSidebar.tsx (+.module.css)      (fila Contrato + agrupación + Button)
  ├─ TicketHeader.tsx  (+.module.css)      (título + acciones en una fila, tokenizado)
  └─ TicketCommentsTimeline.tsx (+.module.css)  (botones nativos → Button)
```

## Decisión 1 — Resolución del label del contrato CLIENT-SIDE

El `TicketDto` expone `contractId` (string | null) pero **no** el label del contrato (plan, dirección, tecnología). En vez de pedirle al BE que enriquezca el `TicketDto`, el sidebar resuelve el label en el cliente:

```
const { data: contracts, isLoading } = useClientContracts(ticket.customerId, hasCustomer);
const resolvedContract = ticket.contractId && contracts
  ? contracts.find((c) => String(c.id) === ticket.contractId) ?? null
  : null;
```

- Es el **mismo hook** que usan los pickers de CreateTicket / CreateTask, así que no se introduce data source nueva.
- El label legible se arma con `buildContractLabel({ id, plan, address, technology })` → `"plan - address - technology"`, omitiendo segmentos ausentes.
- `useClientContracts(id, enabled)`: el segundo argumento gatea el fetch. Cuando no hay `customerId` se pasa `enabled = false` para no disparar la query.

**Trade-off:** 1 fetch extra del lado del cliente vs. un cambio de backend en el `TicketDto`. Se elige el fetch extra porque el hook ya existe y el cambio queda FE-only.

**Estados de la fila Contrato** (componente `ContractValue`):

| Estado | Condición | Render |
|--------|-----------|--------|
| Sin contrato | `contractId == null` | `—` |
| Cargando | `hasCustomer && isLoading` | `Cargando…` (muted) |
| Encontrado | `resolvedContract != null` | `buildContractLabel(...)` + link a `/admin/customers/view/:customerId` |
| No encontrado | `contractId` set pero sin match (ej. contrato de baja / no listado) | fallback `Contrato #{contractId}` |

El orden de los guards importa: primero "sin contrato", luego "cargando", luego "encontrado", y por último el fallback. El fallback NO debe mostrar el plan de otro contrato.

## Decisión 2 — Agrupación de metadata del sidebar

La lista plana de filas se reorganiza en tres grupos separados por `<hr className={styles.divider}>`:

1. **Contexto del ticket (lectura):** Cliente, Contrato (nuevo), Reporter.
2. **Campos editables (draft + GUARDAR unificado):** Asignado a, Prioridad, Area. (El Estado se sigue editando desde el header; el GUARDAR persiste todo en un solo PATCH — comportamiento #48 intacto.)
3. **Timestamps (lectura):** Creado, Actualizado.

Cada grupo es un `<div className={styles.group}>`. Los `<select>` editables ganan `<label htmlFor>` (en vez de `<span>`) para accesibilidad. No cambia la lógica de draft/guardado.

## Decisión 3 — Botones nativos → atom `<Button>` + tokenización

- **Sidebar:** el `<button className={styles.saveBtn}>` Guardar pasa a `<Button variant="primary" size="md" loading={isSaving}>`. El estado de loading lo maneja el atom (`loading` reemplaza el texto "Guardando…" manual).
- **Composer (TicketCommentsTimeline):** "📎 Adjuntar imagen" → `<Button variant="secondary" size="sm">`; "Comentar" → `<Button variant="primary" size="md" loading={pending}>`; "Reintentar" del error-state → `<Button variant="secondary" size="sm">`.
- **CSS:** se eliminan los hex mágicos (`#dc2626`, `#fef2f2`, `#b91c1c`, etc.) y los tamaños hardcodeados (`8px`, `0.875rem`) reemplazándolos por tokens del design system (`--color-danger`, `--color-danger-bg-hover`, `--radius-md`, `--font-size-sm`, `--space-*`). El header pasa a una sola fila (título + controls como hijo del bloque de título).

## Decisión 4 — Por qué FE-only

El `contractId` ya viaja en el `TicketDto` (el BE lo agregó al volverse obligatorio el contrato en la creación). Todo lo que falta es **presentación**: resolver el label (hook FE existente) y pulir el layout (atoms + tokens FE). No hay endpoint nuevo, ni cambio de shape, ni migración. El BE es la fuente de verdad de `contractId`; el FE solo lo consume.

## Riesgos

- **Contrato de baja no listado:** `useClientContracts` puede no devolver contratos dados de baja. Mitigado por el fallback `Contrato #id` (Decisión 1) — nunca crashea ni muestra vacío.
- **Tickets legacy sin contrato:** `contractId = null` para tickets creados antes de la regla → render "—". Cubierto por test.
- **`customerId` ausente:** se pasa `enabled = false` al hook para no disparar una query inútil. Cubierto por test (el segundo arg del hook es falsy).
