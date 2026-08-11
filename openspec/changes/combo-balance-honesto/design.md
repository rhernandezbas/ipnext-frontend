# Design — combo-balance-honesto (FRONTEND)

Anclas **verificadas contra el código real** de este worktree y del BE en prod, no contra
la memoria del review:

| Ancla | Estado |
|---|---|
| `src/types/customer.ts:165-169` (`balanceDue`/`balanceOverdue`/`invoicesQty`/`lastBalanceAt`) | ✅ exacto |
| `src/pages/customers/tabs/InfoTab.tsx:229-293` (`formatARS`, `formatRelativeTime`, `BalanceCard`) | ✅ exacto; `formatARS(balanceDue!)` en `:268`, ramas muertas `:271-284` |
| `src/pages/customers/tabs/InfoTab.module.css:202-274` | ✅ 6 hex crudos (`#fee2e2 #991b1b #dc2626 #b91c1c #dcfce7 #166534`) |
| `src/pages/customers/CustomerDetailPage.tsx:28-31` (`formatBalance`) / `:186-187` (cast + signo) | ✅ exacto |
| `src/hooks/useWhatsapp.ts:876` (`query.data?.client?.balance.stale`) | ✅ exacto |
| `src/types/financeGrowth.ts:214` (`activeLane`) / `:208-242` (bloque) | ✅ exacto |
| `src/pages/finance-growth/FinanceGrowthOverviewPage.tsx:53` (`running`) / `:64-73` (badge) | ✅ exacto |
| `FinancialSection.tsx:54-58` (patrón `—` + label) | ✅ exacto |
| BE `PrismaCustomerRepository.toCustomer():29-91` | ✅ emite `balanceDue|null`, `balanceCurrency`, `lastBalanceAt`, `balanceStale`; **NO** emite `balanceOverdue`/`invoicesQty` |
| BE `clients.routes.ts:165-182` | ✅ `res.json(customer)` — entidad cruda, sin DTO intermedio |
| BE `application/dto/financeGrowth.dto.ts:60-95` | ✅ `activeLane` con `'reconcile'` + los 7 campos del bloque |
| BE `SyncGrReceiptsReconcileWindow.ts:159-227` | ✅ `lastResult` con prefijo `error:` en abort del guard, abandono y fallo genérico |
| BE `parseGrDebtStrict()` (`GestionRealClient.ts:594+`) | ✅ preserva el signo → `balanceDue < 0` es real |

**Drift encontrado vs. el brief**: `useWhatsapp.ts:876` no es un componente del panel sino
`useInboxClientContext`; el hop faltante alimenta `staleBalance`, que **gatea un segundo
query** (`enabled: enabled && staleBalance`). O sea: no es cosmético, un throw ahí mata el
hook antes de que ningún `ErrorBoundary` de render lo vea. Todo lo demás coincide.

---

## 1. Modelo de estados — el corazón del change

Un solo `number | null` codifica **cuatro** estados de negocio. Hoy el FE los colapsa a
dos (`> 0` vs. "todo lo demás"), y ese colapso es exactamente la mentira:

| Valor | Estado | Hoy se ve como | Debe verse como |
|---|---|---|---|
| `null` / ausente | Sin dato verificado | "Sin deuda ✓" / `$ 0,00` | "Saldo no disponible" |
| `< 0` | Saldo a favor | card: "Sin deuda ✓" · header: `-$ 5.000` (idéntico a una deuda) | "Saldo a favor $ 5.000" |
| `0` | Cero medido | "Sin deuda ✓" | "Sin deuda ✓" (correcto) |
| `> 0` | Deuda | "Deudor $ X" | "Deudor $ X" (correcto) |

**El discriminador MUST ser el valor, no la truthiness.** `if (balanceDue)` colapsa `0`
con `null` y es el patrón que produjo el bug original. La forma canónica del change:

```ts
type BalanceState =
  | { kind: 'unknown' }
  | { kind: 'credit'; amount: number }   // valor absoluto
  | { kind: 'settled' }
  | { kind: 'debt'; amount: number };

function balanceState(due: number | null | undefined): BalanceState {
  if (due == null || !Number.isFinite(due)) return { kind: 'unknown' };
  if (due < 0) return { kind: 'credit', amount: Math.abs(due) };
  if (due === 0) return { kind: 'settled' };
  return { kind: 'debt', amount: due };
}
```

