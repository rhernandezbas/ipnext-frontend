# Tasks — combo-balance-honesto (FRONTEND)

**Strict TDD**: rojo → verde → refactor. Ningún `[x]` de implementación sin su test rojo
antes. Runner: `npx vitest run`. Gate de tipos: `npm run typecheck`.
**Nunca** correr `prettier` ni `npm run build` en este repo.

Fases independientes entre sí salvo lo indicado: **F0 bloquea todo lo visual**;
**FA** (balance) y **FB** (reconcile) son paralelizables; **FG** cierra.
**FX** es el fix wave posterior al review adversarial de 2 revisores.

---

## F0 — Design system (BLOQUEANTE, antes de tocar UI o CSS)

- [x] 0.1 `python .claude/skills/ui-ux-pro-max/scripts/search.py "customer balance card
      states unknown/credit/settled/debt + stale indicator + sync status badge, React CSS
      Modules design tokens" --design-system` — se corrió desde el repo FE principal
      (el worktree no tiene la skill)
- [x] 0.2 Reglas devueltas por la skill, conciliadas con la tabla de tokens del design §8:
      el grueso de su salida fue una recomendación genérica de landing nueva (paleta
      índigo, Archivo/Space Grotesk) **irrelevante para un panel admin interno**. Las
      únicas reglas aplicables —(a) indicador de estado = icono + TEXTO, nunca sólo
      emoji/color, (b) contraste mínimo 4.5:1, (c) foco visible— YA coincidían con el
      plan de tokens existentes del design §8, así que **no hubo que enmendar** `design.md`.
      Registrado en engram (`sdd/combo-balance-honesto/apply-progress`)
- [x] 0.3 Confirmar los tokens elegidos existen en `src/tokens/variables.css`
      (`--badge-late-*`, `--badge-paid-*`, `--color-warning-*`, `--color-text-secondary`,
      `--color-danger`) — verificado: no se inventó ningún hex

## FA1 — Limpieza del contrato de tipos (`Customer`)

- [x] 1.1 **Guard de la clase, no la instancia**: `rg 'balanceOverdue|invoicesQty' src` y
      anotar TODAS las ocurrencias (esperadas: `types/customer.ts`, `InfoTab.tsx`,
      `InfoTab.test.tsx`, `InfoTab.module.css`). Si aparece una quinta, entra al alcance
- [x] 1.2 Rojo `src/__tests__/customers/clientDetail.contract.test.tsx`: fixture calcado de
      `GET /api/clients/:id` con los 3 valores de `balanceDue` (`null` / `65722.07` /
      `-5000`) × `balanceStale` × `lastBalanceAt`; assert de **presencia** de los campos
      vivos + `@ts-expect-error` sobre `balanceOverdue` — TYPE-1
- [x] 1.3 Verde `src/types/customer.ts`: `+balanceStale?: boolean`, `−balanceOverdue`,
      `−invoicesQty`. **No** se agregó `balanceCurrency`
- [x] 1.4 `npm run typecheck` — rompió sólo en las ramas y tests muertos
- [x] 1.5 Borradas las asserts de overdue/qty de `InfoTab.test.tsx`
- [x] 1.6 `rg` de 1.1 otra vez: 0 ocurrencias
      *(FX14 convirtió este `rg` manual en un guard automático: un `rg` que nadie vuelve a
      correr no protege nada — ver `src/__tests__/guards/no-dead-balance-fields.test.ts`)*

## FA2 — `balanceState` (helper puro, una sola fuente de verdad)

- [x] 2.1 Rojo `src/__tests__/utils/balanceState.test.ts`: `null`/`undefined`→`unknown`,
      `-5000`→`credit{5000}`, `0`→`settled`, `65722.07`→`debt{65722.07}`,
      **`NaN`→`unknown`**
- [x] 2.2 Verde `src/utils/balanceState.ts` (design §1). Discrimina por VALOR

## FA3 — `BalanceCard` — 4 estados (depende de FA1+FA2+F0)

