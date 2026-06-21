import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import styles from './BulkAssignToolbar.module.css';

/** Minimal shape needed to render an assignee option. */
export interface AssigneeOption {
  id: string;
  name: string;
}

interface BulkAssignToolbarProps {
  /** How many leads are currently selected. */
  count: number;
  /**
   * Candidate operators to assign to. These are RbacUsers — `operatorId` is
   * validated against `RbacUser` on the BE, NOT the `Admin` table.
   */
  operators: AssigneeOption[];
  /** Fired when the admin confirms the assignment. `null` = bulk-unassign. */
  onAssign: (operatorId: string | null) => void;
  /** Fired when the admin clears the current selection. */
  onClear: () => void;
  /** True while the bulk-assign mutation is in flight. */
  pending: boolean;
}

/**
 * Contextual action bar for the admin bulk-assign flow on RecaptacionPage.
 *
 * UX pattern (ui-ux-pro-max "Bulk Actions"): a checkbox column on the table
 * plus THIS action bar — never per-row assign buttons. Appears only when the
 * selection is non-empty and the user holds `recapture.assign` (gated by the
 * page). Shows the count, an operator select, and the Asignar / Limpiar actions.
 */
export function BulkAssignToolbar({ count, operators, onAssign, onClear, pending }: BulkAssignToolbarProps) {
  // Local-only: the operator chosen for THIS assignment. '' means unassign.
  const [operatorId, setOperatorId] = useState('');

  return (
    <div className={styles.toolbar} role="region" aria-label="Asignación masiva">
      <span className={styles.count}>{count} seleccionados</span>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Asignar a</span>
        <select
          className={styles.select}
          aria-label="Asignar a"
          value={operatorId}
          disabled={pending}
          onChange={(e) => setOperatorId(e.target.value)}
        >
          <option value="">— Sin asignar —</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>{op.name}</option>
          ))}
        </select>
      </label>

      <div className={styles.actions}>
        <Button
          type="button"
          variant="primary"
          aria-label="Asignar"
          loading={pending}
          onClick={() => onAssign(operatorId === '' ? null : operatorId)}
        >
          Asignar
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onClear}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