El `!Number.isFinite(due)` no es paranoia decorativa: un `NaN` que se cuele por el JSON
caería en `due < 0 === false` y `due === 0 === false` ⇒ se renderizaría como **deuda de
`NaN`**. La basura tiene que caer al lado SEGURO ("no sé"), no al lado que afirma.

### Decision 1 — dónde vive `balanceState`

| Opción | Pro | Contra |
|---|---|---|
| **(A) helper local en `InfoTab.tsx`** | cero superficie nueva | `CustomerDetailPage` lo duplica ⇒ el clásico "la función que decide no es la que se testea" |
| **(B) `src/utils/balanceState.ts` + test propio** | una sola fuente para los dos consumidores; testeable como función pura | +1 archivo |

**Elegida: (B)**. Los dos lugares que renderizan saldo tienen que coincidir en el
significado de un `-5000`; si el helper se duplica, el próximo fix arregla una copia. El
precedente del repo es explícito: `formatMoney` se extrajo de `FinancialSection` a
`utils/` justo para que `TemplateSendPanel` resolviera el mismo número.

---

## 2. BalanceCard (`InfoTab`) — 4 estados

Container-presentational: `BalanceCard` sigue siendo un sub-componente presentacional de
`InfoTab`, recibe el `Customer` y no fetchea nada. Estructura (una rama por estado, con
`data-testid` estable para cada una):

```
┌ Saldo deudor ──────────── Actualizado hace 5 min · [⚠ desactualizado] ┐
│  · unknown  →  —  Saldo no disponible                                 │
│  · credit   →  [A favor]  $ 5.000                                     │
│  · settled  →  ✓ Sin deuda                                            │
│  · debt     →  [Deudor]   $ 65.722,07                                 │
└───────────────────────────────────────────────────────────────────────┘
```

`data-testid`: `balance-unknown` · `balance-credit` · `balance-no-debt` (se **conserva** el
nombre existente para no romper tests ajenos) · `balance-amount` (se conserva).

### Decision 2 — el estado `unknown` en la card

| Opción | Pro | Contra |
|---|---|---|
| **(A) markup local calcado de `FinancialSection.tsx:54-58`** | consistencia visual con el HERO del inbox, que ya resuelve este caso; la card necesita layout propio (badge + monto grande) | duplica ~4 líneas de JSX |
| (B) reusar el atom `MaybeValue` | cero duplicación | `MaybeValue` renderiza un `<span>` inline con `—`; la card necesita `—` grande + label debajo, se terminaría luchando con el atom |

**Elegida: (A)** para la card, **(B) para el sub-header** (§3) — que es exactamente el
caso de uso del atom: un `number | null` con `format`. No es incoherencia: son dos formas
distintas del mismo estado, y el atom sólo cubre bien una.

### Decision 3 — indicador de `balanceStale`

| Opción | Pro | Contra |
|---|---|---|
| (A) pintar el timestamp en color de warning | mínimo | **estado sólo-color** ⇒ viola `ui-ux-pro-max` y es invisible para daltónicos y en captura B/N |
| **(B) chip con icono + texto ("desactualizado") junto al timestamp** | cumple la regla; el operador entiende sin decodificar | +1 elemento en el header de la card |

**Elegida: (B)**. El chip **no se muestra con `balanceDue == null`**: "no hay dato" y "el
dato está viejo" juntos se contradicen en pantalla, y para un cliente sin `grClienteId` el
BE manda `balanceStale: true` permanentemente (nunca se refresca) — sería el mismo "flag
que grita siempre" que el BE ya arregló bajando el TTL de las bajas a 26h.

### Decision 4 — `formatRelativeTime` con fecha inválida

Firma actual: `(isoDate: string) => string`, sin guard ⇒ `new Date('x').getTime()` es
`NaN` ⇒ `Math.floor(NaN)` es `NaN` ⇒ `"hace NaN d"`.

Nueva firma: `(isoDate: string) => string | null`, con
`if (!Number.isFinite(t)) return null` inmediatamente después del parseo; el llamador omite
el bloque entero cuando es `null` (mismo `&&` que ya usa para `lastBalanceAt`). Se descartó
devolver un string `"fecha inválida"`: mostrar un error de datos en la UI del cliente no le
sirve a nadie; la ausencia sí es honesta.

---

## 3. Sub-header de `CustomerDetailPage`

Hoy (`:186-187`):

