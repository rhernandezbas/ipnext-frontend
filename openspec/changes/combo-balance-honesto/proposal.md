# Proposal: combo-balance-honesto (FRONTEND)

## Intent

Dos changes del BE ya están **en prod** (deploy 2026-08-10) y el FE no los consume — peor:
el FE afirma cosas que el BE ya no respalda.

1. **`customer-balance-unmask`**: `balanceDue` pasó a ser el número REAL para TODO status
   (antes valía 0 salvo `late`) y **puede ser `null`** = *sin dato* (cliente sin
   `grClienteId`, o nunca sincronizado). El panel pasó de 73 a ~3.286 deudores visibles.
   `balanceStale` cambió a semántica status-agnóstica por carril (TTL rápido ~60min /
   bajas 26h) y **el FE ni siquiera lo declara en el tipo — lo tira**.
2. **`gr-receipt-annulment`**: `/api/finance/growth/sync/status` ahora emite un tercer
   carril (`activeLane: 'reconcile'` + bloque `reconcile{...}`). El FE no lo tipa, así que
   un barrido de reconciliación en curso se lee como "sistema quieto" y un **ABORT del
   guard de anulaciones se lee como "ritmo degradado" genérico**.

El hilo común es el mismo bug de honestidad que el BE ya arregló de su lado: **un `null`
pintado como `0`, o un estado desconocido pintado como un estado conocido**. Hoy el FE:

- pinta `"$ 0,00"` en el sub-header de un cliente **sin dato de saldo** (afirma cero sobre
  lo desconocido — `CustomerDetailPage.tsx:29`);
- pinta `"Sin deuda ✓"` en la BalanceCard cuando `balanceDue === null`
  (`InfoTab.tsx:250`, `hasDebt = typeof balanceDue === 'number' && balanceDue > 0`);
- renderiza un **saldo A FAVOR (`balanceDue < 0`) EXACTAMENTE igual que una deuda**:
  `CustomerDetailPage.tsx:187` hace `balanceDue > 0 ? -balanceDue : balanceDue`, así que
  una deuda de 5.000 y un crédito de 5.000 salen los dos como `-$ 5.000`;
- mantiene dos ramas de UI (`balanceOverdue`, `invoicesQty` — `InfoTab.tsx:271-284`)
  sobre campos que **el BE nunca envió**, con tests que las certifican inventando props;
- no muestra jamás si el número que muestra está **viejo** (`balanceStale`).

## Scope

### In Scope

**(A) Balance honesto (`Customer`)**
- `src/types/customer.ts:165-169`: `+balanceStale?: boolean`, `−balanceOverdue`,
  `−invoicesQty`.
- `InfoTab.tsx` `BalanceCard` (`:229-293`): estados excluyentes por valor
  (`null` / `< 0` / `0` / `> 0`), marca de frescura + indicador de `balanceStale`,
  eliminación del non-null assertion `formatARS(balanceDue!)` (`:268`), guard
  `Number.isFinite` en `formatRelativeTime` (`:237-246`).
- `InfoTab.module.css:202-274`: los 4 hex crudos (`#fee2e2`, `#991b1b`, `#dc2626`,
  `#dcfce7`/`#166534`) a tokens `var(--*)`.
- `CustomerDetailPage.tsx:28-31,186-187`: `formatBalance` honesto para `null`, crédito
  como estado propio, y baja del cast estructural `(customer as {...}).balanceDue`.
- `useWhatsapp.ts:876`: opcional-encadenar el último hop (`?.balance?.stale`).
- Borrado de los tests que certifican las ramas muertas (`InfoTab.test.tsx:46-71,103-108`).
- Un **contract test** con fixture calcado de la respuesta real de `GET /api/clients/:id`.

**(B) Reconcile visible (`FinanceSyncStatusResponse`)**
- `src/types/financeGrowth.ts:208-242`: `activeLane` + `'reconcile'`, bloque `reconcile`
  con los 7 campos del DTO del BE (`application/dto/financeGrowth.dto.ts:87-95`).
