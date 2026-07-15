import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import type { CreateTemplateInput, TemplateCategory, TemplateDetailDto } from '@/types/messagingTemplates';
import { extractVariables, splitTemplateBody } from '../templateBody';
import styles from './TemplateFormModal.module.css';

/** Elementos tabulables dentro del diálogo (focus-trap) — mismo criterio que `ConfirmModal`/`CreateCampaignConfirmModal`. */
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

const TITLE_ID = 'template-form-title';
const LEAD_ID = 'template-form-lead';

type FormPrefill = Partial<Pick<TemplateDetailDto, 'friendlyName' | 'language' | 'category' | 'body'>>;

interface TemplateFormModalProps {
  open: boolean;
  /** 'create' desde cero; 'clone' cuando se "edita" un aprobado (Meta no deja editar → versión nueva + re-submit). */
  mode: 'create' | 'clone';
  /** Prefill del clon (body/friendlyName/category/language del template origen). */
  initial?: FormPrefill;
  busy?: boolean;
  /** Error del servidor (400/422/503) — se muestra en un role=alert, el modal NO se cierra. */
  serverError?: string | null;
  onSubmit: (input: CreateTemplateInput) => void;
  onCancel: () => void;
}

/**
 * TemplateFormModal (Change 3, T4/T5) — form de crear/clonar un template. NO
 * reusa el `ConfirmModal` compartido (solo acepta `message: string`) — sí
 * REUSA su shell de a11y (portal, focus-trap cíclico, Esc/backdrop cancelan,
 * restauración de foco, scroll-lock), igual que `CreateCampaignConfirmModal`.
 *
 * Category va con el `Select` PROPIO (regla innegociable: prohibido el
 * `<select>` nativo). Las `variables` NO se editan a mano: se derivan del body
 * (`extractVariables`) — el operador escribe el body y las `{{N}}` salen solas,
 * anti-error. El preview resalta cada placeholder en su contexto real.
 *
 * Clonar = crear con el body pre-cargado (Meta no deja editar un aprobado);
 * el `mode` solo cambia el copy/título — el submit es el MISMO `createTemplate`.
 */
export function TemplateFormModal({
  open,
  mode,
  initial,
  busy = false,
  serverError,
  onSubmit,
  onCancel,
}: TemplateFormModalProps) {
  const [friendlyName, setFriendlyName] = useState('');
  const [language, setLanguage] = useState('es');
  const [category, setCategory] = useState<TemplateCategory | ''>('');
  const [body, setBody] = useState('');
  const [attempted, setAttempted] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Reset de campos + foco inicial al ABRIR (keyed solo en `open` para no
  // pisar lo que tipea el operador en cada render — mismo criterio que ConfirmModal).
  useEffect(() => {
    if (!open) return;
    setFriendlyName(initial?.friendlyName ?? '');
    setLanguage(initial?.language ?? 'es');
    setCategory((initial?.category as TemplateCategory | undefined) ?? '');
    setBody(initial?.body ?? '');
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

  const trimmedName = friendlyName.trim();
  const trimmedBody = body.trim();
  const nameError = trimmedName.length === 0;
  const bodyError = trimmedBody.length === 0;
  const categoryError = category === '';
  const isValid = !nameError && !bodyError && !categoryError;

  const variables = extractVariables(body);
  const segments = splitTemplateBody(body);

  function handleSubmit() {
    setAttempted(true);
    if (!isValid || busy) return;
    onSubmit({
      friendlyName: trimmedName,
      language: language.trim() || 'es',
      category: category as TemplateCategory,
      body,
      variables,
    });
  }

  const title = mode === 'clone' ? 'Clonar template' : 'Nuevo template';
  const submitLabel = mode === 'clone' ? 'Clonar y crear' : 'Crear template';

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
          {mode === 'clone'
            ? 'Meta no deja editar un template aprobado. Esto crea una VERSIÓN NUEVA con el cuerpo modificado; después hay que enviarla a aprobación.'
            : 'Creá el template. Queda en Borrador hasta que lo envíes a aprobación de WhatsApp.'}
        </p>

        {serverError && (
          <p className={styles.error} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="template-friendlyName" className={styles.label}>Nombre visible</label>
          <input
            ref={firstFieldRef}
            id="template-friendlyName"
            type="text"
            className={styles.input}
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            aria-invalid={attempted && nameError || undefined}
            aria-describedby={attempted && nameError ? 'template-friendlyName-error' : undefined}
          />
          {attempted && nameError && (
            <span id="template-friendlyName-error" className={styles.fieldError} role="alert">
              El nombre es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="template-language" className={styles.label}>Idioma</label>
            <input
              id="template-language"
              type="text"
              className={styles.input}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <Select
              label="Categoría"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={(v) => setCategory(v as TemplateCategory)}
              placeholder="Elegí una categoría…"
              aria-invalid={attempted && categoryError}
              aria-describedby={attempted && categoryError ? 'template-category-error' : undefined}
            />
            {attempted && categoryError && (
              <span id="template-category-error" className={styles.fieldError} role="alert">
                Elegí una categoría.
              </span>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="template-body" className={styles.label}>Cuerpo del mensaje</label>
          <textarea
            id="template-body"
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Hola {{1}}, tu saldo de ${{2}} vence pronto."
            aria-invalid={attempted && bodyError || undefined}
            aria-describedby={attempted && bodyError ? 'template-body-error' : undefined}
          />
          {attempted && bodyError && (
            <span id="template-body-error" className={styles.fieldError} role="alert">
              El cuerpo no puede estar vacío.
            </span>
          )}
        </div>

        <div className={styles.previewBlock}>
          <span className={styles.previewLabel}>Vista previa</span>
          <p className={styles.preview} data-testid="template-preview">
            {trimmedBody.length === 0 ? (
              <span className={styles.previewEmpty}>Escribí el cuerpo para ver la vista previa.</span>
            ) : (
              segments.map((seg, i) =>
                seg.isVar ? (
                  <mark key={i} className={styles.placeholder}>{seg.text}</mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )
            )}
          </p>
          <p className={styles.variables}>
            {variables.length > 0
              ? `Variables detectadas: ${variables.map((v) => `{{${v}}}`).join(', ')}`
              : 'Sin variables.'}
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? 'Creando…' : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
