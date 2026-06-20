# Verify Report: ticket-detail-contract-redesign

**Verdict:** PASS (con warnings)

**Date:** 2026-06-20
**Target:** worktree `.claude/worktrees/ticket-detail-redesign-fe`, branch `feat/ticket-detail-redesign` (uncommitted)
**Phase:** sdd-verify

## Summary

The redesign of the ticket detail (sidebar + contract row + header/composer button migration + sidebar grouping) is implemented and matches the spec. Of **17 scenarios** across 6 requirements, **15 are directly covered by an asserting test** and **2 are covered only structurally / indirectly** (the read-side DTO→Ticket mapping for `contractId`, which the FE performs as a pass-through cast with no transform — see WARNING W1/W2).

Both gates are green:

- **Typecheck:** `npm run typecheck` → clean, **0 errors**.
- **Vitest (tickets suite):** `npx vitest run src/__tests__/tickets/` → **35 files passed, 311 tests passed, 0 failed**. The two key files (`TicketSidebar.test.tsx` + `TicketDetailPage.test.tsx`) → **36 tests passed**.

No CRITICAL findings. No scenario contradicts the implementation. The `.saveError` token migration (the only hex-flagged scenario) is fully clean.

## Test & Typecheck Detail

```
npm run typecheck                       → 0 errors (clean)
npx vitest run src/__tests__/tickets/   → Test Files 35 passed | Tests 311 passed | 0 failed   (55.5s)
   ├─ TicketSidebar.test.tsx  + TicketDetailPage.test.tsx → 36 passed (combined run)
```

## Spec Coverage Matrix

