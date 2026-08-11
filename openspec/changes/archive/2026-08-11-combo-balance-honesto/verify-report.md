# Verify Report — combo-balance-honesto (FRONTEND)

**Worktree**: `.claude/worktrees/combo-balance-fe` · branch `feat/combo-balance-honesto` · HEAD `9da368ab`
**Mode**: Strict TDD (`openspec/config.yaml`: `strict_tdd: true`, runner `npx vitest run`)
**Verifier**: sdd-verify, 2026-08-11

---

## Completeness (tasks.md)

| Metric | Value |
|---|---|
| Tasks total | 84 (F0–FG core + FX1–FX15 fix wave) |
| Tasks complete `[x]` | 83 |
| Tasks incomplete `[ ]` | 1 — **G.7** Smoke Playwright (`/admin/customers/view/:id`, `/admin/finance-growth`) |

G.7 is legitimately open: it requires a live/deployed environment. Not a code-completeness gap.

---

## Build & Tests Execution

**Typecheck** (`npm run typecheck` = `tsc --noEmit`): ✅ clean, 0 errors.

**Targeted matrix suites** (13 files touching every scenario in the compliance matrix below, run isolated to avoid the CPU contention from the orchestrator's parallel full-suite run):

```
Test Files  13 passed (13)
     Tests  208 passed (208)
  Duration  29.22s
```
Zero failures, zero skips, across: `balanceState.test.ts`, `clientDetail.contract.test.tsx`,
`InfoTab.test.tsx`, `InfoTab.contrast.test.tsx`, `CustomerDetailPage.test.tsx`,
`CustomerDetailPage.contrast.test.tsx`, `useWhatsapp.test.ts`, `no-dead-balance-fields.test.ts`,
`financeSyncStatus.contract.test.ts`, `FinanceGrowthOverviewPage.test.tsx`,
`FinanceGrowthOverviewPage.contrast.test.tsx`, `FinancialSection.test.tsx`, `TemplateSendPanel.test.tsx`.

**Full suite** (`npx vitest run`, no filter): completed after ~833s (14min — abnormally slow due to
documented CPU contention with the orchestrator's own parallel full-suite run on the same worktree;
duration is not a regression signal, see `suite-bajo-contención-no-es-medición`):

```
Test Files  1 failed | 717 passed (718)
     Tests  1 failed | 7855 passed | 1 todo (7857)
  Duration  833.24s
FAIL  src/__tests__/whatsapp/WhatsappReportsPage.test.tsx > ... renderiza el heatmap y las barras de resoluciones
```

This is **exactly** the documented preexisting/unrelated red (engram `sdd/combo-balance-honesto/apply-progress`,
`#2386`/`#2390`): deterministic, isolated, ancestor of the base commit `e372b2ae`, and this change touches
nothing in `WhatsappReportsPage` or its dependency graph. Confirmed NOT a flake and NOT introduced by this
change. The 1 `todo` is also pre-existing (unrelated to this change).

**Coverage**: not enforced (`coverage_threshold: 0` in config) — skipped, per config.

---

## Spec Compliance Matrix

### `customer-balance-display` — **31 scenarios** (real count in `specs/customer-balance-display/spec.md`, verified via `grep -c '#### Scenario:'`)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| TYPE-1 | shape real typechequea y renderiza | `clientDetail.contract.test.tsx` > el shape real (deudor…) typechequea | ✅ |
| TYPE-1 | `balanceDue: null` es contrato | `clientDetail.contract.test.tsx` > balanceDue null es parte del contrato | ✅ |
| TYPE-1 | `balanceDue` negativo es contrato | `clientDetail.contract.test.tsx` > balanceDue negativo… renderiza credit | ✅ |
| TYPE-1 | campos muertos ya no asignables | `clientDetail.contract.test.tsx` > campos muertos… ya NO son asignables (`@ts-expect-error` + typecheck) | ✅ |
| TYPE-1 | cero referencias residuales | `no-dead-balance-fields.test.ts` > cero ocurrencias VIVAS | ✅ |
| CARD-1 | `null` → "no disponible" | `InfoTab.test.tsx` > balanceDue: null → "Saldo no disponible" | ✅ |
| CARD-1 | ausente ≡ `null` | `InfoTab.test.tsx` > balanceDue ausente se comporta EXACTAMENTE igual | ✅ |
| CARD-1 | explica el porqué (accesible) | `InfoTab.test.tsx` > el estado "no disponible" expone texto accesible | ✅ |
| CARD-2 | cero medido | `InfoTab.test.tsx` > balanceDue: 0 → "Sin deuda" | ✅ |
| CARD-2 | deuda | `InfoTab.test.tsx` > balanceDue: 65722.07 → badge "Deudor" | ✅ |
| CARD-2 | saldo a favor distinguible | `InfoTab.test.tsx` > balanceDue: -5000 → "Saldo a favor" | ✅ |
| CARD-2 | los 4 estados excluyentes | `InfoTab.test.tsx` > los cuatro estados son mutuamente excluyentes | ✅ |
| CARD-3 | marca relativa con fecha válida | `InfoTab.test.tsx` > lastBalanceAt de hace 5 min → "Actualizado hace …" | ✅ |
| CARD-3 | fecha inválida no imprime NaN | `InfoTab.test.tsx` > lastBalanceAt inválido → CERO "NaN" en pantalla | ✅ |
| CARD-3 | sin `lastBalanceAt` no hay marca | `InfoTab.test.tsx` > sin lastBalanceAt no hay marca | ✅ |
| CARD-4 | dato viejo se avisa con texto | `InfoTab.test.tsx` > balanceDue 1000 + stale true → indicador con TEXTO | ✅ |
| CARD-4 | dato fresco no molesta | `InfoTab.test.tsx` > balanceStale: false → indicador NO presente | ✅ |
| CARD-4 | `balanceStale` ausente ≡ fresco | `InfoTab.test.tsx` > balanceStale ausente ≡ fresco | ✅ |
| CARD-4 | sin dato no se avisa de dato viejo | `InfoTab.test.tsx` > balanceDue: null + balanceStale: true → NO se avisa | ✅ |
| HEADER-1 | sin dato no afirma cero | `CustomerDetailPage.test.tsx` > HEADER-1: balanceDue null → NO aparece "$ 0,00" | ✅ |
| HEADER-1 | cero medido sí es cero | `CustomerDetailPage.test.tsx` > HEADER-1: balanceDue 0 → monto cero real | ✅ |
| HEADER-2 | deuda en negativo | `CustomerDetailPage.test.tsx` > HEADER-2: balanceDue 5000 → negativo | ✅ |
| HEADER-2 | crédito etiquetado "a favor" | `CustomerDetailPage.test.tsx` > HEADER-2: balanceDue -5000 → "a favor" | ✅ |
| HEADER-3 | rename rompe el typecheck | `grep 'as { balanceDue' CustomerDetailPage.tsx` → 0 ocurrencias (static, gate = `tsc`) | ✅ |
| INBOX-1 | `client` sin `balance` no rompe el hook | `useWhatsapp.test.ts` > INBOX-1 (combo-balance-honesto) — client SIN balance no rompe | ✅ |
| NOREG-1 | `FinancialSection` honesto con `null` | `FinancialSection.test.tsx` > due==null muestra "—" + "Saldo no disponible" | ✅ |
| NOREG-1 | `TemplateSendPanel` deshabilita fuente | `TemplateSendPanel.test.tsx` > deuda NO disponible (due:null): "Monto de deuda" deshabilitada | ✅ |
| NOREG-1 | `MisClientesPage` no usa `balanceDue` | `grep 'balanceDue' MisClientesPage.tsx` → 0 ocurrencias (static) | ✅ |
| A11Y-1 | cero hex crudo (color/fondo/borde) | `InfoTab.contrast.test.tsx` > ninguna declaración… contiene #RRGGBB | ✅ |
| A11Y-1 | contraste AA calculado | `InfoTab.contrast.test.tsx` > 6 assertions de ratio ≥4.5:1 (todas verdes) | ✅ |
| A11Y-1 | el estado se lee sin color | satisfecho por los asserts de texto de CARD-1..4 (RTL `getByText`, no toca CSS) | ✅ |

**customer-balance-display: 31/31 COMPLIANT**

Tests ALSO exist and pass for 7 fix-wave behaviors (FX1, FX2/FX3, FX4, FX6, FX7, FX11, FX12) beyond
this list — see **CRITICAL-1** below: they are not counted here because the spec text has no
corresponding `#### Scenario:` block for them.

### `finance-sync-lane-visibility` — **19 scenarios** (real count, 17 original + 2 genuinely new: FX10's case-insensitive prefix scenario is new; FX5 rewrote the degenerate-precedence scenario in place)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| TYPE-1 | respuesta real typechequea | `financeSyncStatus.contract.test.ts` > la respuesta real… typechequea | ✅ |
| TYPE-1 | campo faltante rompe el typecheck | `financeSyncStatus.contract.test.ts` > un campo faltante (sweepInProgress) rompe el typecheck | ✅ |
| TYPE-1 | `'reconcile'` es `activeLane` válido | `financeSyncStatus.contract.test.ts` > "reconcile" es un activeLane válido | ✅ |
| RUN-1 | barrido en curso deshabilita | `FinanceGrowthOverviewPage.test.tsx` > sweepInProgress:true + pendingPages:false → deshabilitado | ✅ |
| RUN-1 | `pendingPages` sigue deshabilitando | `FinanceGrowthOverviewPage.test.tsx` > delta.pendingPages: true (no-regresión) | ✅ |
| RUN-1 | sin carriles activos, habilitado | `FinanceGrowthOverviewPage.test.tsx` > sin carriles activos… "Sincronizar ahora" habilitado | ✅ |
| RUN-1 | kill-switch gana | `FinanceGrowthOverviewPage.test.tsx` > el kill-switch sigue ganando sobre el estado de carril | ✅ |
| ERR-1 | error se muestra con su mensaje | `FinanceGrowthOverviewPage.test.tsx` > prefijo "error:" → estado dedicado CON el mensaje | ✅ |
| ERR-1 | NO se confunde con "ritmo degradado" | `FinanceGrowthOverviewPage.test.tsx` > estado de error NO se confunde con "Ritmo degradado" | ✅ |
| ERR-1 | las dos señales COEXISTEN (enmendado FX5) | `FinanceGrowthOverviewPage.test.tsx` > FX5: degraded:true + error → se ven LOS DOS badges | ✅ |
| ERR-1 | prefijo case-insensitive (nuevo FX10) | `FinanceGrowthOverviewPage.test.tsx` > FX10 (R1 L9): case-INSENSITIVE | ✅ |
| ERR-1 | resultado exitoso no dispara error | `FinanceGrowthOverviewPage.test.tsx` > un resultado exitoso… NO dispara + FX10 "sweep ok, 0 errors" | ✅ |
| ERR-1 | `lastResult: null` no dispara nada | `FinanceGrowthOverviewPage.test.tsx` > lastResult: null (nunca corrió) no dispara | ✅ |
| ERR-1 | precedencia: kill-switch gana | `FinanceGrowthOverviewPage.test.tsx` > precedencia: kill-switch apagado gana + FX5 variant | ✅ |
| ERR-1 | aviso dentro de `aria-live` | `FinanceGrowthOverviewPage.test.tsx` > aviso de error vive dentro de aria-live="polite" | ✅ |
| ERR-2 | status sin `reconcile` no rompe | `FinanceGrowthOverviewPage.test.tsx` > ERR-2: status SIN el bloque reconcile no rompe | ✅ |
| ERR-2 | … y `pendingPages:false` deja el botón usable | `FinanceGrowthOverviewPage.test.tsx` > FX9 (R2 F3/MUT-6): botón queda HABILITADO | ✅ |
| A11Y-1 | cero hex crudo en la regla nueva | `FinanceGrowthOverviewPage.contrast.test.tsx` > usa un token var(--*) propio, no #RRGGBB | ✅ |
| A11Y-1 | contraste AA calculado | `FinanceGrowthOverviewPage.contrast.test.tsx` > el color resuelto cumple ≥4.5:1 | ✅ |
| A11Y-1 | se distingue sin color | satisfecho por el assert de texto de ERR-1 ("Reconciliación con error — {msg}") | ✅ |

**finance-sync-lane-visibility: 19/19 COMPLIANT**

**Compliance summary: 50/50 scenarios COMPLIANT** (against the spec text as it stands today).

---

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ⚠️ Partial | `apply-progress` (engram, `#2386`, rev.3) only carries the FINAL mini-fix-wave narrative, no structured RED/GREEN/TRIANGULATE table for the 84 tasks. `tasks.md` itself documents rojo→verde per task in prose for all of them — treated as equivalent evidence, corroborated by (a) actual test execution below and (b) 16 revert-probes claimed at G.4 |
| All tasks have tests | ✅ | every non-static task in tasks.md names its red test; matrix above confirms 50/50 scenarios have a passing test |
| RED confirmed (tests exist) | ✅ | all 13 matrix test files exist and were read directly |
| GREEN confirmed (tests pass) | ✅ | 208/208 matrix tests pass; 7855/7857 full suite pass (1 preexisting unrelated red) |
| Triangulation adequate | ✅ | multi-case tests throughout (e.g. `balanceState.test.ts` 7 cases incl. `NaN`/`Infinity`; CARD-2 tests all 4 states) |
| Safety Net for modified files | ✅ (assumed) | not independently re-verified per-file; no evidence of missing safety net found |

**TDD Compliance**: 5/6 checks fully passed, 1 partial (documentation format, not substance).

### Assertion Quality

Scanned `balanceState.test.ts`, `no-dead-balance-fields.test.ts`, `FinancialSection.test.tsx`,
`CustomerDetailPage.contrast.test.tsx`, `TemplateSendPanel.test.tsx`. No tautologies, no ghost loops,
no assertion-free tests, no orphan empty-collection checks. Contrast tests compute real WCAG ratios
against real CSS/tokens (not mocked). Component tests assert rendered text/attributes, not
implementation details (no `className` snooping, no mock-call-count-only assertions).

**Assertion quality**: ✅ All assertions verify real behavior.

---

### Correctness (Static — Structural Evidence)

| Requirement area | Status | Notes |
|---|---|---|
| `balanceState()` helper (FA2) | ✅ | verified `src/utils/balanceState.ts` — discriminates by value, `NaN`/non-finite → `unknown` |
| `BalanceCard` 4 states + FX4/FX7 gates (FA3) | ✅ | read `InfoTab.tsx:262-330` — `state.kind !== 'unknown'` gates both the stale chip and the freshness mark; title is neutral "Saldo de la cuenta" |
| Sub-header color-by-state (FX2/FX3) + reason (HEADER-1) | ✅ | confirmed via passing FX3/FX6 tests |
| Reconcile precedence (FB2 + FX5) | ✅ | read `FinanceGrowthOverviewPage.tsx:57-97` — `pacingEnabled && reconcileError` and `pacingEnabled && degraded` are independent conditions, case-insensitive `.toLowerCase().startsWith('error:')` |
| FX1 (inbox consumers tolerate missing `balance`) | ✅ | confirmed in `FinancialSection.tsx`/`TemplateSendPanel.tsx` diff + passing tests |
| HEADER-3 cast removal | ✅ | `grep 'as { balanceDue' CustomerDetailPage.tsx` → 0 |
| NOREG-1 `MisClientesPage` | ✅ | `grep 'balanceDue' MisClientesPage.tsx` → 0 |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Decision 1 — `balanceState` in `src/utils/` | ✅ Yes | |
| Decision 2 — local markup (card) / `MaybeValue` (sub-header) | ✅ Yes | |
| Decision 3 — stale chip icon+text, gated | ✅ Yes, extended | FX4 added the `unknown`-gate not in the original design text, consistent with the design's own stated rationale |
| Decision 4 — `formatRelativeTime` → `string \| null` | ✅ Yes | |
| Decision 5 — sign convention preserved + "a favor" label | ✅ Yes | |
| Decision 6 — `reconcile` required + defensive reads | ✅ Yes | |
| Decision 7 — badge precedence order | ⚠️ Amended | FX5 changed "error suppresses degraded" to "error and degraded coexist" — the *ordering* (kill-switch > error > degraded > ok) is preserved for exclusive display, but error/degraded now render **simultaneously** rather than error suppressing degraded. This is documented and intentional, not a silent drift |
| §10 Files — "No se toca: … `FinancialSection.tsx`, `TemplateSendPanel.tsx`" | ❌ Deviated | **FX1 modified both files** (confirmed via `git diff --stat main...HEAD`). `tasks.md` G.6 was explicitly rewritten to acknowledge this; `design.md` §10 itself was never amended to match (see WARNING-1) |

---

## Issues Found

**CRITICAL**:

1. **Spec/tasks contradiction — `customer-balance-display` spec text was not amended for 7 fix-wave scenarios that `tasks.md` claims are already in it.** `tasks.md`'s matrix header reads "`customer-balance-display` (31 + 6)" and tags 7 rows "(nuevo)" — CARD-3/FX4, CARD-5/FX7, HEADER-1/FX11, HEADER-2/FX12, HEADER-4/FX2+FX3, HEADER-5/FX6, INBOX-1/FX1 — implying the spec was extended to 37 scenarios. `grep -c '#### Scenario:' specs/customer-balance-display/spec.md` returns exactly **31**, unchanged from the original. None of "CARD-5", "HEADER-4", "HEADER-5" exist anywhere in the spec text (`grep` confirms zero matches), and none of the 3 other "(nuevo)" behaviors have a corresponding new `#### Scenario:` block under their existing requirement. Contrast with `finance-sync-lane-visibility`, where the same kind of claim ("17 + 2") **is accurate**: FX5 rewrote the ERR-1 precedence scenario in place with an explicit `> Enmendado en el fix wave` note, and FX10 added a genuinely new scenario with `> Agregado en el fix wave` — both visible in the spec text today. The behavior itself is real, implemented, and tested (all 7 have passing tests, confirmed above) — this is not a functional gap. It is a **documentation-integrity gap**: `customer-balance-display/spec.md` currently understates the actual contract of the code that will ship, and a reader trusting the spec alone would miss 7 real behaviors. **Recommendation**: amend `specs/customer-balance-display/spec.md` to add the 7 missing scenarios (mirroring the `> Enmendado`/`> Agregado` pattern already used successfully in the sibling spec) before archiving this change.

**WARNING**:

1. `design.md` §10 "No se toca" still lists `FinancialSection.tsx` and `TemplateSendPanel.tsx` as untouched, but FX1 modified both (confirmed by diff). `tasks.md` G.6 was rewritten to reflect this; `design.md` §10 was not (per engram `#2390`: "FX15 sinceró tasks.md, no design.md"). Low risk — `tasks.md` is authoritative and honest about the deviation — but `design.md` should get the same one-line fix before archive for future readers.
2. The `apply-progress` engram artifact (topic_key `sdd/combo-balance-honesto/apply-progress`, `#2386`) currently holds only the last mini-fix-wave's narrative (3 revisions, upsert-overwritten), not a structured per-task TDD Cycle Evidence table for all 84 tasks. `tasks.md`'s inline rojo/verde prose is a reasonable substitute and is corroborated by real test execution, but the canonical audit-trail format specified by the strict-TDD-verify protocol was not preserved across revisions.

**SUGGESTION**: None beyond the above.

---

### Checklist

- [x] Zero `__probe_*.test.ts` residuals (`Glob **/__probe_*` under `src/` → 0 matches)
- [x] `git status` clean on the worktree (nothing to commit)
- [x] `npm run typecheck` clean
- [x] All 50 real spec scenarios have a passing test
- [x] Full suite red is the single documented preexisting `WhatsappReportsPage.test.tsx` failure, unrelated to this change
- [ ] G.7 Playwright smoke — open, requires live/deployed environment (acknowledged as legitimately pending in `tasks.md`)
- [ ] CRITICAL-1 — `customer-balance-display/spec.md` needs 7 scenarios added to match `tasks.md`'s own claim

---

## Verdict

**PASS WITH WARNINGS** — code and tests are fully correct: typecheck clean, 208/208 matrix tests green
(and full suite matches the exact expected baseline of 7855/7857 with the one documented preexisting
red), zero probe residue, git clean. The one CRITICAL finding is a **documentation-integrity gap, not a
functional defect**: `customer-balance-display/spec.md` was never amended to describe 7 fix-wave
behaviors that `tasks.md` claims are already specified, and that are in fact implemented and tested.
Recommend amending the spec text (mirroring the pattern already used correctly in
`finance-sync-lane-visibility`) before archiving, plus the one-line `design.md` §10 fix — neither
requires touching code.
