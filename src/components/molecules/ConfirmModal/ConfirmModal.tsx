import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmModal.module.css';

/** Elementos tabulables dentro del diálogo (para el focus-trap). */
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

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  /** Hide the cancel button — for single-action informative notices (e.g. an
   *  "Entendido" acknowledgement). Default false: cancel stays visible. */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible modal dialog rendered to document.body via portal.
 * - Click on the backdrop or Esc closes (cancels)
 * - Initial focus: confirm button — EXCEPTO tone danger, donde va a Cancelar
 *   (safe default: un doble-Space/Enter apurado no acepta una acción
 *   destructiva sin leer). Con hideCancel cae a confirmar (única acción).
 * - Focus TRAP: Tab/Shift+Tab ciclan DENTRO del diálogo, no se escapan a la
 *   página de fondo (fix wave FIX-2 — acciones irreversibles como el envío de
 *   una campaña).
 * - Focus RESTORATION: al cerrar, el foco vuelve al elemento que abrió el modal
 *   (FIX-2).
 * - Body scroll lock while open
 * - Danger tone makes the confirm button red (delete/destroy flows)
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  busy = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Foco: guardar el trigger, mover el foco al botón inicial, y restaurar al
  // cerrar. Keyed SOLO en `open` — así el cambio de identidad de `onCancel`
  // (funciones inline de los consumers) NO reinicia el foco en cada render.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // Foco inicial seguro: en danger va a Cancelar para que un Space/Enter
    // reflejo NO confirme una acción destructiva sin leer. Sin cancelar
    // (hideCancel) o en tonos no-danger, va a confirmar (contrato previo).
    const initialFocus =
      tone === 'danger' && !hideCancel ? cancelRef.current : confirmRef.current;
    initialFocus?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // tone/hideCancel se leen sólo al abrir; re-correr por su cambio churnearía el foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll lock + teclado (Esc cancela, Tab atrapa el foco dentro del diálogo).
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

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className={styles.dialog} ref={dialogRef}>
        <h2 id="confirm-modal-title" className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {!hideCancel && (
            <button
              ref={cancelRef}
              type="button"
              className={styles.cancel}
              onClick={onCancel}
              disabled={busy}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`${styles.confirm} ${tone === 'danger' ? styles.danger : ''}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