- [x] 3.1 Rojo `InfoTab.test.tsx`: `balanceDue: null` → "Saldo no disponible" — CARD-1
- [x] 3.2 Rojo: `balanceDue` ausente ≡ `null`, mismo testid — CARD-1
- [x] 3.3 Rojo: el estado `unknown` expone texto accesible con el porqué — CARD-1
- [x] 3.4 Rojo: `0`→"Sin deuda"; `65722.07`→badge "Deudor"+monto; `-5000`→"Saldo a favor";
      exclusividad mutua de los 4 testids — CARD-2
- [x] 3.5 Verde `InfoTab.tsx` `BalanceCard`: consume `balanceState()`, una rama por estado
- [x] 3.6 Rojo: `lastBalanceAt` válido / inválido / `null` — CARD-3
- [x] 3.7 Verde `formatRelativeTime` → `string | null` con guard `Number.isFinite`
- [x] 3.8 Rojo: `balanceStale` × `balanceDue` (4 combinaciones) — CARD-4
- [x] 3.9 Verde: chip de stale en el header de la card (icono + texto), gateado
- [x] 3.10 Verde `InfoTab.module.css`: los 6 hex crudos → tokens; `.balanceOverdue` se
      elimina; nuevas `.balanceUnknown` / `.balanceCredit` / `.balanceStaleChip`

## FA4 — Sub-header de `CustomerDetailPage` (depende de FA2+F0)

- [x] 4.1 Rojo `CustomerDetailPage.test.tsx`: `null` → sin `$ 0,00`; `0` → cero real — HEADER-1
- [x] 4.2 Rojo: `5000` → negativo sin "a favor"; `-5000` → "a favor" — HEADER-2
- [x] 4.3 Rojo: `rg 'as \{ balanceDue' src/pages/customers/CustomerDetailPage.tsx` → 0 — HEADER-3
- [x] 4.4 Verde: fuera el cast estructural y el `formatBalance` que devolvía `'$ 0,00'`
      para `null`; dentro `balanceState()` + `<MaybeValue>` + sufijo "a favor"
- [x] 4.5 Verde `CustomerDetailPage.module.css`: color de refuerzo para el crédito
      *(rehecho en FX2/FX3: el color pasó a ser POR ESTADO y el hex crudo se fue)*

## FA5 — Hook del inbox

- [x] 5.1 Rojo: contexto con `client` **sin** `balance` → sin throw, `staleBalance` falso —
      INBOX-1
- [x] 5.2 Verde `useWhatsapp.ts`: `?.client?.balance?.stale`
      *(el fix estaba INCOMPLETO: arreglaba el hook y dejaba a los consumidores
      explotando con el MISMO fixture — ver FX1)*

## FA6 — No-regresión de los consumidores fuera de alcance

- [x] 6.1 Test `FinancialSection` con `balance.due: null` → "Saldo no disponible" — NOREG-1
- [x] 6.2 Test `TemplateSendPanel` con `balance.due: null` → fuente deshabilitada — NOREG-1
- [x] 6.3 `rg 'balanceDue' src/pages/customers/MisClientesPage.tsx` → 0 — NOREG-1
- [x] 6.4 ~~Ninguno de los 3 archivos de producción se modifica~~ **INVALIDADA por FX1**:
      la premisa era falsa. `FinancialSection.tsx` y `TemplateSendPanel.tsx` leían
      `balance.due` sin guard y se caían con el fixture del propio fix de 5.2 — el caso
      testeado en 6.1/6.2 era `due: null` (bloque presente), no `balance` ausente. Los dos
      archivos SÍ se tocan; ver FX1

## FB1 — Tipos de `financeGrowth` (paralelo a FA)

- [x] 7.1 Rojo: fixture calcado de `GET /api/finance/growth/sync/status` con
      `activeLane: 'reconcile'` + los 7 campos; `@ts-expect-error` sobre el fixture
      mutilado — TYPE-1
- [x] 7.2 Verde `src/types/financeGrowth.ts`: union +`'reconcile'`; +bloque `reconcile`
- [x] 7.3 `npm run typecheck` — fixtures existentes completados, sin relajar el tipo

## FB2 — Panel de sync: `running` + badge (depende de FB1+F0)

