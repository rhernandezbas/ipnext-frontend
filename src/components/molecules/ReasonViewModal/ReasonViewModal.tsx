import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ReasonViewModal.module.css';

const DIALOG_TITLE_ID = 'reason-view-modal-title';

interface ReasonViewModalProps {
  open: boolean;
  /** The reason text to display. */
  reason: string;
  /** Called when the modal is dismissed. */
  onClose: () => void;
}

/**
 * #132 / #133-FE — Read-only mini-modal that displays a service event reason.
 * Follows the portal + z-index + Escape + backdrop + focus pattern from
 * ServiceRemovalReasonModal and ServiceHistoryModal.
 */
export function ReasonViewModal({ open, reason, onClose }: ReasonViewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the close button when the modal opens (a11y).
    closeRef.current?.focus();
    // Use capture phase + stopImmediatePropagation so that when ReasonViewModal
    // is open, Escape is consumed here BEFORE the parent modal's bubble-phase
    // listener sees it — prevents both modals from closing simultaneously.
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
      >
        <h2 id={DIALOG_TITLE_ID} className={styles.title}>
          Motivo de la baja
        </h2>
        <p className={styles.reasonText}>{reason}</p>
        <div className={styles.actions}>
          <button ref={closeRef} type="button" className={styles.btnClose} onClick={onClose} aria-label="Cerrar">
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
