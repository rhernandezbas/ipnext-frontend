import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import type { SubmitTemplateInput, TemplateCategory, TemplateDetailDto } from '@/types/messagingTemplates';
import styles from './SubmitTemplateModal.module.css';

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

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'UTILITY', label: 'Utilidad (UTILITY)' },
  { value: 'MARKETING', label: 'Marketing (MARKETING)' },
  { value: 'AUTHENTICATION', label: 'Autenticación (AUTHENTICATION)' },
];

const TITLE_ID = 'template-submit-title';
const LEAD_ID = 'template-submit-lead';

/** Deriva un nombre de template válido para Meta (snake_case, minúsculas) desde el friendlyName. */
function toTemplateName(friendlyName: string): string {
  return friendlyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

interface SubmitTemplateModalProps {
  open: boolean;
  template: TemplateDetailDto | null;
  busy?: boolean;
  serverError?: string | null;
  onConfirm: (input: SubmitTemplateInput) => void;
  onCancel: () => void;
}

/**
 * SubmitTemplateModal (Change 3, T5) — envía un template a aprobación de Meta
 * (`POST /:sid/submit` con `{name, category}`). Reusa el shell de a11y del
 * resto de modales del dominio (portal, focus-trap, Esc/backdrop, restauración,
 * scroll-lock). Category va con el `Select` PROPIO (nunca `<select>` nativo).
 *
 * El `name` se auto-deriva del friendlyName (snake_case que Meta acepta) pero
 * queda editable. Al confirmar, el status del template pasa a "Pendiente".
 */
export function SubmitTemplateModal({
  open,
  template,
  busy = false,
  serverError,
  onConfirm,
  onCancel,
}: SubmitTemplateModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory | ''>('');
  const [attempted, setAttempted] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(template ? toTemplateName(template.friendlyName) : '');
    setCategory((template?.category as TemplateCategory | undefined) ?? '');
    setAttempted(false);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // WCAG 2.4.3 — enfocamos el INPUT DE NOMBRE (siempre habilitado) al abrir,
    // no el confirmar: el confirmar puede arrancar disabled (template sin
    // category) y `focus()` sería no-op → el foco caería al <body>.
    nameRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir/cerrar
  }, [open]);

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

  const trimmedName = name.trim();
  const nameError = trimmedName.length === 0;
  const categoryError = category === '';
  const isValid = !nameError && !categoryError;

  function handleConfirm() {
    setAttempted(true);
    if (!isValid || busy) return;
    onConfirm({ name: trimmedName, category: category as TemplateCategory });
  }

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
        <h2 id={TITLE_ID} className={styles.title}>Enviar a aprobación</h2>
        <p id={LEAD_ID} className={styles.lead}>
          Vas a enviar <strong>{template.friendlyName}</strong> a la aprobación de WhatsApp. Queda en estado{' '}
          <strong>Pendiente</strong> hasta que Meta lo revise.
        </p>

        {serverError && (
          <p className={styles.error} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="template-submit-name" className={styles.label}>Nombre para Meta</label>
          <input
            ref={nameRef}
            id="template-submit-name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={attempted && nameError || undefined}
            aria-describedby={attempted && nameError ? 'template-submit-name-error' : undefined}
          />
          {attempted && nameError && (
            <span id="template-submit-name-error" className={styles.fieldError} role="alert">
              El nombre es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <Select
            label="Categoría"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => setCategory(v as TemplateCategory)}
            placeholder="Elegí una categoría…"
            aria-invalid={attempted && categoryError}
            aria-describedby={attempted && categoryError ? 'template-submit-category-error' : undefined}
          />
          {attempted && categoryError && (
            <span id="template-submit-category-error" className={styles.fieldError} role="alert">
              Elegí una categoría.
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Enviando…' : 'Enviar a aprobación'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
