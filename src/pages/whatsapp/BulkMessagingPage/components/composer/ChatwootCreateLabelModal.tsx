import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './ChatwootCreateLabelModal.module.css';

/** Elementos tabulables dentro del diálogo (focus-trap) — mismo criterio que `ConfirmModal`/`CannedResponseFormModal`. */
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

const TITLE_ID = 'chatwoot-create-label-title';
const LEAD_ID = 'chatwoot-create-label-lead';

/** Default real de Chatwoot (`label.rb`, v4.13) — molde D2 del design BE. */
export const CHATWOOT_LABEL_DEFAULT_COLOR = '#1f93ff';

/**
 * Normalización VISIBLE del título (design D6/FE.3, dato verificado del
 * orquestador 2026-07-22 sobre `app/models/label.rb` de Chatwoot v4.13):
 * Chatwoot downcasea el `title` vía `before_validation` y NO acepta espacios
 * — acá se muestra el título REAL que va a quedar ANTES de submitear, para
 * que el operador no se lleve una sorpresa server-side.
 */
export function normalizeChatwootLabelTitle(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

/** `UNICODE_CHARACTER_NUMBER_HYPHEN_UNDERSCORE` real de Chatwoot — letras unicode + números + `-`/`_`, sin otros símbolos. */
const VALID_CHARSET = /^[\p{L}\p{N}_-]+$/u;

interface ChatwootCreateLabelModalProps {
  open: boolean;
  busy?: boolean;
  /** 400 VALIDATION_ERROR / 503 CHATWOOT_UNAVAILABLE del hook — el modal NO se cierra, se muestra role=alert. */
  serverError?: string | null;
  /**
   * Fix wave F2 (LOW-A11Y) — nodo ESTABLE al que restaurar el foco si el que
   * abrió el modal (`document.activeElement` capturado al abrir) ya NO está
   * montado al cerrar. Caso real: el botón "+ Crear label…" de la rama
   * `emptyState` del `ChatwootLabelSelector` se DESMONTA en cuanto el
   * catálogo pasa a tener 1 label (la rama cambia a `success`) — sin este
   * fallback, `.focus()` sobre un nodo desconectado es un no-op silencioso y
   * el foco queda perdido en `document.body`. Opcional: sin él, mantiene el
   * comportamiento previo (best-effort, puede caer a body en ese caso límite).
   */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  onSubmit: (input: { title: string; color: string }) => void;
  onCancel: () => void;
}

/**
 * ChatwootCreateLabelModal (campaign-chatwoot-label, design D6/tasks FE.3) —
 * mini-modal "Crear label…" del `ChatwootLabelSelector`. Shell de a11y calcado
 * de `CannedResponseFormModal`/`ConfirmModal`: portal a document.body,
 * focus-trap cíclico, Esc/backdrop cancelan, restauración de foco, scroll-lock.
 *
 * A diferencia de `CannedResponseFormModal` (validate-on-click), el submit
 * queda DESHABILITADO en vivo mientras el título esté vacío o con charset
 * inválido — mismo criterio que el propio "Crear campaña" del composer
 * (`canCreate` + hint): acá el operador YA ve el preview del título final en
 * tiempo real, así que el disabled no es un dead-end ciego.
 */
export function ChatwootCreateLabelModal({
  open,
  busy = false,
  serverError,
  fallbackFocusRef,
  onSubmit,
  onCancel,
}: ChatwootCreateLabelModalProps) {
  const [rawTitle, setRawTitle] = useState('');
  const [color, setColor] = useState(CHATWOOT_LABEL_DEFAULT_COLOR);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Reset de campos + foco inicial al ABRIR (keyed solo en `open`, mismo criterio que `CannedResponseFormModal`).
  useEffect(() => {
    if (!open) return;
    setRawTitle('');
    setColor(CHATWOOT_LABEL_DEFAULT_COLOR);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      // Fix wave F2 — `el.isConnected` cubre el caso límite donde el nodo que
      // abrió el modal ya se DESMONTÓ mientras estaba abierto (ej. el trigger
      // de la rama `emptyState` tras crear la primera etiqueta): un
      // `.focus()` sobre un nodo desconectado es un no-op silencioso, así que
      // sin este chequeo el foco quedaba perdido en `document.body`.
      if (el && typeof el.focus === 'function' && el.isConnected) {
        el.focus();
      } else {
        fallbackFocusRef?.current?.focus();
      }
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

  const normalizedTitle = normalizeChatwootLabelTitle(rawTitle);
  const titleEmpty = normalizedTitle.length === 0;
  const titleInvalidCharset = !titleEmpty && !VALID_CHARSET.test(normalizedTitle);
  const isValid = !titleEmpty && !titleInvalidCharset;
  // Fix wave F3 — solo se muestra si el operador YA tipeó algo (`rawTitle.length > 0`)
  // que terminó normalizando a vacío (ej. solo espacios); un campo intacto no
  // dispara un error antes de interactuar.
  const showEmptyHint = rawTitle.length > 0 && titleEmpty;
  const titleDescribedBy = showEmptyHint
    ? 'chatwoot-label-title-preview chatwoot-label-title-empty-error'
    : rawTitle.length > 0 && titleInvalidCharset
      ? 'chatwoot-label-title-preview chatwoot-label-title-charset-error'
      : 'chatwoot-label-title-preview';

  function handleSubmit() {
    if (!isValid || busy) return;
    onSubmit({ title: normalizedTitle, color });
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
        <h2 id={TITLE_ID} className={styles.title}>
          Crear label de Chatwoot
        </h2>
        <p id={LEAD_ID} className={styles.lead}>
          Chatwoot guarda el título en minúsculas y con guiones en vez de espacios — revisá el título final antes de
          crear.
        </p>

        {serverError && (
          <p className={styles.error} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="chatwoot-label-title" className={styles.label}>
            Nombre
          </label>
          <input
            ref={firstFieldRef}
            id="chatwoot-label-title"
            type="text"
            className={styles.input}
            value={rawTitle}
            onChange={(e) => setRawTitle(e.target.value)}
            placeholder="Promo Julio"
            aria-invalid={(rawTitle.length > 0 && (titleEmpty || titleInvalidCharset)) || undefined}
            aria-describedby={titleDescribedBy}
          />
          <span id="chatwoot-label-title-preview" className={styles.preview}>
            Título final: <strong>{normalizedTitle || '—'}</strong>
          </span>
          {/* Fix wave F3 — antes el título vacío (ej. solo espacios tipeados)
              dejaba el submit deshabilitado SIN ninguna explicación visible:
              el hint de charset estaba gateado en `!titleEmpty`. Gate en
              `rawTitle.length > 0` (no en el mount sin tocar) — un campo
              INTACTO no muestra un error agresivo antes de interactuar. */}
          {showEmptyHint && (
            <span id="chatwoot-label-title-empty-error" className={styles.fieldError} role="alert">
              El título no puede quedar vacío.
            </span>
          )}
          {rawTitle.length > 0 && titleInvalidCharset && (
            <span id="chatwoot-label-title-charset-error" className={styles.fieldError} role="alert">
              Solo letras, números, guiones y guion bajo (sin espacios ni símbolos).
            </span>
          )}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Color</span>
          <div className={styles.colorRow}>
            {/* Fix wave F1 (MED-A11Y) — ANTES el título se pintaba como texto
                DENTRO del chip coloreado (`readableTextColor(color)` sobre
                `backgroundColor: color`): con el default #1f93ff eso da
                3.15:1 (el util elige blanco vía un umbral de luminancia
                BT.601, que NO es un cálculo de contraste WCAG — negro daría
                5.8:1). Fix: el color vive SOLO en un dot decorativo
                `aria-hidden`; el título va en texto normal (token
                `--color-text-primary`) sobre fondo NEUTRO — cero texto sobre
                color arbitrario, sea cual sea el color elegido. */}
            <span className={styles.swatchPreview}>
              <span
                className={styles.swatchDot}
                style={{ backgroundColor: color }}
                aria-hidden="true"
                data-testid="chatwoot-label-swatch-dot"
              />
              <span className={styles.swatchLabel} data-testid="chatwoot-label-swatch-label">
                {normalizedTitle || 'label'}
              </span>
            </span>
            <input
              type="color"
              className={styles.colorInput}
              aria-label="Color de la etiqueta"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} onClick={handleSubmit} disabled={!isValid || busy}>
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
