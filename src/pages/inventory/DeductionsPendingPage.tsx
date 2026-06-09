import { useState } from 'react';
import {
  useDeductionsPending,
  useConfirmDeduction,
  useDiscardDeduction,
} from '@/hooks/useDeductionsPending';
import type { DeductionSuggestion, DeductionResolution } from '@/types/deductions';
import styles from './DeductionsPendingPage.module.css';

/**
 * "Descuentos pendientes" (EPIC #38, Wave 6). The depot/ops review surface for
 * material consumption deductions staged automatically when a RETIRO or task
 * material consumption is recorded.
 *
 * Staging never touches stock. Each row is an operator decision:
 *  - `pending`      → technician had sufficient stock → one click to deduct
 *    (resolution 'deduct').
 *  - `needs_review` → stock was insufficient at staging time → the operator
 *    picks `issue-first` (transfer+consume), `depot` (consume from depot),
 *    or `discard` (no movement).
 *
 * On confirm/discard the row leaves the list (the hooks invalidate the query).
 * On 409 (DEDUCTION_ALREADY_CONFIRMED) the hook refetches the list and the
 * page surfaces a clear banner.
 */
export default function DeductionsPendingPage() {
  const { data, isLoading, isError } = useDeductionsPending();
  const confirm = useConfirmDeduction();
  const discard = useDiscardDeduction();

  const [pendingModal, setPendingModal] = useState<DeductionSuggestion | null>(null);

  const rows = data ?? [];
  const busy = confirm.isPending || discard.isPending;

  /** Detect 409 DEDUCTION_ALREADY_CONFIRMED from the hook error */
  const isAlreadyConfirmed =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    confirm.error != null &&
    (confirm.error as any)?.response?.data?.code === 'DEDUCTION_ALREADY_CONFIRMED';

  function handleConfirm(id: string, resolution: DeductionResolution) {
    confirm.mutate({ id, input: { resolution } });
    setPendingModal(null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>Inventario</p>
        <h1 className={styles.title}>Descuentos pendientes</h1>
        <p className={styles.subtitle}>
          Consumos de material detectados al cerrar una tarea, a la espera de tu confirmación para
          descontar del stock.
        </p>
      </header>

      {isError && (
        <p className={styles.errorBanner} role="alert">
          No pudimos cargar los descuentos pendientes. Reintentá en unos segundos.
        </p>
      )}

      {isAlreadyConfirmed && (
        <p className={styles.warnBanner} role="status">
          Este descuento ya fue procesado. La lista se actualizó automáticamente.
        </p>
      )}

      <section className={styles.section} aria-labelledby="deductions-heading">
        <div className={styles.sectionHead}>
          <h2 id="deductions-heading" className={styles.sectionTitle}>
            En revisión
          </h2>
          {rows.length > 0 && <span className={styles.count}>{rows.length}</span>}
        </div>

        {isLoading ? (
          <p className={styles.loading}>Cargando descuentos…</p>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className={styles.list}>
            {rows.map(row => (
              <DeductionRow
                key={row.id}
                suggestion={row}
                busy={busy}
                onRequestDeduct={() => setPendingModal(row)}
                onConfirm={(resolution) => handleConfirm(row.id, resolution)}
                onDiscard={() => discard.mutate(row.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {pendingModal && (
        <DeductModal
          suggestion={pendingModal}
          busy={busy}
          onConfirm={(resolution) => handleConfirm(pendingModal.id, resolution)}
          onClose={() => setPendingModal(null)}
        />
      )}
    </div>
  );
}

// ── DeductionRow ──────────────────────────────────────────────────────────────

function DeductionRow({
  suggestion,
  busy,
  onRequestDeduct,
  onConfirm,
  onDiscard,
}: {
  suggestion: DeductionSuggestion;
  busy: boolean;
  onRequestDeduct: () => void;
  onConfirm: (resolution: DeductionResolution) => void;
  onDiscard: () => void;
}) {
  const isPending = suggestion.status === 'pending';
  const taskLabel =
    suggestion.taskSeq != null
      ? `#${suggestion.taskSeq}${suggestion.taskTitle ? ` · ${suggestion.taskTitle}` : ''}`
      : null;

  return (
    <li className={styles.row} aria-label={suggestion.materialName}>
      <div className={styles.rowMain}>
        <span className={styles.materialName}>{suggestion.materialName}</span>
        <span className={styles.meta}>
          <span className={styles.qty}>
            {suggestion.qty}
            {suggestion.materialUnit && (
              <span className={styles.unit}> {suggestion.materialUnit}</span>
            )}
          </span>
          {suggestion.technicianName && (
            <span className={styles.technician}> · {suggestion.technicianName}</span>
          )}
          {taskLabel && <span className={styles.task}> · {taskLabel}</span>}
        </span>
      </div>

      <div className={styles.rowSide}>
        {isPending ? (
          <>
            <span className={styles.pendingPill}>Pendiente</span>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={onRequestDeduct}
            >
              Descontar stock
            </button>
          </>
        ) : (
          <>
            <span className={styles.reviewPill}>Revisar</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => onConfirm('issue-first')}
              >
                Emitir primero
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => onConfirm('depot')}
              >
                Desde depósito
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={busy}
                onClick={onDiscard}
              >
                Descartar
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

// ── DeductModal ───────────────────────────────────────────────────────────────

function DeductModal({
  suggestion,
  busy,
  onConfirm,
  onClose,
}: {
  suggestion: DeductionSuggestion;
  busy: boolean;
  onConfirm: (resolution: DeductionResolution) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Confirmar descuento">
      <div className={styles.modal}>
        <header className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Confirmar descuento</h3>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className={styles.modalBody}>
          <p className={styles.modalMaterial}>{suggestion.materialName}</p>
          <p className={styles.modalQty}>
            {suggestion.qty}
            {suggestion.materialUnit && ` ${suggestion.materialUnit}`}
          </p>
          {suggestion.technicianName && (
            <p className={styles.modalTech}>Técnico: {suggestion.technicianName}</p>
          )}
        </div>

        <footer className={styles.modalFooter}>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy}
            onClick={() => onConfirm('deduct')}
          >
            Confirmar descuento
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <DeductionIcon />
      </span>
      <p className={styles.emptyTitle}>No hay descuentos pendientes</p>
      <p className={styles.emptyBody}>
        Cuando se registra un consumo de material en una tarea, los ítems detectados aparecen acá
        para que confirmes su descuento del stock del técnico. Por ahora no quedó ninguno en
        revisión.
      </p>
    </div>
  );
}

function DeductionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="28"
      height="28"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
