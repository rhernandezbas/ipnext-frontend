# Tasks — combo-balance-honesto (FRONTEND)

**Strict TDD**: rojo → verde → refactor. Ningún `[x]` de implementación sin su test rojo
antes. Runner: `npx vitest run`. Gate de tipos: `npm run typecheck`.
**Nunca** correr `prettier` ni `npm run build` en este repo.

Fases independientes entre sí salvo lo indicado: **F0 bloquea todo lo visual**;
**FA** (balance) y **FB** (reconcile) son paralelizables; **FG** cierra.

---

## F0 — Design system (BLOQUEANTE, antes de tocar UI o CSS)

- [ ] 0.1 `python .claude/skills/ui-ux-pro-max/scripts/search.py "customer balance card
      states unknown/credit/settled/debt + stale indicator + sync status badge, React CSS
      Modules design tokens" --design-system`
- [ ] 0.2 Anotar en este archivo las reglas que la skill devuelva y **conciliarlas con la
      tabla de tokens del design §8**. Si contradicen, gana la skill → enmendar `design.md`
      antes de escribir CSS
- [ ] 0.3 Confirmar los tokens elegidos existen en `src/tokens/variables.css`
      (`--badge-late-*`, `--badge-paid-*`, `--color-warning-*`, `--color-text-secondary`,
      `--color-danger`) — si falta alguno, **no inventar hex**: proponer el token

## FA1 — Limpieza del contrato de tipos (`Customer`)

- [ ] 1.1 **Guard de la clase, no la instancia**: `rg 'balanceOverdue|invoicesQty' src` y
      anotar TODAS las ocurrencias (esperadas: `types/customer.ts`, `InfoTab.tsx`,
      `InfoTab.test.tsx`, `InfoTab.module.css`). Si aparece una quinta, entra al alcance
- [ ] 1.2 Rojo `src/__tests__/customers/clientDetail.contract.test.tsx`: fixture calcado de
      `GET /api/clients/:id` (anotar el `file:line` del BE que lo produce) con los 3
      valores de `balanceDue` (`null` / `65722.07` / `-5000`) × `balanceStale` ×
      `lastBalanceAt`; assert de **presencia** de los campos vivos + `@ts-expect-error`
      sobre `balanceOverdue` — TYPE-1
- [ ] 1.3 Verde `src/types/customer.ts:165-169`: `+balanceStale?: boolean`,
      `−balanceOverdue`, `−invoicesQty`. **No** agregar `balanceCurrency`
- [ ] 1.4 `npm run typecheck` — debe romper SOLO en `InfoTab.tsx:271-284` y
      `InfoTab.test.tsx` (las ramas y tests muertos). Cualquier otro error = consumidor no
      auditado, volver a 1.1
- [ ] 1.5 Borrar `InfoTab.test.tsx:103-108` completo y las asserts de overdue/qty de
      `:46-71`. Razón en el commit: *certificaban un payload que el BE nunca emitió*
- [ ] 1.6 `rg` de 1.1 otra vez: 0 ocurrencias

## FA2 — `balanceState` (helper puro, una sola fuente de verdad)

- [ ] 2.1 Rojo `src/__tests__/utils/balanceState.test.ts`: `null`/`undefined`→`unknown`,
      `-5000`→`credit{5000}`, `0`→`settled`, `65722.07`→`debt{65722.07}`,
      **`NaN`→`unknown`** (la basura cae al lado seguro, no a `debt`)
- [ ] 2.2 Verde `src/utils/balanceState.ts` (design §1). Discrimina por VALOR (`== null`,
      `< 0`, `=== 0`), jamás por truthiness

## FA3 — `BalanceCard` — 4 estados (depende de FA1+FA2+F0)

- [ ] 3.1 Rojo `InfoTab.test.tsx`: `balanceDue: null` → "Saldo no disponible", sin
      "Sin deuda"/"Deudor"/monto — CARD-1 (reescribe el test existente `:73-80`, que hoy
      afirma lo contrario)
- [ ] 3.2 Rojo: `balanceDue` ausente ≡ `null`, mismo testid — CARD-1
- [ ] 3.3 Rojo: el estado `unknown` expone texto accesible con el porqué — CARD-1
- [ ] 3.4 Rojo: `0`→"Sin deuda"; `65722.07`→badge "Deudor"+monto; `-5000`→"Saldo a favor"
      con `5.000` y SIN badge "Deudor" ni "Sin deuda"; exclusividad mutua de los 4 testids
      — CARD-2
