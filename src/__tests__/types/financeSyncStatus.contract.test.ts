/**
 * CONTRACT TEST: `GET /api/finance/growth/sync/status` ↔
 * `FinanceSyncStatusResponse` (combo-balance-honesto FB1, TYPE-1).
 *
 * Fuente canónica BE: `application/dto/financeGrowth.dto.ts:87-95`
 * (`gr-receipt-annulment` — tercer carril `reconcile`, ya en prod desde
 * 2026-08-10). El FE no lo tipaba: un barrido de reconcile en curso se leía
 * como "sistema quieto" y un ABORT del guard de anulaciones se leía como
 * "ritmo degradado" genérico.
 *
 * Calco EXACTO de los 7 campos del bloque `reconcile`: `lastRunAt`,
 * `lastResult`, `itemsSynced`, `sweepInProgress`, `windowFrom`, `windowTo`,
 * `pageOffset` — todos REQUERIDOS (el BE ya los emite siempre; las lecturas
 * en runtime son defensivas con `?.`, pero el TIPO describe el contrato
 * real, no la ventana de un deploy escalonado — design.md §6 Decisión 6).
 */
import { describe, it, expect } from 'vitest';
import type { FinanceSyncStatusResponse } from '@/types/financeGrowth';

const basePacing = {
  requestIntervalMs: 20000,
  effectiveIntervalMs: 20000,
  degraded: false,
  consecutiveFailures: 0,
  enabled: true,
};

const baseDelta = {
  lastRunAt: null,
  lastResult: null,
  itemsSynced: 0,
  pendingPages: false,
  coveredThroughDate: null,
};

const baseBackfill = {
  lastRunAt: null,
  lastResult: null,
  itemsSynced: 0,
  cursorYearMonth: null,
  cursorPageOffset: 0,
  done: false,
};

const baseTail = {
  debtorBalances: { lastRunAt: null, lastResult: null, itemsSynced: 0 },
  snapshotJob: { lastRunAt: null, lastResult: null, itemsSynced: 0 },
};

describe('CONTRACT: GET /api/finance/growth/sync/status ↔ FinanceSyncStatusResponse (TYPE-1)', () => {
  it('la respuesta real (activeLane: "reconcile" + bloque reconcile completo) typechequea', () => {
    const typed: FinanceSyncStatusResponse = {
      pacing: { ...basePacing, activeLane: 'reconcile' },
      delta: baseDelta,
      backfill: baseBackfill,
      reconcile: {
        lastRunAt: '2026-08-10T12:00:00.000Z',
        lastResult: 'error: guard abort … [aborts consecutivos del guard en este barrido: 2]',
        itemsSynced: 40,
        sweepInProgress: true,
        windowFrom: '2026-08-01T00:00:00.000Z',
        windowTo: '2026-08-10T00:00:00.000Z',
        pageOffset: 4,
      },
      ...baseTail,
    };
    expect(typed.reconcile.sweepInProgress).toBe(true);
  });

  it('"reconcile" es un activeLane válido', () => {
    const typed: FinanceSyncStatusResponse['pacing']['activeLane'] = 'reconcile';
    expect(typed).toBe('reconcile');
  });

  it('un campo faltante del bloque reconcile (sweepInProgress) rompe el typecheck', () => {
    const reconcileWithoutSweep = {
      lastRunAt: null,
      lastResult: null,
      itemsSynced: 0,
      // sweepInProgress: OMITIDO A PROPÓSITO
      windowFrom: null,
      windowTo: null,
      pageOffset: 0,
    };
    const typed: FinanceSyncStatusResponse = {
      pacing: { ...basePacing, activeLane: 'idle' },
      delta: baseDelta,
      backfill: baseBackfill,
      // @ts-expect-error — `sweepInProgress` es REQUERIDO en el bloque
      // `reconcile`; si alguien lo vuelve opcional en el tipo, esta
      // asignación deja de errar y la directiva queda sin usar ⇒
      // `tsc --noEmit` FALLA.
      reconcile: reconcileWithoutSweep,
      ...baseTail,
    };
    expect(typed).toBeTruthy();
  });
});
