import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ServiceRemovalReasonModal.module.css';

const DIALOG_TITLE_ID = 'service-removal-reason-modal-title';

interface ServiceRemovalReasonModalProps {
  open: boolean;
  /** Display label of the service being removed (e.g. "Internet Fibra"). */
  serviceName: string;
  /**
   * Optional modal title override. Defaults to "Dar de baja: {serviceName}".
   * Use when the action is not a deactivation (e.g. "Reducir servicio: …").
   */
  title?: string;
  /**
   * Optional confirm button label override. Defaults to "Dar de baja".
   * Use when the action is not a deactivation (e.g. "Reducir", "Cortar").
   */
  confirmLabel?: string;
  /**
   * Visual tone of the confirm button. Defaults to 'danger' (red) for destructive
   * actions (baja/corte). Use 'primary' for neutral actions (e.g. "Cambiar velocidad").
   */
  tone?: 'danger' | 'primary';
  /**
   * Optional placeholder for the reason textarea. Defaults to a baja-oriented example.
   * Use a neutral example for non-baja actions (e.g. "Ej: Upgrade de plan…").
   */
  placeholder?: string;
  /** Called with the trimmed reason string when the operator confirms. */
  onConfirm: (reason: string) => void;
  /** Called when the operator cancels or dismisses the modal. */
  onCancel: () => void;
}

/**
 * #127 — Modal that collects a mandatory removal reason before a service
 * is deactivated. Follows the portal + z-index + Escape + focus pattern
 * used by ServiceHistoryModal and ConfirmModal.
 */
export function ServiceRemovalReasonModal({
  open,
  serviceName,
  title,
  confirmLabel,
  tone = 'danger',
  placeholder = 'Ej: Cliente solicitó baja, equipo retirado…',
  onConfirm,
  onCancel,
}: ServiceRemovalReasonModalProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset reason every time the modal opens so stale text doesn't persist.
  useEffect(() => {
    if (open) {
      setReason('');
      // Move focus into the textarea on open so keyboard users can type right away.
      const id = setTimeout(() => textareaRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const trimmed = reason.trim();
  const canConfirm = trimmed.length > 0;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(trimmed);
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
      >
        <h2 id={DIALOG_TITLE_ID} className={styles.title}>
          {title ?? `Dar de baja: ${serviceName}`}
        </h2>
        <p className={styles.description}>
          Ingresá el motivo. Este campo es obligatorio.
        </p>
        <div>
          <label htmlFor="removal-reason" className={styles.label}>
            Motivo
          </label>
          <textarea
            id="removal-reason"
            ref={textareaRef}
            className={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            rows={4}
          />
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={tone === 'primary' ? styles.btnPrimary : styles.btnDanger}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel ?? 'Dar de baja'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
