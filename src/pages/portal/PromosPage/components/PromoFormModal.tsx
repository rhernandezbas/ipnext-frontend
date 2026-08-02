import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import { useAudiencePreview } from '@/hooks/usePromos';
import { hasSegmentCriteria } from '@/pages/whatsapp/BulkMessagingPage/components/composer/segmentCriteria';
import { SegmentBuilder } from '@/pages/whatsapp/BulkMessagingPage/components/composer/SegmentBuilder';
import type { CampaignSegment } from '@/types/messagingBulk';
import type { PromoAdminDto } from '@/types/promos';
import type { CreatePromoInput } from '@/api/promos.api';
import { PromoAudiencePreviewPanel } from './PromoAudiencePreviewPanel';
import styles from './PromoFormModal.module.css';

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

/** Convierte un ISO del BE al formato "YYYY-MM-DDTHH:mm" que espera <input datetime-local>, en hora LOCAL — mismo helper que `DatosForm.tsx` (allowlisteado en el guard no-browser-tz por el mismo motivo: el round-trip de datetime-local exige partes locales). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

/** Inverso de `toLocalInput`: datetime-local → ISO para el payload del BE. */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const EMPTY_SEGMENT: CampaignSegment = { statuses: [] };

const PREVIEW_DEBOUNCE_MS = 500;

const TITLE_ID = 'promo-form-title';

interface PromoFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** La promo original al editar — precarga TODOS los campos (incluido el segmento). `null`/omitido en 'create'. */
  initial?: PromoAdminDto | null;
  busy?: boolean;
  /** Error del servidor — se muestra en un role=alert, el modal NO se cierra. */
  serverError?: string | null;
  onSubmit: (input: CreatePromoInput) => void;
  onCancel: () => void;
}

/**
 * PromoFormModal (promos-admin) — form de crear/editar una promoción. REUSA
 * `SegmentBuilder` de Bulk Messaging TAL CUAL (mismo `CampaignSegment`, mismo
 * componente — `hasNetworkFilterTab={false}` porque esta pantalla no tiene la
 * pestaña Nodo/AP) y `hasSegmentCriteria` de `segmentCriteria.ts` para gatear
 * el preview de audiencia — CERO reimplementación del criterio "¿hay
 * criterio?", que es exactamente el bug de desincronización que el proposal
 * pidió evitar.
 *
 * El preview de audiencia es AUTOMÁTICO (debounce ~500ms al cambiar el
 * segmento, mismo criterio que el composer de campañas) — no hace falta un
 * botón "Ver preview": acá no hay sample/desglose que justifique un modal
 * aparte, son dos números.
 *
 * `imageStorageKey` NO tiene campo en este form a propósito: el BE lo
 * rechaza en create/update (no existe endpoint de upload/servido todavía) —
 * agregarlo produciría una imagen ROTA en la app del cliente. Ver el mismo
 * comentario en `promos.api.ts`.
 */