- [x] 8.1 Rojo: las 4 combinaciones de `sweepInProgress`/`pendingPages`/`enabled` — RUN-1
- [x] 8.2 Verde: `running` = `pendingPages || reconcile?.sweepInProgress`, ambos con `?? false`
- [x] 8.3 Rojo: prefijo `error:` / `'page ok @200'` / `null` / `enabled:false` — ERR-1
- [x] 8.4 Rojo: status **sin** la propiedad `reconcile` → sin excepción — ERR-2
- [x] 8.5 Verde: cadena de precedencia dentro del `aria-live="polite"` existente
      *(enmendada en FX5: el error del reconcile ya no se come el "Ritmo degradado")*
- [x] 8.6 Verde `FinanceGrowthOverviewPage.module.css`: `.syncLaneError` con `--color-danger`

## FC — Accesibilidad y contraste (depende de FA3+FA4+FB2)

- [x] 9.1 Rojo `src/__tests__/customers/InfoTab.contrast.test.tsx`: ratio WCAG 2.1
      calculado de cada par nuevo/migrado ≥ 4.5:1 — A11Y-1 (A)
- [x] 9.2 Rojo: cero hex crudo en las reglas `.balance*`, filtrando comentarios — A11Y-1 (A)
      *(ampliado en FX13 a `border`/`outline`)*
- [x] 9.3 Rojo: mismo par de asserts para `.syncLaneError` — A11Y-1 (B)
- [x] 9.4 Rojo: cada estado identificable sólo por su texto — A11Y-1 (A y B)
      *(el crédito NO lo estaba: el test miraba el monto y no el badge "A favor" — FX8)*
- [x] 9.5 Verde: tokens ajustados hasta que los rojos pasen

## FG — Gate (antes de merge)

- [x] G.1 `npx vitest run` **completo** en verde, verificando el conteo de suites
- [x] G.2 `npm run typecheck` sin errores
- [x] G.3 Un timeout bajo contención no es regresión — re-correr el suite solo
- [x] G.4 **Revert-probe**: 16 probes ejecutados en el fix wave, todos MUEREN (tabla en el
      reporte de FX). El apply no los había corrido
- [x] G.5 `rg 'balanceOverdue|invoicesQty' src` → 0 *(ahora automatizado, FX14)*;
      `rg 'as \{ balanceDue' src` → 0
- [x] G.6 ~~Verificar que `FinancialSection.tsx` / `TemplateSendPanel.tsx` NO están
      tocados~~ **REESCRITA**: los dos SÍ se tocan (FX1, bloqueante). Lo que se verifica
      es que `App.tsx`, `Sidebar.tsx`, `MisClientesPage.tsx` y `src/api/*` siguen intactos
- [ ] G.7 Smoke Playwright: `/admin/customers/view/:id` sin `grClienteId` + un deudor real;
      `/admin/finance-growth` con el panel de sync — **pendiente** (requiere entorno vivo)
- [x] G.8 Borrar cualquier `__probe_*.test.ts` que dejen los revisores — 0 residuales

---

## FX — Fix wave (review adversarial de 2 revisores, ambos FIX-FIRST)

Cada ítem: rojo visto (revert-probe sobre el código pre-fix) → fix → verde → probe.

- [x] FX1 **CRITICAL** — `FinancialSection.tsx` y `TemplateSendPanel.tsx` toleran `balance`
      ausente (fixture EXACTO del test de FA5). Fix de la CLASE + test de componente por
      consumidor. Barrido de terceros consumidores (`rg` de `.balance` en `src/`): sólo
      esos dos; `useWhatsapp.ts:894` escribe, no lee
- [x] FX2 **HIGH** — se fue el `#16a34a` crudo (3.30:1, FALLA AA) del sub-header + nace
      `CustomerDetailPage.contrast.test.tsx` con TODAS las reglas nuevas, incl.
      `.subHeaderBalanceCredit` (7.13:1), que no tenía test
- [x] FX3 **HIGH** — el valor del sub-header toma color POR ESTADO con los MISMOS tokens
      que la card (deuda `--badge-late-fg`, crédito y cero `--badge-paid-fg`, unknown
      `--color-text-secondary`); test de clase-por-estado en los 4 + contraste calculado
