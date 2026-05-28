import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BulkStageResult, BulkStageResponse } from '@/api/scheduling.api';
import { iclassErrorReason } from '@/components/molecules/IClassSendResultModal/IClassSendResultModal';
import styles from './BulkMoveResultModal.module.css';

interface BulkMoveResultModalProps {
  open: boolean;
  summary: BulkStageResponse['summary'];
  results: BulkStageResult[];
  /** Re-dispatches the move for the still-failing task ids. */
  onRetryFailed: (failedIds: string[]) => void;
  onClose: () => void;
  /** Optional human label resolver for a task id (falls back to the raw id). */
  labelForTask?: (taskId: string) => string;
}

/**
 * Result of a bulk "Mover estado" to the IClass stage. Mirrors the ConfirmModal /
 * IClassSendResultModal pattern (portal to body, Esc/backdrop close, body scroll
 * lock). Shows "X de N enviadas a IClass" and the list of failed tasks with a
 * legible reason per error code — reusing iclassErrorReason so the wording matches
 * the single-send modal. "Reintentar las fallidas" re-runs only the failures.
 */
export function BulkMoveResultModal({
  open,
  summary,
  results,
  onRetryFailed,
  onClose,
  labelForTask,
}: BulkMoveResultModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const failed = results.filter(r => !r.ok);

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-move-result-title"
    >
      <div className={styles.dialog}>
        <h2 id="bulk-move-result-title" className={styles.title}>
          Resultado del envío a IClass
        </h2>
        <p className={styles.message}>
          {summary.ok} de {summary.total} tarea{summary.total !== 1 ? 's' : ''} enviada
          {summary.ok !== 1 ? 's' : ''} a IClass.
        </p>

        {failed.length > 0 && (
          <ul className={styles.failedList}>
            {failed.map(r => (
              <li key={r.taskId} className={styles.failedItem}>
                <span className={styles.failedTask}>
                  {labelForTask ? labelForTask(r.taskId) : r.taskId}
                </span>
                <span className={styles.failedReason}>
                  {iclassErrorReason(r.errorCode, { missingFields: r.missingFields, reason: r.reason })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <button
            ref={closeRef}
            type="button"
            className={styles.cancel}
            onClick={onClose}
          >
            Cerrar
          </button>
          {failed.length > 0 && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => onRetryFailed(failed.map(r => r.taskId))}
            >
              Reintentar las fallidas
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
