import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './IClassSendResultModal.module.css';

/** IClass send error codes returned by PATCH /scheduling/:id/stage. */
export type IClassErrorCode =
  | 'MISSING_REQUIRED_FIELDS'
  | 'ICLASS_NODE_NOT_FOUND'
  | 'ICLASS_UNAVAILABLE'
  | 'ICLASS_REJECTED'
  | 'MISSING_PROJECT_FOR_ICLASS'
  | 'MISSING_ICLASS_MAPPING';

export interface IClassSendError {
  code: string;
  missingFields?: string[];
  message?: string;
  /** Human-readable rejection detail returned by IClass (ICLASS_REJECTED). */
  reason?: string;
  /** Project title surfaced by the backend on MISSING_ICLASS_MAPPING. */
  projectTitle?: string;
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
 *  to the raw code so a backend change never produces an empty row.
 *  Exported so the bulk-move result modal reuses the SAME translations. */
export const FIELD_LABELS: Record<string, string> = {
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
  ICLASS_REJECTED: 'IClass rechazó la orden',
  MISSING_PROJECT_FOR_ICLASS: 'La tarea no tiene proyecto asignado',
  MISSING_ICLASS_MAPPING: 'El proyecto no está configurado para IClass',
};

/** Map a field code to its Spanish label (raw code fallback). */
export function fieldLabel(code: string): string {
  return FIELD_LABELS[code] ?? code;
}

/**
 * One-line human-readable reason for a failed IClass send, given the error code
 * and optional details. Reused by the bulk-move result modal so the per-task
 * failure reasons match the single-send modal wording (no duplicated strings).
 */
export function iclassErrorReason(
  errorCode: string | undefined,
  detail?: { missingFields?: string[]; reason?: string; projectTitle?: string },
): string {
  switch (errorCode) {
    case 'MISSING_REQUIRED_FIELDS': {
      const fields = (detail?.missingFields ?? []).map(fieldLabel);
      return fields.length
        ? `Faltan datos: ${fields.join(', ')}`
        : 'Faltan datos requeridos para enviar a IClass.';
    }
    case 'ICLASS_NODE_NOT_FOUND':
      return 'La localidad no corresponde a un nodo de IClass.';
    case 'ICLASS_UNAVAILABLE':
      return 'IClass no está disponible en este momento.';
    case 'ICLASS_REJECTED':
      return detail?.reason?.trim()
        ? `IClass rechazó la orden: ${detail.reason}`
        : 'IClass rechazó la orden por un problema en los datos.';
    case 'MISSING_PROJECT_FOR_ICLASS':
      return 'La tarea no tiene proyecto asignado.';
    case 'MISSING_ICLASS_MAPPING':
      return detail?.projectTitle?.trim()
        ? `El proyecto «${detail.projectTitle}» no tiene tipo de OS de IClass mapeado.`
        : 'El proyecto no tiene tipo de OS de IClass mapeado.';
    case 'TASK_NOT_FOUND':
      return 'No se encontró la tarea.';
    case 'STAGE_NOT_FOUND':
      return 'No se encontró el estado destino.';
    default:
      return 'Ocurrió un error al enviar la tarea a IClass.';
  }
}

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
  const isMissingProject = error.code === 'MISSING_PROJECT_FOR_ICLASS';
  const isMissingMapping = error.code === 'MISSING_ICLASS_MAPPING';
  const showEditTask = isMissing || isMissingProject;
  const showRetry = !isMissing && !isMissingProject && !isMissingMapping;
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
                  {fieldLabel(field)}
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
        ) : error.code === 'ICLASS_REJECTED' ? (
          <p className={styles.message}>
            {error.reason?.trim()
              ? error.reason
              : 'IClass rechazó la orden por un problema en los datos. Revisá la información de la tarea antes de reintentar.'}
          </p>
        ) : isMissingProject ? (
          <p className={styles.message}>
            Asignale un proyecto a la tarea antes de enviarla a IClass. Cada
            proyecto define qué tipo de orden de servicio se crea en IClass.
          </p>
        ) : isMissingMapping ? (
          <p className={styles.message}>
            {error.projectTitle?.trim()
              ? `El proyecto «${error.projectTitle}» no tiene un tipo de orden de servicio asociado. `
              : 'El proyecto no tiene un tipo de orden de servicio asociado. '}
            Pedile al administrador que lo configure desde el menú de proyectos.
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
          {showEditTask ? (
            onEditTask && (
              <button type="button" className={styles.primary} onClick={onEditTask}>
                Editar tarea
              </button>
            )
          ) : showRetry ? (
            <button type="button" className={styles.primary} onClick={onRetry}>
              Reintentar
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