- [x] FX4 — el guard `state.kind !== 'unknown'` que tenía el chip de stale ahora también
      gatea la marca "Actualizado hace …" (fin de "Saldo no disponible · Actualizado hace 2 h")
- [x] FX5 — "Reconciliación con error" y "Ritmo degradado" COEXISTEN (señales ortogonales);
      `apagada` sigue ganando sobre todo. Spec enmendado (el scenario fijaba `degraded:false`,
      o sea el caso degenerado)
- [x] FX6 — el sub-header muestra "⚠ Desactualizado" (icono + TEXTO) cuando
      `balanceStale === true` y el estado ≠ unknown, reusando el patrón del chip de la card
- [x] FX7 — el título de la card deja de ser "Saldo deudor" (coronaba créditos y ceros) y
      pasa a "Saldo de la cuenta", el mismo rótulo del sub-header
- [x] FX8 (R2 MUT-3) — el test del crédito assertea el TEXTO "A favor", no sólo el monto;
      los 4 estados quedan pineados por texto explícitamente
- [x] FX9 (R2 MUT-6) — sin bloque `reconcile` + `pendingPages: false` ⇒ botón HABILITADO
      (el lado `false` del default no estaba pineado)
- [x] FX10 (R2 MUT-4 + R1 L9) — `'sweep ok, 0 errors'` NO pinta error (pin del prefijo) y
      el match del prefijo pasa a case-insensitive
- [x] FX11 (R2 MUT-9) — HEADER-1 assertea el TEXTO real del `unknownReason`, no el
      boilerplate de `MaybeValue`
- [x] FX12 (R2 F6) — el sub-header con `0` NO contiene "a favor"
- [x] FX13 (R2 F7) — el hex-scan de los contrast tests cubre `border`/`outline`, + un test
      que prueba que el scan efectivamente ve una declaración de borde (si no, sería vacuo)
- [x] FX14 (R2 F8) — guard estático `no-dead-balance-fields`: 0 ocurrencias VIVAS de
      `balanceOverdue|invoicesQty` en `src/` (filtra comentarios)
- [x] FX15 — este archivo refleja el estado REAL + la matriz incorpora los scenarios nuevos

---

## Matriz scenario → tarea (48 scenarios originales + 8 del fix wave)

### `customer-balance-display` (31 + 6)

