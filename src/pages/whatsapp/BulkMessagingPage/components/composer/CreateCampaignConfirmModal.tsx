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
  /**
   * bulk-csv-recipients (CSV-FE-9) — cuántos contactos vinieron del archivo
   * CSV cargado (`csvContacts.length`, crudo del FE — igual criterio que
   * `manualCount`: el `total` real es la unión dedup del BE, esto sólo suma
   * la línea "del archivo" al resumen). Opcional (default 0 = sin CSV).
   */
  csvCount?: number;
  /**
   * bulk-granular-perms (F1 review adversarial) — cuántos contactos vinieron
   * del tab "Números" (`numbersContacts.length`, crudo del FE — mismo criterio
   * "hasta N" que `csvCount`/`manualCount`: el `total` real es la unión dedup
   * del BE, esto sólo nombra la fuente en el checkpoint). Opcional (default 0).
   */
  numbersCount?: number;
  /** `previewData.statusCounts` — desglose de matcheados por estado. */
  statusCounts: Record<string, number>;
  /** `previewData.skipped` — excluidos del envío (opt-out / duplicado / inválido). Opcional. */
  skipped?: PreviewSegmentOutput['skipped'];
  /**
   * node-segment-fe — NOMBRE del nodo elegido como filtro del segmento (el
   * composer lo resuelve del catálogo; el operador revisa nombres, no uuids).
   * Opcional: sin filtro de red, la fila no se muestra (cero cambio visual).
   */
  networkSiteName?: string;
  /** node-segment-fe — NOMBRE del Access Point elegido (puede venir sin nodo). */
  accessPointName?: string;
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
  csvCount = 0,
  numbersCount = 0,
  statusCounts,
  skipped,
  networkSiteName,
  accessPointName,
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
          {/* node-segment-fe — el filtro de red por NOMBRE (nodo y/o AP; el AP
              puede venir solo). Sin filtro, la fila entera se omite. */}
          {(networkSiteName || accessPointName) && (
            <div className={styles.summaryRow}>
              <dt className={styles.summaryTerm}>Filtro de red</dt>
              <dd className={styles.summaryValue}>
                {networkSiteName ? `Nodo: ${networkSiteName}` : ''}
                {networkSiteName && accessPointName ? ' · ' : ''}
                {accessPointName ? `AP: ${accessPointName}` : ''}
              </dd>
            </div>
          )}
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
              {csvCount > 0 && (
                // bulk-csv-recipients (CSV-FE-9) — mismo criterio "hasta N" que
                // `manualCount`: `csvCount` es el largo CRUDO del archivo, `total`
                // es la unión dedup real.
                <span className={styles.manualNote}>
                  {' '}(incluye hasta {csvCount} del archivo CSV)
                </span>
              )}
              {numbersCount > 0 && (
                // bulk-granular-perms (F1) — mismo criterio "hasta N": `numbersCount`
                // es el largo CRUDO del tab Números, `total` es la unión dedup real.
                <span className={styles.manualNote}>
                  {' '}(incluye hasta {numbersCount} número{numbersCount === 1 ? '' : 's'} suelto
                  {numbersCount === 1 ? '' : 's'})
                </span>
              )}
            </dd>
          </div>
        </dl>

        {/* bulk-csv-recipients (CSV-FE-9) — conteo explícito de clientes de baja
            (flag NO-excluyente, D7): `statusCounts.baja` ya viaja en el desglose
            genérico de abajo, pero acá se nombra en una frase legible sin que el
            operador tenga que sumar la fila del desglose él mismo. */}
        {(statusCounts.baja ?? 0) > 0 && (
          <p className={styles.bajaNote}>
            {statusCounts.baja} cliente{statusCounts.baja === 1 ? '' : 's'} de baja
          </p>
        )}

        {/* Scope adicional (root cause confirmado con el usuario 2026-07-16):
            el `lead` de arriba ya dice "todavía no se envía nada", pero un
            operador se puede quedar con la sensación de que este modal es la
            confirmación de ENVÍO (por el resumen de impacto tipo "vas a
            afectar a N clientes"). Esta línea nombra el PRÓXIMO PASO concreto
            — sin esto, el usuario creaba la campaña, aterrizaba en "pending"
            y creía que ya estaba enviada; nunca clickeaba "Enviar campaña". */}
        <p className={styles.nextStep}>
          La campaña se crea en estado <strong>Pendiente</strong> — el envío se dispara después, desde el
          detalle, con el botón «Enviar campaña».
        </p>

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
