/**
 * balanceState — combo-balance-honesto FA2 (design.md §1). Única fuente de
 * verdad para el discriminador de `Customer.balanceDue`: consumida por
 * `BalanceCard` (InfoTab) y por el sub-header de `CustomerDetailPage` — si
 * este helper se duplicara, un fix futuro arreglaría una sola copia y las
 * dos vistas divergirían en el significado de un mismo número negativo.
 *
 * El discriminador MUST ser el VALOR, nunca la truthiness: `if (balanceDue)`
 * colapsa `0` con `null`, que es exactamente el bug que este change existe
 * para no repetir.
 */
import { describe, it, expect } from 'vitest';
import { balanceState } from '@/utils/balanceState';

describe('balanceState', () => {
  it('null → unknown', () => {
    expect(balanceState(null)).toEqual({ kind: 'unknown' });
  });

  it('undefined (campo ausente) → unknown', () => {
    expect(balanceState(undefined)).toEqual({ kind: 'unknown' });
  });

  it('-5000 → credit con amount en valor absoluto (5000)', () => {
    expect(balanceState(-5000)).toEqual({ kind: 'credit', amount: 5000 });
  });

  it('0 → settled', () => {
    expect(balanceState(0)).toEqual({ kind: 'settled' });
  });

  it('65722.07 → debt con el monto tal cual', () => {
    expect(balanceState(65722.07)).toEqual({ kind: 'debt', amount: 65722.07 });
  });

  it('NaN → unknown (la basura cae al lado seguro, NUNCA a "debt")', () => {
    expect(balanceState(NaN)).toEqual({ kind: 'unknown' });
  });

  it('Infinity → unknown (no-finito, mismo criterio que NaN)', () => {
    expect(balanceState(Infinity)).toEqual({ kind: 'unknown' });
    expect(balanceState(-Infinity)).toEqual({ kind: 'unknown' });
  });
});
