# Tasks — bulk-detail-polling-fe

Orden TDD (test que falla primero → código → refactor). Correr SOLO los archivos afectados
durante el loop (`npx vitest run <ruta>`); el gate completo lo corre el orquestador.

- [x] **T0 — Investigación prioridad 1 (bug "POST /send nunca sale" reportado en prod)**:
  test de click-through completo a nivel `BulkMessagingPage` (router real + `Tabs mountMode="all"`,
  la composición real de prod). Resultado: PASA sin cambios de código — el wiring
  click→confirm→confirm→`sendCampaign` ya es correcto en `main`/`eed027b0`. Se deja como
  regresión permanente (`BMP-9`).
  Test: `src/__tests__/whatsapp/BulkMessagingPage.test.tsx` (`BMP-9`).

- [x] **T1 — `campaignPollInterval` (función pura)** (`src/hooks/useBulkMessaging.ts`): extraída de
  `useCampaign`, cubre las 7 ramas (visible/oculto × running/pending/paused/done/failed/undefined).
  Test: `src/__tests__/hooks/useBulkMessaging.test.ts` (`MBH-9`).

- [x] **T2 — `useCampaign` usa `campaignPollInterval`**: `pending`/`paused` pasan de `false` a
  `30_000`; `running` se mantiene en `5_000`; terminal/oculto en `false`.
  Tests: `MBH-5` (nuevos casos pending/paused visible+oculto).

- [x] **T3 — `useCampaigns` (historial) gana polling 30s** gateado por `useDocumentVisible`.
  Tests: `MBH-6` (visible pollea, oculto no pollea — reemplaza el viejo caso "NO pollea").

- [x] **T4 — Wording del 409 en `SendCampaignButton`**: de "otra campaña enviándose" a "envío en
  curso en el servidor" (más preciso dado el lock stuck real en prod), sin decir "tu campaña".
  Tests: `SCB-7` (wording actualizado + nuevo caso de persistencia con fake timers 4s+).

- [x] **T5 — Verificación (sin cambio de código)**: error genérico visible (`SCB-8`, ya existía) e
  invalidación inmediata post-success cubriendo `includeRecipients` (`MBH-4`, ya existía —
  `invalidateQueries` con key-prefijo matchea por defecto `exact:false`).

## Cierre

- [x] Tests tocados verdes: `useBulkMessaging.test.ts` (36), `SendCampaignButton.test.tsx` (10),
  `CampaignDetail.test.tsx` (6), `BulkMessagingPage.test.tsx` (10) — 62 tests, 4 archivos, todos
  en verde.
- [x] `npx tsc --noEmit` en el worktree — sin errores.

## Fix Wave (review adversarial, 2026-07-16)

Hallazgos verificados sobre `f69067e2`, aplicados TDD (test rojo → fix). Ver
`specs/bulk-detail-polling/spec.md` (Requirements POLL-4/POLL-5/POLL-6, nuevos) para el contrato.

- [x] **HIGH-1 — polling opt-in de `useCampaigns`**: `refetchInterval: visible ? 30_000 : false`
  estaba SIEMPRE activo en el hook COMPARTIDO — `WhatsappInboxPage` lo usa para el dropdown de
  filtro de campaña del inbox y heredaba el poll sin pedirlo (~2880 req/día extra por agente con
  el inbox abierto). Fix: 3er parámetro `poll` (default `false`); SOLO `CampaignsTable` lo activa.
  El inbox queda exactamente como estaba (fetch on-mount + invalidación, sin poll).
  Tests: `useBulkMessaging.test.ts` (MBH-6, nuevo caso default sin poll + 2 casos actualizados con
  `poll:true` explícito).

- [x] **MEDIUM-2 — tab-gating del poll con `mountMode="all"`**: `CampaignsTable`/`CampaignDetail`
  quedan MONTADOS detrás del tab "Nueva campaña" y seguían polleando en segundo plano. Fix:
  `BulkMessagingPage` propaga `active={activeTab === 'history'}` → `CampaignsTable` (combinado con
  `poll` de HIGH-1) y `CampaignDetail` (que lo re-propaga a `CampaignHeader`/`RecipientsTable`, y
  a su propio `useCampaign`). `useCampaign`/`useCampaigns` combinan `active && visible` en el gate
  del poll — el fetch on-mount inicial NO cambió. Tests: `useBulkMessaging.test.ts` (MBH-5, 3 casos
  nuevos de `active`), `CampaignsTable.test.tsx` (CT-8), `CampaignDetail.test.tsx` (CD-7),
  `BulkMessagingPage.test.tsx` (BMP-10, integración: cambiar de tab apaga el poll del detalle
  oculto).

