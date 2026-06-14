import { useState, useEffect } from 'react';
import { useCloseIClassOS } from '@/hooks/useIClassOsActions';
import { useIClassResultCodes } from '@/hooks/useIClassResultCodes';
import styles from './CloseIClassOSModal.module.css';

interface CloseIClassOSModalProps {
  taskId: string;
  open: boolean;
  onClose: () => void;
}

/** Extract a human-readable reason from an API error response. */
function extractReason(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { response?: { data?: { reason?: string; error?: string } } };
  return e.response?.data?.reason ?? e.response?.data?.error ?? null;
}

/**
 * Modal para cerrar/validar una OS en IClass desde Prominense.
 *
 * FIX 3: El gate de permiso (`scheduling.iclass_close`) y de feature flag
 * (`iclass-close-action`) vive SOLO en el padre (TaskHeader, via `showCloseOSBtn`).
 * Este componente no re-evalúa el gate — solo respeta la prop `open`.
 * Esto evita el double-gate (WARN-4) y el state sucio (closeOSOpen=true sin limpiar).
 *
 * Cuando `open === false` el modal no se monta. El botón disparador se coloca
 * en el componente padre (TaskHeader), este componente solo gestiona el modal.
 *
 * Si la mutación falla con un campo `reason` en el body del error, lo muestra
 * en un banner inline.
 */
export function CloseIClassOSModal({ taskId, open, onClose }: CloseIClassOSModalProps) {
  const close = useCloseIClassOS();
  const { data: resultCodes = [] } = useIClassResultCodes();

  // Default date to today (YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);

  const [resultCode, setResultCode] = useState('');
  const [commentary, setCommentary] = useState('');
  const [closeDate, setCloseDate] = useState(todayStr);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setResultCode('');
      setCommentary('');
      setCloseDate(todayStr);
      close.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // FIX 1: BE validates with z.string().datetime() which rejects bare YYYY-MM-DD.
    // Convert the date-input value (YYYY-MM-DD) to a full ISO-8601 datetime string.
    const closeDateISO = closeDate ? new Date(closeDate).toISOString() : undefined;
    await close.mutateAsync({ taskId, resultCode, commentary, closeDate: closeDateISO });
    onClose();
  };

  const errorReason = close.isError ? extractReason(close.error) : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-iclass-os-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="close-iclass-os-title" className={styles.title}>
          Cerrar / Validar OS en IClass
        </h2>

        <form onSubmit={e => void handleSubmit(e)}>
          <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
            <label className={styles.label} htmlFor="iclass-result-code">
              Resultado
            </label>
            <select
              id="iclass-result-code"
              className={styles.select}
              value={resultCode}
              onChange={e => setResultCode(e.target.value)}
              required
              aria-label="Resultado"
            >
              <option value="">Seleccionar resultado…</option>
              {resultCodes.map(rc => (
                <option key={rc.id} value={rc.code}>
                  {rc.code}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
            <label className={styles.label} htmlFor="iclass-commentary">
              Comentario
            </label>
            <textarea
              id="iclass-commentary"
              className={styles.textarea}
              value={commentary}
              onChange={e => setCommentary(e.target.value)}
              required
              rows={3}
              aria-label="Comentario"
            />
          </div>

          <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
            <label className={styles.label} htmlFor="iclass-close-date">
              Fecha de cierre
            </label>
            <input
              id="iclass-close-date"
              type="date"
              className={styles.input}
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
              aria-label="Fecha de cierre"
            />
          </div>

          {errorReason && (
            <div className={styles.errorBanner} role="alert">
              {errorReason}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={close.isPending || !resultCode || !commentary}
              aria-label="Confirmar cierre de OS"
            >
              {close.isPending ? 'Cerrando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
