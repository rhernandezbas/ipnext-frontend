import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import type { PreviewSegmentOutput } from '@/types/messagingBulk';
import styles from './CreateCampaignConfirmModal.module.css';

/** Elementos tabulables dentro del diálogo (para el focus-trap) — mismo criterio que `ConfirmModal`/`PreviewModal`. */
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

/** Client statuses conocidos por `StatusBadge` (mismo union que `PreviewModal`/`SegmentBuilder`, no exportado desde ahí). */
const KNOWN_STATUSES = ['active', 'late', 'blocked', 'inactive', 'baja'] as const;
type KnownStatus = (typeof KNOWN_STATUSES)[number];

function isKnownStatus(status: string): status is KnownStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(status);
}

/** El status del `statusCounts` puede no estar en el union de `StatusBadge` — fallback a texto plano (nunca solo color, y nunca rompe). */
function StatusCell({ status }: { status: string }) {
  return isKnownStatus(status) ? <StatusBadge status={status} /> : <span className={styles.statusFallback}>{status}</span>;
}

const TITLE_ID = 'bulk-create-confirm-title';
const LEAD_ID = 'bulk-create-confirm-lead';

interface CreateCampaignConfirmModalProps {
  open: boolean;
  /** Nombre ya trimmeado de la campaña a crear. */
  campaignName: string;
  /** `template.friendlyName` del template elegido. */
  templateName: string;
  /** `previewData.count` — total de destinatarios (unión dedup de segmento + lista manual). */
  total: number;
  /**
   * manual-recipients-fe (CONF-1) — cuántos destinatarios provienen de la lista
   * manual. El `total` ya es la unión dedup calculada por el BE; esto sólo aclara
   * que una parte se agregó a mano. Opcional (default 0 = campaña sólo por segmento).
   */
  manualCount?: number;
  /** `previewData.statusCounts` — desglose de matcheados por estado. */
  statusCounts: Record<string, number>;
  /** `previewData.skipped` — excluidos del envío (opt-out / duplicado / inválido). Opcional. */
  skipped?: PreviewSegmentOutput['skipped'];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * CreateCampaignConfirmModal (bulk-composer-polish #5) — doble-confirmación
 * con impacto explícito ANTES de crear una campaña (regla innegociable de
 * front: acciones con costo → confirmar con resumen).
 *
 * NO reusa el `ConfirmModal` compartido (sólo acepta `message: string`, no un
 * desglose rico) ni el `PreviewModal` (en prod, solo-lectura, tabla paginada)
 * — sí REUSA su shell de a11y: portal a document.body, foco inicial dentro del
 * diálogo, focus-trap cíclico (Tab/Shift+Tab), Esc/backdrop cancelan,
 * restauración de foco al cerrar y scroll-lock del body.
 *
 * Todo el contenido llega por props (`previewData` ya está en memoria por el
 * gate `canCreate` del composer) — CERO fetch nuevo. `tone` default: crear una
 * campaña en `pending` NO es destructivo (el envío es otro paso, con su propia
 * confirmación) — por eso el copy deja EXPLÍCITO que acá NO se envía nada.
 */
export function CreateCampaignConfirmModal({
  open,
  campaignName,
  templateName,
  total,
  manualCount = 0,
  statusCounts,
  skipped,
  onConfirm,
  onCancel,
}: CreateCampaignConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Foco inicial (al confirmar — acción positiva, tone default) + restauración
  // al cerrar. Keyed SOLO en `open` (mismo criterio que `ConfirmModal`) para no
  // reiniciar el foco en cada render por la identidad de `onCancel`/`onConfirm`.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
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

  const statusEntries = Object.entries(statusCounts);
  const hasSkipped = !!skipped && (skipped.optedOut > 0 || skipped.duplicatePhone > 0 || skipped.invalidPhone > 0);

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
        <h2 id={TITLE_ID} className={styles.title}>Revisá la nueva campaña</h2>

        <p id={LEAD_ID} className={styles.lead}>
          Estás por <strong>crear</strong> esta campaña. Queda en estado pendiente y{' '}
          <strong>todavía no se envía nada</strong>: el envío es un paso aparte, con su propia confirmación.
        </p>

        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt className={styles.summaryTerm}>Campaña</dt>
            <dd className={styles.summaryValue}>{campaignName}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt className={styles.summaryTerm}>Template</dt>
            <dd className={styles.summaryValue}>{templateName}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt className={styles.summaryTerm}>Destinatarios</dt>
            <dd className={styles.summaryValue}>
              <strong className={styles.total}>{total}</strong>{' '}
              {total === 1 ? 'cliente' : 'clientes'}
              {manualCount > 0 && (
                // FIX 8 — `manualCount` es el largo CRUDO de la lista FE; `total`
                // es la unión dedup del BE (descuenta overlap/opt-out/inexistentes)
                // y puede ser MENOR. "hasta N" evita el copy contradictorio
                // ("2 clientes (incluye 3 agregados manualmente)").
                <span className={styles.manualNote}>
                  {' '}(incluye hasta {manualCount} agregado{manualCount === 1 ? '' : 's'} manualmente)
                </span>
              )}
            </dd>
          </div>
        </dl>

        {statusEntries.length > 0 && (
          <div className={styles.breakdown}>
            <h3 className={styles.breakdownTitle} id="bulk-create-confirm-breakdown">Desglose por estado</h3>
            <ul className={styles.statusList} aria-labelledby="bulk-create-confirm-breakdown">
              {statusEntries.map(([status, count]) => (
                <li key={status} className={styles.statusItem}>
                  <StatusCell status={status} />
                  <span className={styles.statusCount}>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasSkipped && skipped && (
          <div className={styles.breakdown}>
            <h3 className={styles.breakdownTitle} id="bulk-create-confirm-skipped">Excluidos del envío</h3>
            <ul className={styles.skippedList} aria-labelledby="bulk-create-confirm-skipped">
              {skipped.optedOut > 0 && <li>Optaron por no recibir mensajes: {skipped.optedOut}</li>}
              {skipped.duplicatePhone > 0 && <li>Teléfono duplicado (colapsado): {skipped.duplicatePhone}</li>}
              {skipped.invalidPhone > 0 && <li>Teléfono ausente o inválido: {skipped.invalidPhone}</li>}
            </ul>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancelar
          </button>
          <button ref={confirmRef} type="button" className={styles.confirm} onClick={onConfirm}>
            Confirmar y crear
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