- [x] **MEDIUM-3 — `RecipientsTable` (variante pesada) pollea `pending`/`paused` sin necesidad**:
  los recipients de una campaña que no arrancó/está pausada son INMUTABLES. Fix:
  `campaignPollInterval(status, visible, { heavy })` — heavy (`includeRecipients:true`) solo
  pollea en `running` (5s); pending/paused → `false`. La key liviana del header (30s) es la que
  detecta la transición a `running`. Tests: `useBulkMessaging.test.ts` (MBH-9 heavy branches,
  MBH-10 nuevo describe con la variante pesada de `useCampaign`).

- [x] **MEDIUM-4 — BMP-9 mal titulado**: prometía "repro del bug de prod" pero es una guardia de
  wiring (api mockeada, sin lazy import ni permisos reales). Renombrado + comentario honesto:
  guardia del doble-confirm → `sendCampaign`, NO repro de bundle stale/bloqueo client-side. El bug
  de prod real se cerró por otra vía — ver sección "Root cause" más abajo.

- [x] **LOW-5 — BMP-9 sin asserts de cardinalidad**: agregado
  `expect(sendCampaign).not.toHaveBeenCalled()` antes del confirm final y
  `toHaveBeenCalledTimes(1)` al final.

- [ ] **LOW-6 — deuda, ver sección "Deudas" abajo** (NO se arregla en este change).

- [x] Tests tocados verdes tras el Fix Wave: `useBulkMessaging.test.ts` (48), `CampaignsTable.test.tsx`
  (9), `RecipientsTable.test.tsx` (7), `CampaignDetail.test.tsx` (13), `CampaignHeader.test.tsx` (5),
  `SendCampaignButton.test.tsx` (10), `CreateCampaignConfirmModal.test.tsx` (19),
  `WhatsappInboxPage.test.tsx` + `WhatsappInboxPage.layout.test.tsx`, `BulkMessagingPage.test.tsx`
  (11) — 187 tests, 10 archivos, todos en verde.
- [x] `npx tsc --noEmit` en el worktree tras el Fix Wave — sin errores.

## Root cause del incidente de prod — crear ≠ enviar (scope adicional, 2026-07-16)

Cerrado EN VIVO con el usuario: el "bug" del POST `/send` que nunca salía era **UX, no código**.
El operador creaba la campaña (el modal de creación, `CreateCampaignConfirmModal`, ya muestra un
resumen de impacto — "vas a afectar a N clientes" — que SE SIENTE como una confirmación de envío),
aterrizaba en el detalle con status `pending` y creía que la campaña ya estaba enviada. Nunca
clickeaba "Enviar campaña". Las hipótesis de extensión de browser / bundle stale quedaron
DESCARTADAS con 3 repros Playwright verdes contra prod (el POST salió perfecto cuando se ejecutó la
acción real).

Fixes (TDD, mismo worktree/commit wave):
- [x] **Banner de estado en `pending`**: `CampaignDetail` muestra un callout (`role="status"`,
  ícono SVG `aria-hidden`, nunca solo-color) cuando `status==='pending'`: "Esta campaña todavía no
  se envió. Cuando estés listo, apretá «Enviar campaña»." Desaparece en cualquier otro estado.
  Tests: `CampaignDetail.test.tsx` (CD-8, 5 casos — visible en pending, ausente en
  running/paused/done/failed).
- [x] **Copy del modal de creación**: `CreateCampaignConfirmModal` agrega una línea al final del
  resumen (`dl.summary`): "La campaña se crea en estado **Pendiente** — el envío se dispara
  después, desde el detalle, con el botón «Enviar campaña»." Estructura/a11y existente sin tocar.
  Tests: `CreateCampaignConfirmModal.test.tsx` (CCM-14).

## Deudas

- [ ] **LOW-6 — fuga de red preexistente (`ECONNREFUSED :3000`) en tests de `BulkMessagingPage.test.tsx`**:
  algún componente bajo esa page dispara un fetch/XHR real hacia `localhost:3000` durante los
  tests (ruido en stderr, NO hace fallar la suite — los tests igual pasan). Preexistente desde
  antes de este change (base `eed027b0`). NO se investiga/arregla acá — anotado para un change
  aparte. Hallazgo LOW-6 del review adversarial del Fix Wave (2026-07-16).
