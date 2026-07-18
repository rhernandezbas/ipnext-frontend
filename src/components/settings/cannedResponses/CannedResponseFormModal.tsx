import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CreateCannedResponseInput } from '@/types/cannedResponses';
import styles from './CannedResponseFormModal.module.css';

/** Elementos tabulables dentro del diálogo (focus-trap) — mismo criterio que `ConfirmModal`/`TemplateFormModal`. */
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

const TITLE_ID = 'canned-response-form-title';
const LEAD_ID = 'canned-response-form-lead';

type FormPrefill = { shortcut: string; content: string };

interface CannedResponseFormModalProps {
  open: boolean;
  /** 'create' desde cero; 'edit' precarga shortcut+content de la respuesta existente. */
  mode: 'create' | 'edit';
  initial?: FormPrefill;
  busy?: boolean;
  /** Error del servidor (409 SHORTCUT_TAKEN / 400 VALIDATION_ERROR) — role=alert, el modal NO se cierra. */
  serverError?: string | null;
  onSubmit: (input: CreateCannedResponseInput) => void;
  onCancel: () => void;
}

/**
 * CannedResponseFormModal (Ola 4 — respuestas rápidas / macros) — form de
 * crear/editar una respuesta rápida (shortcut + content). Molde de a11y de
 * `TemplateFormModal`: portal, focus-trap cíclico, Esc/backdrop cancelan,
 * restauración de foco al cerrar, scroll-lock del body.
 *
 * Validación validate-on-click (a11y: el botón NUNCA es un dead-end disabled) —
 * submit con campos vacíos NO crea, marca `aria-invalid` y anuncia el error
 * inline (mismo criterio que TemplateFormModal). El error del servidor
 * (409/400) se muestra arriba en un `role="alert"` y el modal queda abierto.
 *
 * VARIABLES v1: el content puede tener `{{variables}}` — se guardan LITERALES
 * (no se resuelven al insertar en el composer). El hint lo aclara.
 */
export function CannedResponseFormModal({
  open,
  mode,
  initial,
  busy = false,
  serverError,
  onSubmit,
  onCancel,
}: CannedResponseFormModalProps) {
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [attempted, setAttempted] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Reset de campos + foco inicial al ABRIR (keyed solo en `open` — no pisa lo
  // que tipea el operador en cada render, mismo criterio que TemplateFormModal).
  useEffect(() => {
    if (!open) return;
    setShortcut(initial?.shortcut ?? '');
    setContent(initial?.content ?? '');
    setAttempted(false);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir/cerrar
  }, [open]);

  // Scroll-lock + Esc cancela + Tab atrapa el foco dentro del diálogo.
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

  const trimmedShortcut = shortcut.trim();
  const trimmedContent = content.trim();
  const shortcutError = trimmedShortcut.length === 0;
  const contentError = trimmedContent.length === 0;
  const isValid = !shortcutError && !contentError;

  function handleSubmit() {
    setAttempted(true);
    if (!isValid || busy) return;
    onSubmit({ shortcut: trimmedShortcut, content: trimmedContent });
  }

  const title = mode === 'edit' ? 'Editar respuesta rápida' : 'Nueva respuesta rápida';
  const submitLabel = mode === 'edit' ? 'Guardar' : 'Crear';

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
        <h2 id={TITLE_ID} className={styles.title}>{title}</h2>
        <p id={LEAD_ID} className={styles.lead}>
          El atajo es lo que el agente tipea para encontrarla; el contenido se inserta en el composer.
        </p>

        {serverError && (
          <p className={styles.error} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="canned-response-shortcut" className={styles.label}>Atajo</label>
          <input
            ref={firstFieldRef}
            id="canned-response-shortcut"
            type="text"
            className={styles.input}
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="saludo"
            aria-invalid={(attempted && shortcutError) || undefined}
            aria-describedby={attempted && shortcutError ? 'canned-response-shortcut-error' : undefined}
          />
          {attempted && shortcutError && (
            <span id="canned-response-shortcut-error" className={styles.fieldError} role="alert">
              El atajo es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="canned-response-content" className={styles.label}>Contenido</label>
          <textarea
            id="canned-response-content"
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Hola, ¿en qué te puedo ayudar?"
            aria-invalid={(attempted && contentError) || undefined}
            aria-describedby={attempted && contentError ? 'canned-response-content-error' : 'canned-response-content-hint'}
          />
          {attempted && contentError ? (
            <span id="canned-response-content-error" className={styles.fieldError} role="alert">
              El contenido no puede estar vacío.
            </span>
          ) : (
            <span id="canned-response-content-hint" className={styles.hint}>
              Podés usar {'{{variables}}'} — en v1 se insertan literales (no se reemplazan).
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} onClick={handleSubmit} disabled={busy}>
            {busy ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