```ts
const balanceDue = (customer as { balanceDue?: number | null }).balanceDue ?? null;
const balance = balanceDue && balanceDue > 0 ? -balanceDue : balanceDue;
```

Tres defectos en dos líneas: el cast estructural anula el type-check, el `balanceDue &&`
usa truthiness (colapsa `0` con `null`), y el `: balanceDue` deja pasar el crédito con su
signo original ⇒ **deuda 5.000 y crédito 5.000 renderizan idénticos**.

### Decision 5 — convención de signo

| Opción | Pro | Contra |
|---|---|---|
| (A) invertir a "deuda positiva, crédito negativo" | matemáticamente más intuitivo | cambia el número que el operador viene leyendo hace meses, en la vista más usada del sistema; riesgo alto para cero valor de negocio |
| **(B) conservar el signo actual + etiqueta de texto que desambigua el crédito** | cero cambio de hábito; el crédito deja de ser ambiguo | dos elementos donde había uno |

**Elegida: (B)**. Render:

- `unknown` → `<MaybeValue value={null} label="saldo de la cuenta" unknownReason="el cliente no está vinculado a Gestión Real o su saldo nunca se sincronizó" />`
- `settled` → `$ 0,00`
- `debt` → `-$ 65.722,07`
- `credit` → `$ 5.000,00` + `<span>a favor</span>`

El color por signo es **refuerzo**, nunca el canal: la clase `.subHeaderBalanceValue--credit`
sólo cambia el color; quien distingue es la palabra "a favor".

---

## 4. Eliminación de `balanceOverdue` / `invoicesQty`

Verificado en el BE: no existen en `domain/entities/customer.ts` ni los produce
`toCustomer()`. Verificado en el FE: los únicos consumidores son `InfoTab.tsx:271-284` y
`InfoTab.test.tsx:46-71,103-108` — y los tests **fabrican las props a mano**, o sea
certifican un payload que ningún servidor emitió jamás. Es cobertura fantasma con forma de
red de seguridad.

Se borran: tipo, ramas, CSS (`.balanceOverdue`, `.balanceRow*` si quedan huérfanas) y los
dos tests, con la razón en el mensaje del commit. La alternativa "dejar el tipo, sacar sólo
las ramas" se descartó: un tipo que declara campos que el servidor nunca manda es una
trampa para el próximo que escriba una feature confiando en él.

**Guard de la fix-wave**: la tarea 1.1 corre `rg 'balanceOverdue|invoicesQty' src` antes de
borrar y después — arreglamos la CLASE (todo el par de campos), no la instancia señalada.

---

## 5. `useWhatsapp.ts:876`

```diff
- const staleBalance = query.data?.client?.balance.stale === true;
+ const staleBalance = query.data?.client?.balance?.stale === true;
```

Un carácter. Importa porque `staleBalance` gatea `balanceQuery` (`enabled: enabled &&
staleBalance`): con un `client` sin `balance`, el throw ocurre en el **cuerpo del hook**,
antes de cualquier render — no hay `isError` que lo capture, se cae el panel entero.

---

## 6. Tipos de `financeGrowth` — calco del DTO

Se agrega, calcado campo a campo de `application/dto/financeGrowth.dto.ts:87-95`:

```ts
activeLane: 'delta' | 'reconcile' | 'backfill' | 'idle';
// …
/** gr-receipt-annulment — tercer carril (barrido de anulaciones). */
reconcile: {
  lastRunAt: string | null;
  lastResult: string | null;
  itemsSynced: number;
  sweepInProgress: boolean;
  windowFrom: string | null;
  windowTo: string | null;
  pageOffset: number;
};
```

### Decision 6 — requerido vs. opcional

| Opción | Pro | Contra |
|---|---|---|
| (A) `reconcile?: {...}` | tolera un BE viejo sin ceremonia | el `?` se propaga a TODA lectura y normaliza la mentira: el BE **sí** lo manda siempre |
| **(B) requerido + lecturas defensivas con `?.`** | el tipo dice la verdad sobre prod; el runtime sobrevive un deploy escalonado | hay que acordarse de los `?.` (queda pineado por un scenario, ERR-2) |

**Elegida: (B)**. El tipo describe el contrato; el `?.` describe la ventana de despliegue.
Son cosas distintas y no deben confundirse en la misma herramienta.

---

## 7. Panel de sync — `running` y precedencia del badge

