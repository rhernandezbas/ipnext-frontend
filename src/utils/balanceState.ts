/**
 * balanceState — combo-balance-honesto (design.md §1). Única fuente de
 * verdad para el discriminador de `Customer.balanceDue` (`number | null |
 * undefined`), consumida por `BalanceCard` (InfoTab) y por el sub-header de
 * `CustomerDetailPage`.
 *
 * El discriminador MUST ser el VALOR, nunca la truthiness: `if (balanceDue)`
 * colapsa `0` con `null` — ese colapso es el bug de honestidad que este
 * change existe para eliminar.
 */

export type BalanceState =
  | { kind: 'unknown' }
  | { kind: 'credit'; amount: number }
  | { kind: 'settled' }
  | { kind: 'debt'; amount: number };

export function balanceState(due: number | null | undefined): BalanceState {
  if (due == null || !Number.isFinite(due)) return { kind: 'unknown' };
  if (due < 0) return { kind: 'credit', amount: Math.abs(due) };
  if (due === 0) return { kind: 'settled' };
  return { kind: 'debt', amount: due };
}
