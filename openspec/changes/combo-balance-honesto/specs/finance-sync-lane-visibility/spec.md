# Spec — finance-sync-lane-visibility (new capability)

RFC-2119. Cada scenario MUST estar cubierto por al menos un test Vitest + Testing Library
(o por `npm run typecheck`, en los de tipo). Capability nueva: se documenta completa.

**Contexto**: el ingest de cobranza del BE (`FinanceReceiptIngestScheduler`) tiene ahora
**tres** carriles + reposo: `delta` (cobranza reciente), `reconcile` (barrido de
anulaciones, `gr-receipt-annulment`), `backfill` (histórico) e `idle`. El FE tipa sólo
`'delta' | 'backfill' | 'idle'` y no conoce el bloque `reconcile`, así que un barrido en
curso se lee como "sistema quieto" y un ABORT del guard de anulaciones se lee como
"ritmo degradado" genérico.

---

## Capability: contrato de tipos con `/api/finance/growth/sync/status`

### Requirement: TYPE-1 — `FinanceSyncStatusResponse` es un calco del DTO del BE
`src/types/financeGrowth.ts` MUST extender `pacing.activeLane` a
`'delta' | 'reconcile' | 'backfill' | 'idle'` y MUST declarar el bloque `reconcile` con
**exactamente** los 7 campos del DTO en prod
(`ipnext-backend/src/application/dto/financeGrowth.dto.ts:87-95`):
`lastRunAt: string | null`, `lastResult: string | null`, `itemsSynced: number`,
`sweepInProgress: boolean`, `windowFrom: string | null`, `windowTo: string | null`,
`pageOffset: number`. Los campos MUST ser requeridos (el BE ya los emite siempre).

#### Scenario: la respuesta real typechequea
- **GIVEN** un fixture calcado de la respuesta real de `GET /api/finance/growth/sync/status`
  con `activeLane: 'reconcile'` y el bloque `reconcile` completo
- **WHEN** se tipa como `FinanceSyncStatusResponse`
- **THEN** `tsc --noEmit` pasa

#### Scenario: un campo faltante del bloque rompe el typecheck
- **GIVEN** el mismo fixture al que se le quita `sweepInProgress`, con `// @ts-expect-error`
- **WHEN** se corre `tsc --noEmit`
- **THEN** pasa — probando que el campo es requerido; si alguien lo vuelve opcional, el
  `@ts-expect-error` queda sin usar y el typecheck FALLA

#### Scenario: `'reconcile'` es un `activeLane` válido
- **GIVEN** `pacing.activeLane = 'reconcile'`
- **WHEN** se tipa como `FinanceSyncStatusResponse`
- **THEN** `tsc --noEmit` pasa (hoy no compila: el union no lo incluye)

---

## Capability: estado "sincronizando" del panel

### Requirement: RUN-1 — un barrido de reconcile en curso cuenta como sincronización activa
`SyncControls` (`FinanceGrowthOverviewPage.tsx:53`) MUST derivar `running` de
`delta.pendingPages` **O** `reconcile.sweepInProgress`. Con `running` verdadero el botón
MUST estar deshabilitado y mostrar "Sincronizando…". Hoy sólo mira `delta.pendingPages`,
así que un barrido de reconcile de varias páginas deja el botón habilitado y el operador
dispara trabajo sobre un carril que ya está corriendo.

#### Scenario: barrido de reconcile en curso deshabilita el botón
- **GIVEN** un status con `delta.pendingPages: false` y `reconcile.sweepInProgress: true`
- **WHEN** se renderiza el panel con permiso `finance.sync`
- **THEN** el botón dice "Sincronizando…" y está deshabilitado

#### Scenario: páginas pendientes del delta siguen deshabilitando (no-regresión)
- **GIVEN** un status con `delta.pendingPages: true` y `reconcile.sweepInProgress: false`
- **WHEN** se renderiza el panel
- **THEN** el botón dice "Sincronizando…" y está deshabilitado

#### Scenario: sin carriles activos el botón se puede usar
- **GIVEN** un status con `delta.pendingPages: false`, `reconcile.sweepInProgress: false`
  y `pacing.enabled: true`
- **WHEN** se renderiza el panel
- **THEN** el botón dice "Sincronizar ahora" y está habilitado

#### Scenario: el kill-switch sigue ganando sobre el estado de carril
- **GIVEN** un status con `pacing.enabled: false` y `reconcile.sweepInProgress: false`
- **WHEN** se renderiza el panel
- **THEN** el botón está deshabilitado y su `title` menciona que la ingesta está apagada

---

## Capability: falla del carril de reconcile