```ts
const running = (status?.delta.pendingPages ?? false) || (status?.reconcile?.sweepInProgress ?? false);
const reconcileError = status?.reconcile?.lastResult?.startsWith('error:') ?? false;
```

`startsWith('error:')` es el discriminador porque **el BE lo escribe así en las tres ramas
de falla** del carril (`SyncGrReceiptsReconcileWindow.ts:209,227`). Se descartó parsear el
sufijo `[barrido ABANDONADO …]` para distinguir abort-simple de abandono: es texto humano
sin contrato, y regexearlo es exactamente el antipatrón que el BE ya eliminó de su lado
(la racha del guard pasó de "regex sobre `lastResult`" a estado persistido explícito). El
FE muestra el mensaje **completo** y deja que el operador lea.

### Decision 7 — precedencia del badge

Cuatro estados accionables, uno solo visible. Orden por **costo de ignorarlo**:

| # | Condición | Texto | Clase |
|---|---|---|---|
| 1 | `!pacing.enabled` | ● Ingesta apagada | `.syncDisabled` (existente) |
| 2 | `reconcileError` | ● Reconciliación con error — `{lastResult}` | `.syncLaneError` (**nueva**) |
| 3 | `pacing.degraded` | ● Ritmo degradado | `.syncDegraded` (existente) |
| 4 | resto | ● Sincronización al día | `.syncOk` (existente) |

El kill-switch va primero porque congela **todos** los carriles: un error del reconcile es
información secundaria cuando nada está corriendo. Se descartó reusar `.syncDegraded`
(mismo color, mismo texto): `degraded` mide backoff por fallas hacia GR y `reconcileError`
mide una falla del guard de anulaciones — mostrarlos iguales es precisamente el bug.

Todo sigue dentro del `aria-live="polite"` existente (`:65`); no se agrega un `role`
nuevo. El botón sigue teniendo `min-height: 44px` (`:76`).

---

## 8. Tokens y contraste (ratios **calculados**, WCAG 2.1, no estimados)

Los hex crudos de hoy tienen token exacto en `src/tokens/variables.css`:

| Regla | Hoy (crudo) | Token | Ratio calculado |
|---|---|---|---|
| `.balanceDebtorBadge` bg/fg | `#fee2e2` / `#991b1b` | `--badge-late-bg` / `--badge-late-fg` | **6.80:1** ✅ |
| `.balanceAmount` | `#dc2626` | `--badge-late-fg` (`#991b1b`) | 4.83 → **8.31:1** ✅ |
| `.balanceCheckIcon` bg/fg | `#dcfce7` / `#166534` | `--badge-paid-bg` / `--badge-paid-fg` | **6.49:1** ✅ |
| `.balanceOverdue` | `#b91c1c` | — | se **elimina** con la rama |
| `.balanceUnknown` (nueva) | — | `--color-text-secondary` (`#6c757d`) s/ blanco | **4.69:1** ✅ |
| `.balanceCredit` (nueva) | — | `--badge-paid-fg` (`#166534`) s/ blanco | **7.13:1** ✅ |
| `.balanceStaleChip` (nueva) | — | `--color-warning-bg` / `--color-warning-fg` | **6.37:1** ✅ |
| `.syncLaneError` (nueva) | — | `--color-danger` (`#dc3545`) s/ blanco | **4.53:1** ✅ |

Notas honestas: `#dc2626` **no** falla AA (4.83:1) — el problema es que es hex crudo y
diverge del rojo que `FinancialSection` ya usa para el mismo concepto. Y `--color-danger`
pasa por 3 centésimas: si el apply cambia el fondo del panel, el test de contraste lo caza.
El crédito reusa el verde "al día" del inbox — es el mismo significado de negocio.

`ui-ux-pro-max` es **tarea 0 del apply** (bloqueante, antes de tocar una línea de CSS):
`python .claude/skills/ui-ux-pro-max/scripts/search.py "<contexto>" --design-system`. Si
sus reglas contradicen esta tabla, gana la skill y se enmienda el design.

---

## 9. Testing (Vitest + RTL, Strict TDD)