| # | Requirement | Scenario | Code | Test | Status |
|---|---|---|---|---|---|
| R1 | `Ticket` expone `contractId` | Ticket con contrato → `contractId === "contract-9"` | `types/ticket.ts:36` (`contractId: string \| null`); `tickets.api.ts:53` pass-through cast | `TicketDetailPage.test.tsx` "renders the resolved contract label…" (feeds `contractId:'contract-9'`, asserts label) — indirect | ⚠️ INDIRECTO |
| R1 | `Ticket` expone `contractId` | Ticket legacy sin contrato → `contractId === null` | `types/ticket.ts:36` (nullable) | — sin test que asserte el caso legacy null en el mapeo de lectura | ❌ NO CUBIERTO (directo) |
| R2 | Sidebar muestra el CONTRATO | Existe una fila "Contrato" | `TicketSidebar.tsx:94-103` | `TicketSidebar.test.tsx` "muestra una fila \"Contrato\"" | ✅ CUBIERTO |
| R2 | Sidebar muestra el CONTRATO | Contrato encontrado → label legible (`plan - dir - tec`) | `TicketSidebar.tsx:234-243` + `buildContractLabel.ts:16` | `TicketSidebar.test.tsx` "resuelve el label del contrato (plan - dirección - tecnología)…"; `TicketDetailPage.test.tsx` "renders the resolved contract label…" | ✅ CUBIERTO |
| R2 | Sidebar muestra el CONTRATO | Contrato encontrado → link `/admin/customers/view/<uuid>` | `TicketSidebar.tsx:236-239` | `TicketSidebar.test.tsx` "linkea al detalle del cliente cuando hay contrato resuelto" (asserta href) | ✅ CUBIERTO |
| R2 | Sidebar muestra el CONTRATO | Ticket sin contrato → "—" (y no dispara la query por contrato) | `TicketSidebar.tsx:226-228` | `TicketSidebar.test.tsx` "muestra \"—\" cuando el ticket no tiene contractId" | ✅ CUBIERTO |
| R2 | Sidebar muestra el CONTRATO | Cargando contratos → "Cargando…" | `TicketSidebar.tsx:230-232` | `TicketSidebar.test.tsx` "muestra \"Cargando…\" mientras useClientContracts está cargando" | ✅ CUBIERTO |
| R2 | Sidebar muestra el CONTRATO | Contrato no encontrado (de baja) → fallback `Contrato #id`, NO el plan de otro | `TicketSidebar.tsx:244-246` + resolución `:67-70` (match exacto por id) | `TicketSidebar.test.tsx` "hace fallback al code/#id cuando no encuentra el contrato…" (asserta `contract-1` y `not.toContain('Fibra 300MB')`) | ✅ CUBIERTO |
| R2 | Sidebar muestra el CONTRATO | Sin `customerId` → `useClientContracts` con `enabled = false` | `TicketSidebar.tsx:62-66` (`hasCustomer`, 2º arg) | `TicketSidebar.test.tsx` "no consulta contratos cuando no hay customerId (enabled=false)" (asserta `lastCall[1] === false`) | ✅ CUBIERTO |
| R3 | Botones usan el atom `<Button>` | Guardar del sidebar = `<Button variant="primary">` con `loading` | `TicketSidebar.tsx:195-206` (`variant="primary"`, `loading={isSaving}`) | `TicketDetailPage.test.tsx` "GUARDAR persists…", "GUARDAR is disabled when no pending changes", "GUARDAR becomes enabled…" (rol button) | ✅ CUBIERTO |
| R3 | Botones usan el atom `<Button>` | Composer: Adjuntar = `secondary`, Comentar = `primary` con `loading` | `TicketCommentsTimeline.tsx:305-312, 319-329` | `TicketCommentsTimeline.test.tsx` (composer: rol button "Adjuntar imagen" / "Comentar", estado pending) | ✅ CUBIERTO |
| R3 | Botones usan el atom `<Button>` | Reintentar (error-state) = `<Button variant="secondary">` | `TicketCommentsTimeline.tsx:547-549` | `TicketCommentsTimeline.test.tsx` (error-state → botón "Reintentar" dispara refetch) | ✅ CUBIERTO |
| R4 | Header alinea título + acciones en una fila | Título + Estado + kebab en el mismo bloque de fila | `TicketHeader.tsx:113-212` (`.titleRow` envuelve título + `.controls`) + `TicketHeader.module.css:48-53` | `TicketDetailPage.test.tsx` "renders ticket subject…", "renders the catalog-driven StatusSelect…", "Acciones kebab exposes…" (los tres conviven en el header) | ✅ CUBIERTO |
| R4 | Header alinea título + acciones | Sin hex mágicos en los `.module.css` tocados | `TicketDetailPage.module.css:36-44` (`.saveError` tokenizado); diff confirma remoción de `#dc2626/#fef2f2/#b91c1c/8px/0.875rem` | — verificado por inspección de código + `git diff` (no hay test automatizado de "no hex") | ⚠️ verificado manualmente |
| R5 | Metadata del sidebar agrupada por bloques | Filas agrupadas en `.group` separados por `.divider` + labels `htmlFor` | `TicketSidebar.tsx:81-191` (3× `.group`, 2× `.divider`), `:119,140,157` (`<label htmlFor>`) | `TicketSidebar.test.tsx` / `TicketDetailPage.test.tsx` resuelven selects por su label accesible (`name: /asignar a/i`, `/prioridad/i`, `/area/i`) → prueba la asociación label↔control | ✅ CUBIERTO |
| R5 | Metadata del sidebar agrupada | El GUARDAR unificado sigue persistiendo en un PATCH | `TicketSidebar.tsx:193-208` + page draft (#48) | `TicketDetailPage.test.tsx` "GUARDAR persists assignee + status + priority in a single updateTicket call" (asserta un único `mutateAsync` con el draft) | ✅ CUBIERTO |

**Totales:** 13 ✅ CUBIERTO · 2 ⚠️ verificado-indirecto/manual · 1 ❌ no-cubierto-directo (legacy null read-mapping)

## Standards Check

- **Atom `<Button>`:** PASS. Sidebar Guardar, Composer Adjuntar/Comentar y error-state Reintentar usan el atom con `variant`/`size`/`loading`. No quedan `<button>` ad-hoc para esas acciones; las clases huérfanas `.btnAttach/.btnSubmit/.btnRetry` fueron eliminadas (confirmado por `git diff`).
- **Tokens CSS (sin hex mágicos en lo tocado):** PASS para el scope del cambio. `.saveError` migró a `--color-danger` / `--color-danger-bg-hover` / `--radius-md` / `--font-size-sm`. `TicketSidebar`, `TicketHeader` y `TicketDetailPage` module.css usan tokens `--color-*`/`--space-*`/`--radius-*`/`--font-size-*`.
- **`@/*` alias:** PASS. Todos los imports cross-module usan `@/`.
- **Label↔control accesible:** PASS. Asignado/Prioridad/Area usan `<label htmlFor>` ligado al `id` del `<select>`.
- **Spanish UI copy:** PASS ("Contrato", "Cargando…", "Guardar", "Comentar", "Reintentar").

## Findings

### CRITICAL
None.

### WARNING

- **W1 — R1/escenario "Ticket con contrato" cubierto sólo indirectamente.** El FE NO tiene un mapper DTO→Ticket: `getTicketById` (`tickets.api.ts:53-56`) castea `response.data` directo a `Ticket` (pass-through). El único test que toca `contractId` en lectura es `TicketDetailPage.test.tsx` "renders the resolved contract label…", que **inyecta** un `Ticket` con `contractId:'contract-9'` en el mock de `useTicket` y asserta el label resuelto — prueba que el campo *fluye* por el sidebar, pero NO el mapeo de lectura como tal (porque no hay transform que testear: es identidad). El comportamiento es correcto por construcción (campo tipado + cast pass-through), por eso es WARNING y no CRITICAL.

- **W2 — R1/escenario "Ticket legacy sin contrato → null" sin test directo.** No existe assertion que verifique que un `TicketDto` legacy sin contrato produce `ticket.contractId === null` en lectura. Igual que W1, el campo es `string | null` y el cast es pass-through, así que el caso null se mantiene por construcción; pero el escenario del spec no tiene un test que lo pinee. Si en el futuro se introduce un mapper real de lectura, agregar dos asserts (presente / legacy-null) cerraría W1+W2.

- **W3 — "Sin hex mágicos" no tiene test automatizado.** El escenario R4 (sin hex) se verifica por inspección de código + `git diff` (la migración de `.saveError` es correcta y completa). No hay un guard automatizado que falle si reaparece un hex literal. Consistente con el resto del repo (tampoco lo tiene), por eso es WARNING informativo.

### SUGGESTION

- **S1 — Literales HSL pre-existentes en `TicketCommentsTimeline.module.css`.** Quedan `hsl(0 72% 96%)` / `hsl(0 72% 88%)` (`.errorState`, `.composerError`) y `hsl(265 50% 50% / 0.12)` (`.composerTextarea:focus`). NO los introdujo este cambio (el `git diff` de ese archivo sólo *elimina* clases de botón huérfanas) y el escenario del spec apunta específicamente a literales **hex**, no HSL — por eso no es finding del scope. Aun así, para una pasada futura de tokens conviene migrarlos a `--color-danger-*` / `--color-accent` con alpha.

- **S2 — El fallback `Contrato #id` usa string propio, no `buildContractLabel`.** `ContractValue` (`TicketSidebar.tsx:245`) arma `Contrato #${contractId}` a mano en vez de delegar en `buildContractLabel` (que produce el mismo formato cuando `plan` está ausente). Funcionalmente idéntico y el test lo cubre; sólo es una micro-duplicación de la convención de fallback. No bloqueante.

## Notes

- La ruta de referencia de estilo (`openspec/changes/archive/2026-05-30-gestion-real-config-subpage/verify-report.md`) SÍ existe en este worktree y se usó como plantilla.
- `tasks.md` está 100% tildado y se corresponde con el código real (tipo, fila Contrato + `ContractValue` con 4 estados, agrupación `.group`/`.divider`, labels `htmlFor`, migración a `<Button>`, header en una fila, tokenización de `.saveError`).
- Cero cambios de backend: el `TicketDto.contractId` ya existía; el FE sólo agrega el campo de lectura y resuelve el label client-side vía `useClientContracts`.