### Requirement: ERR-1 — un ABORT del guard se lee como lo que es, no como "ritmo degradado"
Cuando `reconcile.lastResult` empieza con `error:` el badge de estado MUST mostrar un
estado dedicado que **incluya el mensaje** de `lastResult`. El BE escribe ahí tanto el
abort del guard de anulaciones (`error: … [aborts consecutivos del guard en este barrido:
N]`) como el abandono del barrido (`error: … [barrido ABANDONADO tras N aborts …]`) y
cualquier fallo de red (`error: ${err.message}`) —
`SyncGrReceiptsReconcileWindow.ts:209,227`. Hoy nada de eso llega a la UI: el operador ve
"Ritmo degradado" (que mide backoff hacia GR) o incluso "Sincronización al día".

#### Scenario: error del reconcile se muestra con su mensaje
- **GIVEN** un status con `reconcile.lastResult` = `'error: guard abort … [aborts
  consecutivos del guard en este barrido: 2]'`, `pacing.enabled: true` y
  `pacing.degraded: false`
- **WHEN** se renderiza el panel
- **THEN** se ve un estado de error del reconcile que incluye el texto del `lastResult`, y
  NO se ve "Sincronización al día"

#### Scenario: el estado de error NO se confunde con "ritmo degradado"
- **GIVEN** el mismo status del scenario anterior (`degraded: false`)
- **WHEN** se renderiza el panel
- **THEN** NO aparece el texto "Ritmo degradado" — son dos condiciones distintas con dos
  causas distintas

#### Scenario: un resultado exitoso no dispara el estado de error
- **GIVEN** un status con `reconcile.lastResult` = `'page ok @200'`
- **WHEN** se renderiza el panel
- **THEN** no se muestra el estado de error del reconcile

#### Scenario: `lastResult: null` (nunca corrió) no dispara nada
- **GIVEN** un status con `reconcile.lastResult: null`
- **WHEN** se renderiza el panel
- **THEN** no se muestra el estado de error del reconcile y el badge cae en el estado que
  corresponda por `pacing`

#### Scenario: precedencia — el kill-switch apagado gana
- **GIVEN** un status con `pacing.enabled: false` **y** `reconcile.lastResult` con prefijo
  `error:`
- **WHEN** se renderiza el panel
- **THEN** se muestra "Ingesta apagada" (el estado accionable de mayor prioridad) y NO se
  muestra "Sincronización al día"

#### Scenario: el aviso llega al lector de pantalla
- **GIVEN** un status con error del reconcile
- **WHEN** el contenedor de estado se actualiza por el polling de 15s
- **THEN** el cambio ocurre dentro de la región `aria-live="polite"` ya existente

### Requirement: ERR-2 — tolerancia a un BE sin el bloque `reconcile`
Las lecturas del bloque MUST ser defensivas en runtime (`status?.reconcile?.…` con
default), aunque el tipo lo declare requerido. Durante un deploy escalonado el FE nuevo
puede hablar con un BE que todavía no emite `reconcile`, y un `TypeError` en el cuerpo del
componente tira la página entera de finanzas.

#### Scenario: status sin bloque `reconcile` no rompe la página
- **GIVEN** una respuesta de status **sin** la propiedad `reconcile` (BE anterior)
- **WHEN** se renderiza el panel
- **THEN** no se lanza ninguna excepción, `running` cae a `delta.pendingPages` y el estado
  de error del reconcile no se muestra

---

## Capability: accesibilidad del badge de estado

### Requirement: A11Y-1 — token propio, contraste calculado y estado no sólo-color
El estado de error del reconcile MUST usar un token `var(--*)` propio (MUST NOT reusar la
clase `.syncDegraded`, que significa otra cosa), con contraste **calculado** ≥ 4.5:1
contra el fondo real, y MUST identificarse por su **texto** — el punto `●` de color no
puede ser el único diferenciador.

#### Scenario: cero hex crudo en las reglas nuevas
- **GIVEN** `FinanceGrowthOverviewPage.module.css`
- **WHEN** se lee la regla del estado de error del reconcile
- **THEN** su `color` referencia `var(--…)`, no un literal `#RRGGBB`

#### Scenario: contraste AA calculado
- **GIVEN** el token de color del estado nuevo resuelto contra `src/tokens/variables.css`
  y el fondo del panel
- **WHEN** se calcula el ratio WCAG 2.1
- **THEN** da ≥ 4.5:1

#### Scenario: el estado se distingue sin color
- **GIVEN** el badge en estado de error del reconcile
- **WHEN** se inspecciona sólo su contenido textual
- **THEN** el texto por sí solo identifica el estado (no depende del color del `●`)
