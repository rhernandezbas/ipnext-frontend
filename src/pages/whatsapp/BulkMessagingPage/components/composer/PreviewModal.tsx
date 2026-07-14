import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { Skeleton } from '@/pages/whatsapp/WhatsappInboxPage/components/Skeleton';
import { useSegmentRecipients } from '@/hooks/useBulkMessaging';
import { renderPreviewMessage } from './previewMessage';
import type { CampaignSegment, CampaignVariableSpec, SegmentRecipientDto } from '@/types/messagingBulk';
import styles from './PreviewModal.module.css';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  segment: CampaignSegment;
  /** `selectedTemplate?.body` — puede no haber template elegido todavía (SegmentPreviewPanel no lo exige). */
  templateBody: string | undefined;
  variablesMap: CampaignVariableSpec;
}

const LIMIT = 20;

/** `SegmentRecipientDto` no trae `id` (sólo `clientId`) — `DataTable<T>` lo exige para keys/selección. */
type RecipientRow = SegmentRecipientDto & { id: string };

const TITLE_ID = 'bulk-preview-modal-title';
const MESSAGE_HEADING_ID = 'bulk-preview-modal-message';
const SUMMARY_HEADING_ID = 'bulk-preview-modal-summary';
const RECIPIENTS_HEADING_ID = 'bulk-preview-modal-recipients';

/** Elementos tabulables dentro del diálogo (para el focus-trap) — mismo criterio que `ConfirmModal`. */
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

/** Client statuses conocidos por `StatusBadge` (mismo union que `SegmentBuilder`, no exportado desde ahí). */
const KNOWN_STATUSES = ['active', 'late', 'blocked', 'inactive', 'baja'] as const;
type KnownStatus = (typeof KNOWN_STATUSES)[number];

function isKnownStatus(status: string): status is KnownStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(status);
}

/** El status de un recipient/statusCount puede no estar en el union de `StatusBadge` — fallback a texto plano (nunca solo color, y nunca rompe). */
function StatusCell({ status }: { status: string }) {
  return isKnownStatus(status) ? <StatusBadge status={status} /> : <span className={styles.statusFallback}>{status}</span>;
}

/**
 * PreviewModal (messaging-bulk-v11 FE apply chunk 2) — vista COMPLETA del
 * envío antes de crear la campaña: el mensaje real (`template.body` con cada
 * `{{N}}` resuelto), el resumen (total + desglose por estado + skipped) y los
 * destinatarios PAGINADOS server-side (`useSegmentRecipients`, chunk 1 — a
 * diferencia de `usePreviewSegment`, que trunca a una muestra de 20).
 *
 * Se abre desde `SegmentPreviewPanel` ("Ver preview"); la query recién se
 * dispara al abrir (`enabled: open`) — SegmentPreviewPanel ya muestra un
 * indicador liviano (el count de `usePreviewSegment`) sin necesidad de esta
 * query, así que acá no hay motivo para pedirla antes de que el operador la
 * pida explícitamente.
 *
 * Shell de accesibilidad calcado de `ConfirmModal` (portal a `document.body`,
 * foco inicial + focus-trap cíclico con Tab/Shift+Tab, restauración de foco,
 * Esc/backdrop cierran, scroll-lock del body) — NO se reinventa, sólo se
 * adapta para contenido rico (no title+message+dos botones).
 */
