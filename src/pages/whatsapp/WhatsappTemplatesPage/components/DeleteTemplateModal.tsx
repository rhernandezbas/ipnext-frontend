import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TemplateInUseError } from '@/hooks/useTemplatesAdmin';
import type { TemplateDetailDto } from '@/types/messagingTemplates';
import styles from './DeleteTemplateModal.module.css';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

const TITLE_ID = 'template-delete-title';
const LEAD_ID = 'template-delete-lead';

interface DeleteTemplateModalProps {
  open: boolean;
  template: TemplateDetailDto | null;
  busy?: boolean;
  /**
   * 409 TEMPLATE_IN_USE — campañas que BLOQUEAN el borrado. Si está presente,
   * el template NO se borró: se muestran las campañas y se deshabilita el
   * confirmar (NO es un éxito).
   */
  inUseError?: TemplateInUseError | null;
  /** Otros errores (red/500/404). */
  serverError?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * DeleteTemplateModal (Change 3, T5) — doble-confirmación DESTRUCTIVA con
 * impacto explícito. NO reusa el `ConfirmModal` compartido (solo `message:
 * string`, no muestra la lista de campañas del 409) — sí REUSA su shell de
 * a11y (portal, focus-trap, Esc/backdrop, restauración, scroll-lock) y su
 * default SEGURO de foco inicial en Cancelar (tone danger: un Enter/Space
 * reflejo NO confirma sin leer), igual que `ConfirmModal`.
 *
 * 409 TEMPLATE_IN_USE: en vez de tratar el error como cierre exitoso, muestra
 * las campañas (`campaignIds`) que impiden el borrado y deshabilita el
 * confirmar — el operador primero tiene que resolver esas campañas.
 */
export function DeleteTemplateModal({
  open,
  template,
  busy = false,
  inUseError,
  serverError,
  onConfirm,
  onCancel,
}: DeleteTemplateModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Boolean ESTABLE (no la identidad de `inUseError`, que cambia por render) —
  // para que el effect de foco de abajo sólo dispare en la transición a blocked.
  const isBlocked = !!inUseError;

  // Foco inicial en Cancelar (safe default de una acción destructiva) + restauración.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [open]);

  // Foco huérfano tras el 409: el confirmar pasa a `disabled` (blocked) y el
  // foco caería al <body>. Lo movemos proactivamente al "Cerrar" para que el
  // teclado no quede huérfano (el `blockedBox role="alert"` ya se anuncia solo).
  useEffect(() => {
    if (open && isBlocked) {
      cancelRef.current?.focus();
    }
  }, [open, isBlocked]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(dialogRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !dialogRef.current?.contains(active);
      if (e.shiftKey) {
        if (active === first || outside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || outside) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open || !template) return null;

  const blocked = isBlocked;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      aria-describedby={LEAD_ID}
    >
      <div className={styles.dialog} ref={dialogRef}>
        <h2 id={TITLE_ID} className={styles.title}>Borrar template</h2>
        <p id={LEAD_ID} className={styles.lead}>
          Vas a borrar <strong>{template.friendlyName}</strong>. Esto lo elimina{' '}
          <strong>TAMBIÉN de WhatsApp/Meta</strong> y es <strong>irreversible</strong>: volver a tenerlo aprobado
          puede tardar 24-48h.
        </p>

        {blocked && inUseError && (
          <div className={styles.blockedBox} role="alert">
            <p className={styles.blockedTitle}>{inUseError.message}</p>
            <p className={styles.blockedHint}>
              Estas campañas lo están usando. Resolvelas antes de borrar el template:
            </p>
            <ul className={styles.campaignList}>
              {inUseError.campaignIds.map((id) => (
                <li key={id} className={styles.campaignItem}>{id}</li>
              ))}
            </ul>
          </div>
        )}

        {serverError && !blocked && (
          <p className={styles.error} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            {blocked ? 'Cerrar' : 'Cancelar'}
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
            disabled={busy || blocked}
          >
            {busy ? 'Borrando…' : 'Borrar definitivamente'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