export function PromoFormModal({ open, mode, initial, busy = false, serverError, onSubmit, onCancel }: PromoFormModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ticketAreaId, setTicketAreaId] = useState('');
  const [startsAtLocal, setStartsAtLocal] = useState('');
  const [endsAtLocal, setEndsAtLocal] = useState('');
  const [segment, setSegment] = useState<CampaignSegment>(EMPTY_SEGMENT);
  const [attempted, setAttempted] = useState(false);

  const { data: ticketAreas } = useTicketAreas();
  const { preview, data: audienceData, isPending: audiencePending, isError: audienceError, reset: resetAudience } = useAudiencePreview();

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Reset de campos + precarga (edit) + foco inicial al ABRIR — keyed solo en
  // `open` (mismo criterio que TemplateFormModal), así no se pisa lo que
  // tipea el operador en cada render.
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setSummary(initial?.summary ?? '');
    setBody(initial?.body ?? '');
    setCtaLabel(initial?.ctaLabel ?? '');
    setTicketAreaId(initial?.ticketAreaId ?? '');
    setStartsAtLocal(toLocalInput(initial?.startsAt ?? null));
    setEndsAtLocal(toLocalInput(initial?.endsAt ?? null));
    // null → undefined: el `SegmentBuilder` habla `CampaignSegment` (undefined
    // = sin filtro); el BE devuelve `null` para lo mismo. `??` normaliza el
    // shape del wire al shape del builder, sin tocar el dominio de ninguno.
    setSegment(
      initial?.segment
        ? {
            statuses: initial.segment.statuses,
            balanceMin: initial.segment.balanceMin ?? undefined,
            balanceMax: initial.segment.balanceMax ?? undefined,
            networkSiteId: initial.segment.networkSiteId ?? undefined,
            accessPointId: initial.segment.accessPointId ?? undefined,
          }
        : EMPTY_SEGMENT,
    );
    setAttempted(false);
    resetAudience();
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir/cerrar, ver TemplateFormModal
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

  const hasCriteria = hasSegmentCriteria(segment);

  // Preview automático con debounce ~500ms al cambiar el segmento — molde
  // EXACTO del composer de campañas (`CampaignComposer.tsx`, comentario "SEG
  // (composer)"). Deps primitivas (no el objeto `segment`, que cambia de
  // identidad en cada render).
  useEffect(() => {
    if (!open) return;
    resetAudience();
    if (!hasCriteria) return;
    const timer = setTimeout(() => {
      preview(segment);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps primitivas a propósito, ver CampaignComposer
  }, [open, segment.statuses.join(','), segment.balanceMin, segment.balanceMax, segment.networkSiteId, segment.accessPointId]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const trimmedSummary = summary.trim();
  const trimmedBody = body.trim();
  const trimmedCta = ctaLabel.trim();
  const titleError = trimmedTitle.length === 0;
  const summaryError = trimmedSummary.length === 0;
  const bodyError = trimmedBody.length === 0;
  const ctaError = trimmedCta.length === 0;
  const startsAtError = startsAtLocal.length === 0;
  const endsAtError = endsAtLocal.length === 0;
  const rangeError =
    !startsAtError && !endsAtError && toIso(startsAtLocal) && toIso(endsAtLocal)
      ? new Date(startsAtLocal).getTime() >= new Date(endsAtLocal).getTime()
      : false;
  const isValid =
    !titleError && !summaryError && !bodyError && !ctaError && !startsAtError && !endsAtError && !rangeError;

  const ticketAreaOptions: SelectOption[] = [
    { value: '', label: 'Sin área asociada' },
    ...(ticketAreas ?? []).map((a) => ({ value: a.id, label: a.name })),
  ];

  function handleSubmit() {
    setAttempted(true);
    if (!isValid || busy) return;
    const startsAtIso = toIso(startsAtLocal);
    const endsAtIso = toIso(endsAtLocal);
    if (!startsAtIso || !endsAtIso) return;
    onSubmit({
      title: trimmedTitle,
      summary: trimmedSummary,
      body: trimmedBody,
      ctaLabel: trimmedCta,
      ticketAreaId: ticketAreaId === '' ? null : ticketAreaId,
      segment,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    });
  }

  const title2 = mode === 'edit' ? 'Editar promoción' : 'Nueva promoción';
  const submitLabel = mode === 'edit' ? 'Guardar cambios' : 'Crear promoción';

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
    >
      <div className={styles.dialog} ref={dialogRef}>
        <h2 id={TITLE_ID} className={styles.title}>
          {title2}
        </h2>

        {serverError && (
          <p className={styles.error} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="promo-title" className={styles.label}>
            Título
          </label>
          <input
            ref={firstFieldRef}
            id="promo-title"
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={(attempted && titleError) || undefined}
          />
          {attempted && titleError && (
            <span className={styles.fieldError} role="alert">
              El título es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="promo-summary" className={styles.label}>
            Resumen
          </label>
          <input
            id="promo-summary"
            type="text"
            className={styles.input}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-invalid={(attempted && summaryError) || undefined}
          />
          {attempted && summaryError && (
            <span className={styles.fieldError} role="alert">
              El resumen es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="promo-body" className={styles.label}>
            Cuerpo
          </label>
          <textarea
            id="promo-body"
            className={styles.textarea}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-invalid={(attempted && bodyError) || undefined}
          />
          {attempted && bodyError && (
            <span className={styles.fieldError} role="alert">
              El cuerpo es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="promo-cta" className={styles.label}>
              Texto del botón (CTA)
            </label>
            <input
              id="promo-cta"
              type="text"
              className={styles.input}
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              aria-invalid={(attempted && ctaError) || undefined}
            />
            {attempted && ctaError && (
              <span className={styles.fieldError} role="alert">
                El texto del botón es obligatorio.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <Select
              label="Área del reclamo (opcional)"
              options={ticketAreaOptions}
              value={ticketAreaId}
              onChange={setTicketAreaId}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="promo-starts" className={styles.label}>
              Vigencia desde
            </label>
            <input
              id="promo-starts"
              type="datetime-local"
              className={styles.input}
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
              aria-invalid={(attempted && startsAtError) || undefined}
            />
            {attempted && startsAtError && (
              <span className={styles.fieldError} role="alert">
                La fecha de inicio es obligatoria.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="promo-ends" className={styles.label}>
              Vigencia hasta
            </label>
            <input
              id="promo-ends"
              type="datetime-local"
              className={styles.input}
              value={endsAtLocal}
              onChange={(e) => setEndsAtLocal(e.target.value)}
              aria-invalid={(attempted && endsAtError) || undefined}
            />
            {attempted && endsAtError && (
              <span className={styles.fieldError} role="alert">
                La fecha de fin es obligatoria.
              </span>
            )}
          </div>
        </div>
        {attempted && rangeError && (
          <span className={styles.fieldError} role="alert">
            La fecha de fin tiene que ser posterior a la de inicio.
          </span>
        )}

        {/* imageStorageKey es READ-ONLY en el BE (siempre null) — NO agregar un
            campo de imagen acá sin la rebanada completa (upload + storage +
            endpoint de servido). Ver `promos.api.ts` / `types/promos.ts`. */}

        <SegmentBuilder value={segment} onChange={setSegment} hasNetworkFilterTab={false} />

        <PromoAudiencePreviewPanel
          hasCriteria={hasCriteria}
          isPending={audiencePending}
          isError={audienceError}
          data={audienceData}
          onRetry={() => preview(segment)}
        />

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
