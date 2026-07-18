import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCreateNewsPost, useUpdateNewsPost } from '@/hooks/useNews';
import { Select } from '@/components/molecules/Select/Select';
import { NewsAttachmentsManager } from './NewsAttachmentsManager';
import type { NewsCategory, NewsPost } from '@/types/news';
import styles from './NewsPostModal.module.css';

/** Elementos tabulables dentro del modal (focus-trap), molde ConfirmModal. */
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

interface ApiErrorLike {
  response?: { status?: number; data?: { code?: string } };
}

function mapSaveError(err: unknown): string {
  const e = err as ApiErrorLike;
  const status = e.response?.status;
  const code = e.response?.data?.code;
  if (status === 422 || code === 'NEWS_CATEGORY_NOT_FOUND') {
    return 'La categoría seleccionada ya no existe. Elegí otra.';
  }
  if (status === 404) {
    return 'La noticia ya no existe — puede haber sido eliminada.';
  }
  if (status === 400) {
    return 'No se pudo guardar: revisá los campos.';
  }
  return 'No se pudo guardar la noticia. Intentá de nuevo.';
}

interface NewsPostModalProps {
  categories: NewsCategory[];
  /** Present → edit mode; absent → create mode. */
  initial?: NewsPost;
  onClose: () => void;
}

/**
 * NewsPostModal (internal-news FE apply, NEWS-FE-BD-5) — create/edit form.
 * Portal + focus-trap + Esc + overlay-click, molde `ConfirmModal.tsx`. Initial
 * focus on the title field. Doble validación: submit deshabilitado hasta que
 * título/body/categoría son válidos en FE; errores 400/404/422 del BE se
 * mapean a un mensaje visible (`role="alert"`) sin cerrar el modal.
 */
export function NewsPostModal({ categories, initial, onClose }: NewsPostModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [categoryId, setCategoryId] = useState(initial?.category.id ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateNewsPost();
  const updateMutation = useUpdateNewsPost();
  const saving = createMutation.isPending || updateMutation.isPending;

  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const titleFieldId = `${baseId}-title`;
  const bodyFieldId = `${baseId}-body`;

  const isValid = title.trim().length > 0 && body.trim().length > 0 && categoryId.length > 0;

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
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
  }, [onClose]);

  async function handleSave() {
    if (!isValid || saving) return;
    setError(null);
    const payload = { title: title.trim(), body: body.trim(), categoryId, pinned };
    try {
      if (initial) {
        await updateMutation.mutateAsync({ id: initial.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(mapSaveError(err));
    }
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-heading`}
      >
        <h2 id={`${baseId}-heading`} className={styles.modalTitle}>
          {initial ? 'Editar noticia' : 'Nueva noticia'}
        </h2>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor={titleFieldId}>Título *</label>
          <input
            ref={titleRef}
            id={titleFieldId}
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ej: Corte programado en Nodo Centro"
          />
        </div>

        <div className={styles.field}>
          <Select
            label="Categoría"
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Elegí una categoría…"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={bodyFieldId}>Cuerpo *</label>
          <textarea
            id={bodyFieldId}
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={20000}
            rows={6}
            placeholder="Detalle de la noticia…"
          />
        </div>

        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Fijada (aparece siempre arriba del tablón)
        </label>

        <div className={styles.attachmentsSection}>
          <h3 className={styles.sectionHeading}>Adjuntos</h3>
          {initial ? (
            <NewsAttachmentsManager postId={initial.id} initialAttachments={initial.attachments} />
          ) : (
            <p className={styles.attachmentsHint}>
              Vas a poder agregar imágenes, archivos y enlaces después de crear la noticia.
            </p>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
