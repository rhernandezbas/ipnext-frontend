import { Can } from '@/components/auth/Can';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { formatDateShort } from '@/utils/formatDate';
import type { AutoCheckState, OwnershipCaseChecks, OwnershipCaseStatus } from '@/types/actions';
import styles from './CaseChecklist.module.css';

/**
 * CaseChecklist — checklist de un caso de titularidad (actions-worklist F2).
 *
 * Los checks AUTO (TV / PPPoE) los computa el BE contra el estado real y acá
 * son READ-ONLY: no se pueden tildear a mano — un checklist tildeable se
 * convierte en teatro. `null` = no aplica o no evaluable (el origen no tiene
 * ese servicio, o el caso no tiene destino) → "—".
 * El ÚNICO check manual es la revisión física de equipos (mundo físico),
 * gateado por `actions.manage` y con rastro de quién/cuándo. En casos
 * CERRADOS (done/dismissed) también queda read-only: el BE rechaza el PATCH
 * con 422 igual — mostrar un input tildeable sería mentir (M2).
 */

function AutoCheckBadge({ state }: { state: AutoCheckState }) {
  if (state === 'ok') return <StatusBadge status="active" label="OK" />;
  if (state === 'pending') return <StatusBadge status="late" label="Pendiente" />;
  return (
    <span className={styles.notEvaluable} title="No aplica o no evaluable">
      —
    </span>
  );
}

interface CaseChecklistProps {
  /** Id del caso — namespacea el input del check manual. */
  caseId: string;
  checks: OwnershipCaseChecks;
  /**
   * Estado del caso — en done/dismissed el check manual se muestra read-only
   * (el BE rechaza equipmentReviewed sobre casos cerrados con 422).
   * Opcional: sin estado se asume caso abierto (editable).
   */
  caseStatus?: OwnershipCaseStatus;
  /** Dispara el PATCH {equipmentReviewed} con el nuevo valor. */
  onToggleEquipmentReviewed: (reviewed: boolean) => void;
  /** Deshabilita el checkbox mientras el PATCH está en vuelo. */
  togglePending?: boolean;
}

export function CaseChecklist({
  caseId,
  checks,
  caseStatus,
  onToggleEquipmentReviewed,
  togglePending = false,
}: CaseChecklistProps) {
  const eq = checks.equipment;
  const isClosed = caseStatus === 'done' || caseStatus === 'dismissed';

  return (
    <ul className={styles.checklist}>
      <li className={styles.row}>
        <span className={styles.label}>TV transferida</span>
        <AutoCheckBadge state={checks.tv} />
      </li>
      <li className={styles.row}>
        <span className={styles.label}>PPPoE migrado</span>
        <AutoCheckBadge state={checks.pppoe} />
      </li>
      <li className={styles.row}>
        <span className={styles.label}>Equipos</span>
        <span className={styles.counts}>
          {eq.sourceActive} activos en origen · {eq.targetActive ?? '—'} en destino
        </span>
        <span className={styles.manualArea}>
          {isClosed ? (
            // M2 — caso cerrado: estado visible, sin input (el BE lo rechaza igual).
            <StatusBadge
              status={eq.reviewed ? 'active' : 'late'}
              label={eq.reviewed ? 'Revisado' : 'Sin revisar'}
            />
          ) : (
            <Can
              permission="actions.manage"
              fallback={
                <StatusBadge
                  status={eq.reviewed ? 'active' : 'late'}
                  label={eq.reviewed ? 'Revisado' : 'Sin revisar'}
                />
              }
            >
              <label className={styles.manualCheck} htmlFor={`case-${caseId}-equipment-check`}>
                <input
                  id={`case-${caseId}-equipment-check`}
                  type="checkbox"
                  checked={eq.reviewed}
                  disabled={togglePending}
                  onChange={(e) => onToggleEquipmentReviewed(e.target.checked)}
                />
                <span>Revisión física realizada</span>
              </label>
            </Can>
          )}
          {eq.reviewed && (
            <span className={styles.reviewedMeta}>
              por {eq.reviewedByName ?? '—'} · {formatDateShort(eq.reviewedAt)}
            </span>
          )}
        </span>
      </li>
    </ul>
  );
}