| Capa | Archivo | Qué cubre |
|---|---|---|
| Unit puro | `src/__tests__/utils/balanceState.test.ts` | los 4 estados + `NaN`/`undefined` → `unknown` |
| Contrato | `src/__tests__/customers/clientDetail.contract.test.tsx` | fixture **calcado** de `GET /api/clients/:id` (los 3 valores de `balanceDue` × `balanceStale` × `lastBalanceAt`) renderizado por `InfoTab` |
| Componente | `src/__tests__/customers/InfoTab.test.tsx` | CARD-1..4 |
| Página | `src/__tests__/customers/CustomerDetailPage.test.tsx` | HEADER-1..3 (mocks de hooks ya montados en el archivo) |
| Hook | `src/__tests__/hooks/useWhatsapp*.test.ts` | INBOX-1 |
| Panel | `src/pages/finance-growth/FinanceGrowthOverviewPage.test.tsx` | RUN-1, ERR-1/2 (fixture `FinanceSyncStatusResponse` ya existe en `:295-306`) |
| Contraste | `src/__tests__/customers/InfoTab.contrast.test.tsx` | lee el CSS crudo + resuelve tokens contra `tokens/variables.css` y calcula el ratio — molde `FinancialSection.contrast.test.tsx` |
| Tipos | los `.contract.test.tsx` con `@ts-expect-error` | TYPE-1 (A) y TYPE-1 (B), gateados por `npm run typecheck` |

**El fixture de contrato es innegociable** (lección `e2e-envelope-mock-mismatch`): un test
que inventa las props no caza un mismatch de shape. El fixture se copia de la respuesta
real y se anota con el `file:line` del BE que la produce.

**Sobre `@ts-expect-error`**: es un assert invertido — pasa cuando el error EXISTE. Si
alguien re-agrega `balanceOverdue` al tipo, el directive queda sin usar y `tsc` falla. Es
la única forma de testear una **ausencia** de tipo, y cumple la lección "probe de ausencia
no discrimina" porque el mismo archivo asserta primero la PRESENCIA de los campos vivos.

---

## 10. Archivos

**Modificados** (9): `src/types/customer.ts` · `src/types/financeGrowth.ts` ·
`src/pages/customers/tabs/InfoTab.tsx` + `.module.css` ·
`src/pages/customers/CustomerDetailPage.tsx` + `.module.css` ·
`src/hooks/useWhatsapp.ts` · `src/pages/finance-growth/FinanceGrowthOverviewPage.tsx` +
`.module.css`.

**Nuevos** (4): `src/utils/balanceState.ts` · `src/__tests__/utils/balanceState.test.ts` ·
`src/__tests__/customers/clientDetail.contract.test.tsx` ·
`src/__tests__/customers/InfoTab.contrast.test.tsx`.

**Tests modificados** (3): `InfoTab.test.tsx` (borra 2, reescribe 1) ·
`CustomerDetailPage.test.tsx` · `FinanceGrowthOverviewPage.test.tsx`.

**No se toca**: `App.tsx` (cero rutas), `Sidebar.tsx`, `FinancialSection.tsx`,
`TemplateSendPanel.tsx`, `MisClientesPage.tsx`, `src/api/*`, ningún hook de datos.

## 11. Migración / Rollout

Sin migración: FE puro, sin estado persistido, sin feature flag. El BE ya emite todo lo
que este change consume desde el 2026-08-10. `git revert` restaura el comportamiento
anterior por completo.

**No correr `prettier`** en este repo bajo ninguna circunstancia (no hay `.prettierrc`;
aplica sus defaults y reformatea el archivo entero, sepultando el cambio real).

## Open Questions

- [ ] **Saldo a favor en la `BalanceCard`** (CARD-2, cuarto estado): el brief cerró "de 2 a
  3 estados" y el crédito sólo estaba pedido para el sub-header. Se incluyó igual porque es
  el **mismo hermano del mismo bug** (`fix-wave: arreglar la clase, no la instancia`) y
  cuesta ~6 líneas + 1 test; sin él la card muestra "Sin deuda ✓" ante un crédito, ocultando
  plata a favor del cliente. **Vetable por el orquestador** sin tocar nada más del plan.
- [ ] Copy exacto de los estados nuevos ("Saldo no disponible" / "Saldo a favor" /
  "desactualizado" / "Reconciliación con error"): default razonable, ajustable en apply.
- [ ] `FinancialSection` con `balance.due < 0` muestra "Al día" con un monto negativo
  (el BE deriva `isDebtor: due != null && due > 0`, `GetInboxClientContext.ts:225`). No es
  una mentira (no debe nada) pero oculta el crédito. **Fuera de alcance** de este change
  — anotado como candidato a un follow-up de una línea.