- [ ] 3.5 Verde `InfoTab.tsx` `BalanceCard`: consume `balanceState()`, una rama por estado.
      **Muere el `formatARS(balanceDue!)`** — el estrechamiento sale del discriminante
- [ ] 3.6 Rojo: `lastBalanceAt` de hace 5 min → "Actualizado hace …";
      `lastBalanceAt: 'no-es-una-fecha'` → **cero "NaN"** y marca omitida;
      `lastBalanceAt: null` → sin marca — CARD-3
- [ ] 3.7 Verde `formatRelativeTime` → `string | null` con guard `Number.isFinite` sobre el
      timestamp parseado; el llamador omite el bloque
- [ ] 3.8 Rojo: `balanceStale:true` + `due:1000` → indicador con TEXTO;
      `false`→ausente; campo ausente→ausente y sin crash;
      `balanceStale:true` + `due:null` → **NO** se muestra (gana "no disponible") — CARD-4
- [ ] 3.9 Verde: chip de stale en el header de la card (icono + texto), gateado por
      `balanceDue != null`
- [ ] 3.10 Verde `InfoTab.module.css:202-274`: los 6 hex crudos → tokens (design §8);
      `.balanceOverdue` se elimina; nuevas `.balanceUnknown` / `.balanceCredit` /
      `.balanceStaleChip` con `var(--*)`

## FA4 — Sub-header de `CustomerDetailPage` (depende de FA2+F0)

- [ ] 4.1 Rojo `CustomerDetailPage.test.tsx`: `balanceDue: null` → NO aparece `$ 0,00`,
      aparece el marcador de no disponible con explicación accesible; `0` → monto cero
      real — HEADER-1
- [ ] 4.2 Rojo: `5000` → negativo y NO etiquetado "a favor"; `-5000` → etiquetado "a favor"
      y distinguible del anterior **sin mirar el color** — HEADER-2
- [ ] 4.3 Rojo: `rg 'as \{ balanceDue' src/pages/customers/CustomerDetailPage.tsx` → 0 —
      HEADER-3
- [ ] 4.4 Verde `:28-31` + `:186-187`: fuera el cast estructural, fuera el `formatBalance`
      que devuelve `'$ 0,00'` para `null`, dentro `balanceState()` + `<MaybeValue>` para
      `unknown` + sufijo "a favor" para `credit`
- [ ] 4.5 Verde `CustomerDetailPage.module.css`: `.subHeaderBalanceValue--credit` (color de
      refuerzo con token; el canal informativo es el texto)

## FA5 — Hook del inbox

- [ ] 5.1 Rojo: contexto con `client` **sin** `balance` → sin throw, `staleBalance` falso,
      el query de refresco NO se dispara — INBOX-1
- [ ] 5.2 Verde `useWhatsapp.ts:876`: `?.client?.balance?.stale`

## FA6 — No-regresión de los consumidores fuera de alcance

- [ ] 6.1 Test `FinancialSection` con `balance.due: null` → "Saldo no disponible", sin
      "Al día"/"Debe" — NOREG-1
- [ ] 6.2 Test `TemplateSendPanel` con `balance.due: null` → fuente "Monto de deuda"
      deshabilitada — NOREG-1
- [ ] 6.3 Test/assert: `rg 'balanceDue' src/pages/customers/MisClientesPage.tsx` → 0
      (usa `PortfolioItem.debtAmount`) — NOREG-1
- [ ] 6.4 Ninguno de los 3 archivos de producción se modifica (verificar en el diff final)

## FB1 — Tipos de `financeGrowth` (paralelo a FA)

- [ ] 7.1 Rojo: fixture calcado de `GET /api/finance/growth/sync/status` con
      `activeLane: 'reconcile'` + los 7 campos; `@ts-expect-error` sobre el fixture al que
      se le quita `sweepInProgress` — TYPE-1
- [ ] 7.2 Verde `src/types/financeGrowth.ts:214`: union +`'reconcile'`; +bloque `reconcile`
      calcado de `application/dto/financeGrowth.dto.ts:87-95` (campos requeridos)
