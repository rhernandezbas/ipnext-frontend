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