- `FinanceGrowthOverviewPage.tsx:53,64-73`: `running` considera
  `reconcile.sweepInProgress`; el badge expone `reconcile.lastResult` cuando arranca con
  `error:` (hoy el ABORT del guard es indistinguible de un ritmo degradado).

### Out of Scope

- **"Vencido" real** (el `balanceOverdue` que se elimina): si algún día se quiere, es
  feature nueva con su propio endpoint y su propia card. No se arrastra el campo muerto.
- **`balanceCurrency`**: hoy sólo vale `'ARS' | null` (lo sintetiza el parser del BE como
  `amount > 0 ? 'ARS' : null`), no aporta información al usuario. `formatARS` se queda.
- `FinancialSection.tsx` / `TemplateSendPanel.tsx` / `MisClientesPage.tsx`: consumen
  **otros** DTOs (`WhatsappInboxClientBalance`, `PortfolioItem.debtAmount`), ya manejan
  `null` correctamente. Se **pinean con scenarios de no-regresión**, no se tocan.
- Cambiar el endpoint, agregar refresh manual de saldo, o tocar el polling del inbox.
- `MisClientesPage`: su columna "Deuda" sale de `PortfolioItem.debtAmount` — otro carril.

## Capabilities

### New Capabilities
- `customer-balance-display`: cómo el FE **muestra** el saldo GR de un cliente —
  desconocido vs. cero vs. deuda vs. crédito, y su frescura.
- `finance-sync-lane-visibility`: cómo el FE **expone los carriles** del ingest de
  cobranza (delta / reconcile / backfill / idle) y sus fallas.

### Modified Capabilities
- None (ninguna de las dos tenía spec previa en `openspec/specs/`).

## Approach