export function PreviewModal({ open, onClose, segment, templateBody, variablesMap }: PreviewModalProps) {
  const [page, setPage] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const { data, isLoading, isError, isPlaceholderData } = useSegmentRecipients(segment, page, LIMIT, open);

  // FIX-1 — `keepPreviousData` mantiene la paginación SUAVE dentro del mismo
  // segmento, pero al reabrir con OTRO segmento devolvería los destinatarios
  // del segmento ANTERIOR como placeholder (con `isLoading=false`), y en un
  // preview antes-de-enviar mostrar el segmento equivocado es PELIGROSO.
  // Trackeamos el segmento cuya data ya "asentó" (no-placeholder); si el
  // placeholder actual es de OTRO segmento, forzamos el skeleton en lugar de
  // pintar data ajena. El `setState` condicional en render es el patrón
  // oficial de React para "ajustar estado ante un cambio de prop" (no dispara
  // loop: en el re-render la condición ya no se cumple) y NO rompe la
  // paginación — el placeholder del MISMO segmento sí se sigue mostrando.
  const segmentKey = JSON.stringify(segment);
  const [settledSegmentKey, setSettledSegmentKey] = useState<string | null>(null);
  if (!isPlaceholderData && data && settledSegmentKey !== segmentKey) {
    setSettledSegmentKey(segmentKey);
  }
  const showStaleSegment = isPlaceholderData && settledSegmentKey !== segmentKey;
  const showLoading = isLoading || showStaleSegment;

  // FIX-5 — resetea la página a 1 al CERRAR (no al abrir). Reseteándolo en un
  // effect al abrir, el PRIMER render ya habilitó la query con la página vieja
  // → un fetch redundante que se vuelve a disparar al pasar a 1 (doble fetch).
  // Al hacerlo en el cierre (query deshabilitada, `enabled: open`), la próxima
  // apertura arranca en `page=1` sin fetch de más.
  useEffect(() => {
    if (!open) setPage(1);
  }, [open]);

  // Foco inicial (al botón "Cerrar") + restauración al cerrar. Keyed SOLO en
  // `open` (mismo criterio que `ConfirmModal`) para no reiniciar el foco en
  // cada render por identidad de `onClose`.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll lock + teclado (Esc cierra, Tab atrapa el foco dentro del diálogo).
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open) return null;

  const rows: RecipientRow[] = (data?.data ?? []).map((r) => ({ ...r, id: r.clientId }));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || LIMIT))) : 1;

  const columns: { label: string; key: string; render?: (row: RecipientRow) => JSX.Element }[] = [
    { label: 'Nombre', key: 'name' },
    { label: 'Teléfono', key: 'phoneE164' },
    { label: 'Estado', key: 'status', render: (row) => <StatusCell status={row.status} /> },
  ];

  const hasSkipped = !!data && (data.skipped.optedOut > 0 || data.skipped.duplicatePhone > 0 || data.skipped.invalidPhone > 0);

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
    >
      <div className={styles.dialog} ref={dialogRef}>
        <div className={styles.header}>
          <h2 id={TITLE_ID} className={styles.title}>Preview del envío</h2>
          <button ref={closeRef} type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <section aria-labelledby={MESSAGE_HEADING_ID}>
            <h3 id={MESSAGE_HEADING_ID} className={styles.sectionTitle}>Mensaje</h3>
            {templateBody ? (
              <p className={styles.messageBubble}>{renderPreviewMessage(templateBody, variablesMap)}</p>
            ) : (
              <p className={styles.notice} role="status">
                Elegí un template para ver el mensaje que se va a enviar.
              </p>
            )}
          </section>

          {showLoading && (
            <div className={styles.loading} aria-busy="true">
              <p role="status" className={styles.srOnlyStatus}>Cargando destinatarios…</p>
              <Skeleton height={20} />
              <Skeleton height={20} width="70%" />
              <Skeleton height={20} width="50%" />
            </div>
          )}

          {!showLoading && isError && (
            <p className={styles.error} role="alert">
              No se pudieron cargar los destinatarios. Reintentá.
            </p>
          )}

          {/* role="status" (no "alert"): a diferencia del "0 destinatarios" de
              `SegmentPreviewPanel` (que SÍ bloquea "Crear campaña" y amerita
              assertive), acá es informativo — el gate real de creación ya
              vive afuera del modal. */}
          {!showLoading && !isError && data && data.total === 0 && (
            <p className={styles.emptyResult} role="status">
              Sin destinatarios para este segmento.
            </p>
          )}

          {!showLoading && !isError && data && data.total > 0 && (
            <>
              <section aria-labelledby={SUMMARY_HEADING_ID}>
                <h3 id={SUMMARY_HEADING_ID} className={styles.sectionTitle}>Resumen</h3>
                <p className={styles.count} aria-live="polite">
                  <strong>{data.total}</strong> destinatario{data.total === 1 ? '' : 's'} recibirán el mensaje
                </p>

                {Object.keys(data.statusCounts).length > 0 && (
                  <ul className={styles.statusList} aria-label="Desglose por estado">
                    {Object.entries(data.statusCounts).map(([status, count]) => (
                      <li key={status} className={styles.statusItem}>
                        <StatusCell status={status} />
                        <span>{count}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {hasSkipped && (
                  <ul className={styles.skippedList} aria-label="Excluidos del envío">
                    {data.skipped.optedOut > 0 && <li>Optaron por no recibir mensajes: {data.skipped.optedOut}</li>}
                    {data.skipped.duplicatePhone > 0 && <li>Teléfono duplicado (colapsado): {data.skipped.duplicatePhone}</li>}
                    {data.skipped.invalidPhone > 0 && <li>Teléfono ausente o inválido: {data.skipped.invalidPhone}</li>}
                  </ul>
                )}
              </section>

              <section aria-labelledby={RECIPIENTS_HEADING_ID}>
                <h3 id={RECIPIENTS_HEADING_ID} className={styles.sectionTitle}>Destinatarios</h3>
                <DataTable<RecipientRow>
                  columns={columns}
                  data={rows}
                  loading={false}
                  emptyMessage="No hay destinatarios para este segmento."
                />
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