- [ ] 7.3 `npm run typecheck` — los fixtures existentes de
      `FinanceGrowthOverviewPage.test.tsx:295-306` van a romper por falta de `reconcile`:
      completarlos, NO relajar el tipo

## FB2 — Panel de sync: `running` + badge (depende de FB1+F0)

- [ ] 8.1 Rojo: `sweepInProgress:true` + `pendingPages:false` → botón "Sincronizando…"
      deshabilitado; `pendingPages:true` (no-regresión); ambos false + `enabled:true` →
      habilitado; `enabled:false` gana igual — RUN-1
- [ ] 8.2 Verde `FinanceGrowthOverviewPage.tsx:53`: `running` = `pendingPages ||
      reconcile?.sweepInProgress`, ambos con `?? false`
- [ ] 8.3 Rojo: `lastResult` con prefijo `error:` + `degraded:false` → estado dedicado con
      el mensaje, sin "Sincronización al día" y **sin** "Ritmo degradado";
      `'page ok @200'` → nada; `null` → nada; `enabled:false` + error → gana
      "Ingesta apagada" — ERR-1
- [ ] 8.4 Rojo: status **sin** la propiedad `reconcile` → sin excepción, `running` cae a
      `pendingPages`, sin badge de error — ERR-2
- [ ] 8.5 Verde `:64-73`: cadena de precedencia del design §7 (apagada > error reconcile >
      degradado > al día), dentro del `aria-live="polite"` existente
- [ ] 8.6 Verde `FinanceGrowthOverviewPage.module.css`: `.syncLaneError` con
      `var(--color-danger)` — **no** reusar `.syncDegraded`

## FC — Accesibilidad y contraste (depende de FA3+FA4+FB2)

- [ ] 9.1 Rojo `src/__tests__/customers/InfoTab.contrast.test.tsx` (molde
      `FinancialSection.contrast.test.tsx`): lee el CSS crudo, resuelve los tokens contra
      `src/tokens/variables.css`, calcula el ratio WCAG 2.1 de cada par nuevo/migrado y
      exige ≥ 4.5:1 — A11Y-1 (A)
- [ ] 9.2 Rojo: ninguna declaración `color`/`background(-color)` de las reglas `.balance*`
      contiene un literal `#RRGGBB` — A11Y-1 (A). **El test MUST filtrar comentarios CSS
      antes de matchear** (los comentarios de este change citan hex)
- [ ] 9.3 Rojo: mismo par de asserts para `.syncLaneError` — A11Y-1 (B)
- [ ] 9.4 Rojo: cada uno de los 4 estados de la card, y el badge de error, es identificable
      **sólo por su texto** — A11Y-1 (A y B)
- [ ] 9.5 Verde: ajustar tokens hasta que los 3 rojos pasen

## FG — Gate (antes de merge)

- [ ] G.1 `npx vitest run` **completo** en verde. Verificar el **conteo de suites** antes de
      leer fallos: si sube por encima de lo esperado, `jest`/`vitest` está barriendo
      worktrees residuales — no diagnosticar sobre código viejo
- [ ] G.2 `npm run typecheck` sin errores (incluye los `@ts-expect-error`, que fallan si el
      error que esperan desaparece)
- [ ] G.3 Un fallo de timeout con varios procesos pesados en paralelo es **contención**, no
      regresión: re-correr el suite caído solo antes de tocar una línea. Un fallo
      SEMÁNTICO nunca es contención
- [ ] G.4 **Revert-probe**: revertir cada fix de a uno y confirmar que su test se pone
      rojo. Un test que pasa con el código PRE-fix no está protegiendo nada
- [ ] G.5 `rg 'balanceOverdue|invoicesQty' src` → 0; `rg 'as \{ balanceDue' src` → 0;
      `rg '#[0-9a-fA-F]{6}' src/pages/customers/tabs/InfoTab.module.css` → sólo dentro de
      comentarios (o 0)
- [ ] G.6 Verificar en el diff que `App.tsx`, `Sidebar.tsx`, `FinancialSection.tsx`,
      `TemplateSendPanel.tsx`, `MisClientesPage.tsx` y `src/api/*` NO están tocados
- [ ] G.7 Smoke Playwright: `/admin/customers/view/:id` de un cliente **sin `grClienteId`**
      (debe decir "Saldo no disponible" en card y sub-header) y de un deudor real;
      `/admin/finance-growth` con el panel de sync
