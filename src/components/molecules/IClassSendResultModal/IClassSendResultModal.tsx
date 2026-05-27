import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './IClassSendResultModal.module.css';

/** IClass send error codes returned by PATCH /scheduling/:id/stage. */
export type IClassErrorCode =
  | 'MISSING_REQUIRED_FIELDS'
  | 'ICLASS_NODE_NOT_FOUND'
  | 'ICLASS_UNAVAILABLE';

export interface IClassSendError {
  code: string;
  missingFields?: string[];
  message?: string;
}

interface IClassSendResultModalProps {
  open: boolean;
  /** The IClass error to display. When null the modal renders nothing. */
  error: IClassSendError | null;
  onClose: () => void;
  /** Re-dispatches the move to the same stage (node-not-found / unavailable). */
  onRetry: () => void;
  /** Navigates to the task detail so the user can fill the missing fields. */
  onEditTask?: () => void;
}

/** code → Spanish label for the missing-fields list. Unknown codes fall back
 *  to the raw code so a backend change never produces an empty row. */
const FIELD_LABELS: Record<string, string> = {
  customerName: 'Nombre del cliente',
  phone: 'Teléfono',
  address: 'Dirección',
  city: 'Ciudad',
  description: 'Descripción',
};

const TITLES: Record<string, string> = {
  MISSING_REQUIRED_FIELDS: 'Faltan datos para enviar a IClass',
  ICLASS_NODE_NOT_FOUND: 'No se encontró el nodo en IClass',
  ICLASS_UNAVAILABLE: 'IClass no está disponible',
};

/**
 * Reusable modal for the result of sending a task to IClass. Mirrors the
 * ConfirmModal pattern (portal to body, Esc/backdrop close, body scroll lock,
 * focus trap). Renders one of three error states; success is handled by a toast
 * in the caller, not here.
 */
export function IClassSendResultModal({
  open,
  error,
  onClose,
  onRetry,
  onEditTask,
}: IClassSendResultModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !error) return;
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
  }, [open, error, onClose]);

  if (!open || !error) return null;

  const isMissing = error.code === 'MISSING_REQUIRED_FIELDS';
  const title = TITLES[error.code] ?? 'Error al enviar a IClass';

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="iclass-modal-title"
    >
      <div className={styles.dialog}>
        <h2 id="iclass-modal-title" className={styles.title}>{title}</h2>

        {isMissing ? (
          <>
            <p className={styles.message}>
              No se puede crear la Orden de Servicio porque faltan los siguientes datos en la tarea:
            </p>
            <ul className={styles.fieldList}>
              {(error.missingFields ?? []).map((field) => (
                <li key={field} className={styles.fieldItem}>
                  {FIELD_LABELS[field] ?? field}
                </li>
              ))}
            </ul>
          </>
        ) : error.code === 'ICLASS_NODE_NOT_FOUND' ? (
          <p className={styles.message}>
            La ciudad de la tarea no corresponde a un nodo de IClass. Verificá la
            localidad del cliente o configurá el nodo antes de reintentar.
          </p>
        ) : error.code === 'ICLASS_UNAVAILABLE' ? (
          <p className={styles.message}>
            El servicio de IClass no está disponible en este momento. Reintentá en
            unos minutos.
          </p>
        ) : (
          <p className={styles.message}>
            {error.message ?? 'Ocurrió un error al enviar la tarea a IClass.'}
          </p>
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
          {isMissing ? (
            onEditTask && (
              <button type="button" className={styles.primary} onClick={onEditTask}>
                Editar tarea
              </button>
            )
          ) : (
            <button type="button" className={styles.primary} onClick={onRetry}>
              Reintentar
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