| Requirement | Scenario | Tarea |
|---|---|---|
| TYPE-1 | shape real typechequea y renderiza | 1.2 / 1.3 |
| TYPE-1 | `balanceDue: null` es contrato | 1.2 |
| TYPE-1 | `balanceDue` negativo es contrato | 1.2 |
| TYPE-1 | campos muertos ya no asignables | 1.2 / 1.3 |
| TYPE-1 | cero referencias residuales | 1.1 / 1.6 / G.5 / **FX14** |
| CARD-1 | `null` → "no disponible" | 3.1 / 3.5 |
| CARD-1 | ausente ≡ `null` | 3.2 / 3.5 |
| CARD-1 | explica el porqué (accesible) | 3.3 / 3.5 |
| CARD-2 | cero medido | 3.4 / 3.5 |
| CARD-2 | deuda | 3.4 / 3.5 |
| CARD-2 | saldo a favor distinguible | 3.4 / 3.5 / **FX8** |
| CARD-2 | los 4 estados son excluyentes | 3.4 / 3.5 |
| CARD-3 | marca relativa con fecha válida | 3.6 / 3.7 |
| CARD-3 | fecha inválida no imprime NaN | 3.6 / 3.7 |
| CARD-3 | sin `lastBalanceAt` no hay marca | 3.6 / 3.7 |
| CARD-3 | **sin DATO no hay marca de frescura** (nuevo) | **FX4** |
| CARD-4 | dato viejo se avisa con texto | 3.8 / 3.9 |
| CARD-4 | dato fresco no molesta | 3.8 / 3.9 |
| CARD-4 | `balanceStale` ausente ≡ fresco | 3.8 / 3.9 |
| CARD-4 | sin dato no se avisa de dato viejo | 3.8 / 3.9 |
| CARD-5 | **el título no presupone deuda** (nuevo) | **FX7** |
| HEADER-1 | sin dato no afirma cero | 4.1 / 4.4 |
| HEADER-1 | cero medido sí es cero | 4.1 / 4.4 |
| HEADER-1 | **la razón del "no disponible" es la real** (nuevo) | **FX11** |
| HEADER-2 | deuda en negativo | 4.2 / 4.4 |
| HEADER-2 | crédito etiquetado "a favor" | 4.2 / 4.4 / 4.5 |
| HEADER-2 | **el cero NO dice "a favor"** (nuevo) | **FX12** |
| HEADER-3 | rename rompe el typecheck | 4.3 / 4.4 |
| HEADER-4 | **color por estado, consistente con la card** (nuevo) | **FX2 / FX3** |
| HEADER-5 | **frescura visible en el sub-header** (nuevo) | **FX6** |
| INBOX-1 | `client` sin `balance` no rompe el hook | 5.1 / 5.2 |
| INBOX-1 | **… ni a sus CONSUMIDORES** (nuevo) | **FX1** |
| NOREG-1 | `FinancialSection` honesto con `null` | 6.1 |
| NOREG-1 | `TemplateSendPanel` deshabilita fuente | 6.2 |
| NOREG-1 | `MisClientesPage` no usa `balanceDue` | 6.3 |
| A11Y-1 | cero hex crudo (color/fondo/**borde**) | 9.2 / 3.10 / **FX13** |
| A11Y-1 | contraste AA calculado | 9.1 / 9.5 / **FX2** |
| A11Y-1 | el estado se lee sin color | 9.4 / **FX8** |

### `finance-sync-lane-visibility` (17 + 2)

| Requirement | Scenario | Tarea |
|---|---|---|
| TYPE-1 | respuesta real typechequea | 7.1 / 7.2 |
| TYPE-1 | campo faltante rompe el typecheck | 7.1 / 7.2 |
| TYPE-1 | `'reconcile'` es `activeLane` válido | 7.1 / 7.2 |
| RUN-1 | barrido en curso deshabilita | 8.1 / 8.2 |
| RUN-1 | `pendingPages` sigue deshabilitando | 8.1 / 8.2 |
| RUN-1 | sin carriles activos, habilitado | 8.1 / 8.2 |
| RUN-1 | kill-switch gana | 8.1 / 8.5 |
| ERR-1 | error se muestra con su mensaje | 8.3 / 8.5 |
| ERR-1 | NO se confunde con "ritmo degradado" | 8.3 / 8.5 / 8.6 |
| ERR-1 | **las dos señales COEXISTEN** (enmendado) | **FX5** |
| ERR-1 | **el prefijo se matchea sin importar la caja** (nuevo) | **FX10** |
| ERR-1 | resultado exitoso no dispara error | 8.3 / 8.5 / **FX10** |
| ERR-1 | `lastResult: null` no dispara nada | 8.3 / 8.5 |
| ERR-1 | precedencia: kill-switch gana | 8.3 / 8.5 / **FX5** |
| ERR-1 | aviso dentro de `aria-live` | 8.5 |
| ERR-2 | status sin `reconcile` no rompe | 8.4 / 8.2 / 8.5 |
| ERR-2 | **… y con `pendingPages:false` el botón queda usable** | **FX9** |
| A11Y-1 | cero hex crudo en la regla nueva | 9.3 / 8.6 |
| A11Y-1 | contraste AA calculado | 9.3 / 9.5 |
| A11Y-1 | se distingue sin color | 9.4 / 8.5 |

---

## Known constraints

- **F0 se corrió y no aportó** más que las 3 reglas que el design ya contemplaba (ver
  0.2). El refuerzo real está en el contraste **calculado** por test en las 3 hojas
  tocadas, no en la salida de la skill.
- El copy de los estados nuevos es un default razonable (design §Open Questions).
- `--color-danger` sobre blanco pasa AA por 3 centésimas (4.53:1): si cambia el fondo del
  panel de sync, 9.3 lo caza — no bajar el umbral, cambiar el token.
- **Lección del fix wave**: el `?.` de FA5 arregló el punto que el test señalaba y dejó a
  los dos consumidores del mismo payload con el mismo defecto. Arreglar la CLASE, no la
  instancia — y exigir el revert-probe de cada fix, que acá no se había corrido.
