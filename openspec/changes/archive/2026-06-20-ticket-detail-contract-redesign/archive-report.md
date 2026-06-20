# Archive Report — ticket-detail-contract-redesign

**Fecha de archivo:** 2026-06-20
**Estado:** ✅ COMPLETO Y EN PRODUCCIÓN
**Repo:** ipnext-frontend (FE-only)

## Qué se entregó

Redesign del DETALLE de ticket (`/admin/tickets/:id`) + mostrar el CONTRATO del cliente en el panel "Detalles":

- **Contrato visible**: fila "Contrato" nueva en `TicketSidebar`, resuelta client-side con `useClientContracts(customerId)` → `buildContractLabel` (plan - dirección - tecnología), link al cliente, estados (—/cargando/encontrado/fallback `Contrato #id`).
- **Redesign**: metadata del sidebar agrupada en bloques; botones nativos → atom `<Button>` (Guardar, Comentar, Adjuntar, Reintentar); header con título + acciones en una fila; CSS tokenizado (sin hex mágicos en lo tocado).
- **FE-only**: el BE ya exponía `TicketDto.contractId` (change BE previo de contrato obligatorio en tickets).

## Verificación (sdd-verify)

- **Veredicto:** PASS (con warnings, 0 CRITICAL).
- **Scenarios:** 17 (13 ✅ cubiertos por test directo, 2 ⚠️ indirectos, 1 por-construcción).
- **Gate:** `tsc --noEmit` limpio + suite FE completa **3413/0** (372 archivos).
- Detalle en `verify-report.md`.

## Commits / Deploy

- Commit: `1fc2ed7` (código + trail SDD).
- Push: `a0d4c15..1fc2ed7` → deploy `27864043733` (verde).

## Notas

- **Primer cambio bajo la regla "SDD formal SIEMPRE"** (decisión del usuario 2026-06-20). Trail completo: proposal → design → spec → tasks → verify-report → archive.
- Scope separado de `ticket-detail-datos-to-comment` (#77, que toca la sub-page "Datos" → comentario de apertura). Sin solape.
- Warnings residuales (no bloqueantes): literales HSL preexistentes en `TicketCommentsTimeline.module.css` (candidatos a tokenizar a futuro); micro-duplicación del fallback `Contrato #id`.
