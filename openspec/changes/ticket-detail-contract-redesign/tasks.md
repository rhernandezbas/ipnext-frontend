# Tasks — ticket-detail-contract-redesign

## 1. Infra — tipo de lectura
- [x] 1.1 Agregar `contractId: string | null` al tipo `Ticket` en `src/types/ticket.ts` (refleja el `TicketDto.contractId` del BE)
- [x] 1.2 Documentar en el tipo que es `null` para tickets legacy previos a la regla del contrato obligatorio

## 2. Implementación — fila Contrato en el sidebar
- [x] 2.1 Importar `useClientContracts` (`@/hooks/useCustomers`) y `buildContractLabel` (`@/lib/buildContractLabel`) en `TicketSidebar.tsx`
- [x] 2.2 Resolver `resolvedContract` buscando en `contracts` el `id` que matchea `ticket.contractId`; gatear el hook con `enabled = hasCustomer`
- [x] 2.3 Crear el componente `ContractValue` con los 4 estados: sin contrato → "—", cargando → "Cargando…", encontrado → label + link, no encontrado → fallback `Contrato #id`
- [x] 2.4 Insertar la fila "Contrato" justo después de "Cliente" en el grupo de contexto

## 3. Implementación — agrupación del sidebar
- [x] 3.1 Agrupar filas en bloques (`.group`) separados por `.divider`: contexto / editables / timestamps
- [x] 3.2 Convertir los `<span>` de los selects editables en `<label htmlFor>` (Asignado, Prioridad, Area)
- [x] 3.3 Migrar el botón Guardar nativo a `<Button variant="primary" size="md" loading={isSaving}>`; preservar la lógica de draft + GUARDAR unificado (#48)
- [x] 3.4 Tokenizar `TicketSidebar.module.css` (`.group`, `.divider`, `.sideValue`, `.sideMuted`; sin hex mágicos)

## 4. Implementación — header + composer + page (redesign visual)
- [x] 4.1 `TicketHeader.tsx`: mover `controls` (Estado + kebab) dentro del bloque de título → una sola fila
- [x] 4.2 `TicketHeader.module.css`: tokenizar (sin hex mágicos)
- [x] 4.3 `TicketCommentsTimeline.tsx`: migrar "Adjuntar imagen", "Comentar" y "Reintentar" al atom `<Button>` (variants/size/loading)
- [x] 4.4 `TicketCommentsTimeline.module.css`: eliminar clases de botón huérfanas (`.btnAttach`, `.btnSubmit`, `.btnRetry`)
- [x] 4.5 `TicketDetailPage.module.css`: tokenizar `.saveError` (reemplazar `#dc2626`/`#fef2f2`/`#b91c1c`/`8px`/`0.875rem` por tokens)

## 5. Testing (TDD)
- [x] 5.1 `TicketSidebar.test.tsx`: fila Contrato — existe, label resuelto (plan/dirección/tecnología), link al cliente, "—" sin contractId, "Cargando…", fallback `Contrato #id`, `enabled = false` sin customerId
- [x] 5.2 `TicketDetailPage.test.tsx`: mock de `useClientContracts` con `importOriginal` (preserva el resto del módulo) + aserción del label del contrato en el sidebar
- [x] 5.3 Agregar `contractId` (y `archivedAt`) a los fixtures de ticket de ambos tests

## Gates
- [x] Tests targeted verdes (TicketSidebar + TicketDetailPage)
- [x] `npm run typecheck` limpio
- [x] Cero cambios de backend (el `TicketDto.contractId` ya existía)
- [x] Scope NO solapado con `ticket-detail-datos-to-comment` (#77): este cambio NO toca tabs ni el feed de comentarios