- [ ] G.8 Borrar cualquier `__probe_*.test.ts` que dejen los revisores

---

## Matriz scenario → tarea (48 scenarios)

### `customer-balance-display` (31)

| Requirement | Scenario | Tarea |
|---|---|---|
| TYPE-1 | shape real typechequea y renderiza | 1.2 / 1.3 |
| TYPE-1 | `balanceDue: null` es contrato | 1.2 |
| TYPE-1 | `balanceDue` negativo es contrato | 1.2 |
| TYPE-1 | campos muertos ya no asignables | 1.2 / 1.3 |
| TYPE-1 | cero referencias residuales | 1.1 / 1.6 / G.5 |
| CARD-1 | `null` → "no disponible" | 3.1 / 3.5 |
| CARD-1 | ausente ≡ `null` | 3.2 / 3.5 |
| CARD-1 | explica el porqué (accesible) | 3.3 / 3.5 |
| CARD-2 | cero medido | 3.4 / 3.5 |
| CARD-2 | deuda | 3.4 / 3.5 |
| CARD-2 | saldo a favor distinguible | 3.4 / 3.5 |
| CARD-2 | los 4 estados son excluyentes | 3.4 / 3.5 |
| CARD-3 | marca relativa con fecha válida | 3.6 / 3.7 |
| CARD-3 | fecha inválida no imprime NaN | 3.6 / 3.7 |
| CARD-3 | sin `lastBalanceAt` no hay marca | 3.6 / 3.7 |
| CARD-4 | dato viejo se avisa con texto | 3.8 / 3.9 |
| CARD-4 | dato fresco no molesta | 3.8 / 3.9 |
| CARD-4 | `balanceStale` ausente ≡ fresco | 3.8 / 3.9 |
| CARD-4 | sin dato no se avisa de dato viejo | 3.8 / 3.9 |
| HEADER-1 | sin dato no afirma cero | 4.1 / 4.4 |
| HEADER-1 | cero medido sí es cero | 4.1 / 4.4 |
| HEADER-2 | deuda en negativo | 4.2 / 4.4 |
| HEADER-2 | crédito etiquetado "a favor" | 4.2 / 4.4 / 4.5 |
| HEADER-3 | rename rompe el typecheck | 4.3 / 4.4 |
| INBOX-1 | `client` sin `balance` no rompe | 5.1 / 5.2 |
| NOREG-1 | `FinancialSection` honesto con `null` | 6.1 |
| NOREG-1 | `TemplateSendPanel` deshabilita fuente | 6.2 |
| NOREG-1 | `MisClientesPage` no usa `balanceDue` | 6.3 |
| A11Y-1 | cero hex crudo | 9.2 / 3.10 |
| A11Y-1 | contraste AA calculado | 9.1 / 9.5 |
| A11Y-1 | el estado se lee sin color | 9.4 |

### `finance-sync-lane-visibility` (17)

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
| ERR-1 | resultado exitoso no dispara error | 8.3 / 8.5 |
| ERR-1 | `lastResult: null` no dispara nada | 8.3 / 8.5 |
| ERR-1 | precedencia: kill-switch gana | 8.3 / 8.5 |
| ERR-1 | aviso dentro de `aria-live` | 8.5 |
| ERR-2 | status sin `reconcile` no rompe | 8.4 / 8.2 / 8.5 |
| A11Y-1 | cero hex crudo en la regla nueva | 9.3 / 8.6 |
| A11Y-1 | contraste AA calculado | 9.3 / 9.5 |
| A11Y-1 | se distingue sin color | 9.4 / 8.5 |

---

## Known constraints

- **F0 es bloqueante**: sin la corrida de `ui-ux-pro-max`, cualquier CSS que se escriba es
  un hallazgo de review garantizado.
- El copy de los estados nuevos es un default razonable (design §Open Questions) —
  ajustable en apply sin re-planificar.
- El cuarto estado de la card (saldo a favor, tarea 3.4/3.5) es una **extensión deliberada**
  del alcance cerrado; si el orquestador la veta, se caen 3.4-parcial + 3.5-parcial y la
  card queda con 3 estados. Nada más del plan depende de eso.
- `--color-danger` sobre blanco pasa AA por 3 centésimas (4.53:1): si el apply cambia el
  fondo del panel de sync, 9.3 lo caza — no bajar el umbral, cambiar el token.