| Tema | Estado | Resolución |
|------|--------|------------|
| `null` ≠ `0` | Decidido (orquestador) | Estado propio "Saldo no disponible", patrón ya probado en `FinancialSection.tsx:54-58` (`—` + label gris). Sub-header reusa el atom `MaybeValue` (`components/atoms/MaybeValue`), que existe justo para esto |
| `balanceOverdue`/`invoicesQty` | Decidido (orquestador) | Se ELIMINAN de tipo + ramas + tests. Verificado: no existen en `domain/entities/customer.ts` del BE ni los emite `toCustomer()` — el tipo del FE mentía |
| `balanceCurrency` | Decidido (orquestador) | NO se agrega |
| Saldo a favor (`< 0`) | Decidido | Estado propio en AMBOS lugares (sub-header y card) — es el mismo hermano del mismo bug. Se conserva la convención de signo del sub-header (deuda = negativo) y se distingue el crédito por **texto**, no por color. Ver design §3 |
| Marca de stale | Decidido | Chip con **texto + icono** (`--color-warning-*`), nunca sólo color (regla `ui-ux-pro-max`). No se muestra cuando `balanceDue == null` (no hay dato que pueda estar viejo) |
| Tipado del bloque `reconcile` | Decidido | Campos **requeridos** (calco exacto del DTO en prod), pero las lecturas usan `?.` — un BE viejo en un deploy escalonado no puede tirar el panel. Ver design §6 |
| Precedencia del badge de sync | Decidido | `ingesta apagada` > `error del reconcile` > `ritmo degradado` > `al día`. Cada uno con su token; el nuevo NO reusa `.syncDegraded` |
| Diseño | Innegociable | Tarea 0 del apply = `python .claude/skills/ui-ux-pro-max/scripts/search.py "<contexto>" --design-system`. Tokens SIEMPRE, contraste **calculado** ≥4.5:1, foco visible, estado nunca sólo-color |
| Contrato con el BE | Innegociable | Fixture calcado de la respuesta real + `*.contract.test.tsx` (convención ya usada: `MessageThread.contract.test.tsx`, `serviceEventType.contract.test.tsx`). Lección `e2e-envelope-mock-mismatch` |

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/types/customer.ts` | Modified | +`balanceStale`, −`balanceOverdue`, −`invoicesQty` |
| `src/pages/customers/tabs/InfoTab.tsx` | Modified | `BalanceCard` 2 → 4 estados + stale + guard de fecha |
| `src/pages/customers/tabs/InfoTab.module.css` | Modified | 4 hex crudos → tokens; +reglas de "no disponible", crédito y stale |
| `src/pages/customers/CustomerDetailPage.tsx` | Modified | `formatBalance` honesto, crédito, baja del cast estructural |
| `src/pages/customers/CustomerDetailPage.module.css` | Modified | +regla por signo (crédito) |
| `src/hooks/useWhatsapp.ts` | Modified | 1 línea: `?.balance?.stale` |
| `src/types/financeGrowth.ts` | Modified | `activeLane` +`'reconcile'`, +bloque `reconcile` |
| `src/pages/finance-growth/FinanceGrowthOverviewPage.tsx` | Modified | `running` + badge de error del reconcile |
| `src/pages/finance-growth/FinanceGrowthOverviewPage.module.css` | Modified | +token del badge nuevo |
| `src/__tests__/customers/InfoTab.test.tsx` | Modified | Borra 2 tests de ramas muertas, reescribe el de `null` |
| `src/__tests__/...` (nuevos) | New | Contract tests + tests de estado + test de contraste |

**Cero rutas tocadas** — `App.tsx` no se modifica; las 94 rutas flat siguen resolviendo
igual y no hay deep-link afectado.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Borrar `balanceOverdue`/`invoicesQty` rompe un consumidor no auditado | Low | `rg` sobre todo `src/` antes de borrar (tarea 1.1); hoy sólo los toca `InfoTab.tsx` + su test |
| Deploy escalonado: FE nuevo contra BE sin `reconcile` | Low | Lecturas con `?.` + `?? false`; el tipo es estricto pero el runtime tolera. Scenario dedicado |
| El chip de stale grita siempre (el bug de TTL único que el BE ya arregló) | Low | El FE **no recalcula** staleness: consume `balanceStale` tal cual. Cero lógica de TTL en el cliente |
| Cambiar el signo del sub-header confunde al operador acostumbrado | Med | NO se cambia el signo: la convención "deuda = negativo" se conserva; sólo se agrega texto que desambigua el crédito |
| Tocar `InfoTab.module.css` con prettier reformatea el archivo entero | Med | Prohibido correr prettier en este repo (no hay config; aplica defaults y sepulta el cambio real) |
| Un test de contraste que lee CSS crudo se rompe por un rename de clase | Low | Molde ya probado: `FinancialSection.contrast.test.tsx` falla ruidosamente con el nombre del selector |

## Rollback Plan

100% FE, aditivo-en-comportamiento y sin estado persistido: `git revert` del merge deja el
panel exactamente como está hoy. Ningún endpoint, ninguna migración, ninguna ruta. El BE
sigue emitiendo `balanceStale`/`reconcile` con o sin este change (el FE los ignoraba).

## Dependencies

- BE `customer-balance-unmask` y `gr-receipt-annulment` en prod — **confirmado** contra el
  código de `ipnext-backend` (`PrismaCustomerRepository.toCustomer():29-91`,
  `application/dto/financeGrowth.dto.ts:60-95`).
- Skill `ui-ux-pro-max` disponible en apply (tarea 0, bloqueante).

## Success Criteria

- [ ] Un cliente **sin `grClienteId`** muestra "Saldo no disponible" en la card y en el
      sub-header — en ningún lado dice "Sin deuda" ni `$ 0,00`.
- [ ] Un cliente con `balanceDue === 0` muestra "Sin deuda"; uno con `> 0` muestra deuda;
      uno con `< 0` muestra saldo a favor — los cuatro estados son distinguibles **sin
      depender del color**.
- [ ] `balanceStale === true` es visible con texto, y `lastBalanceAt` inválido nunca
      produce "hace NaN d".
- [ ] `balanceOverdue`/`invoicesQty` no existen en `src/` (ni tipo, ni rama, ni test).
- [ ] Un barrido de reconcile en curso deshabilita "Sincronizar ahora" y un ABORT del
      guard se lee con su mensaje, no como "Ritmo degradado".
- [ ] Cero hex crudo en las reglas tocadas; cada par de color con su ratio **calculado**
      en un test.
- [ ] `npx vitest run` completo verde + `npm run typecheck` sin errores.
