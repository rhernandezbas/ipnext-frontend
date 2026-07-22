import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { Skeleton } from '@/pages/whatsapp/WhatsappInboxPage/components/Skeleton';
import { useSegmentRecipients, useExcludedRecipients } from '@/hooks/useBulkMessaging';
import { hasRecipients } from './segmentCriteria';
import { renderPreviewMessage } from './previewMessage';
import { InvalidRecipientsTable } from './InvalidRecipientsTable';
import type {
  CampaignSegment,
  CampaignVariableSpec,
  ManualContactInput,
  SegmentRecipientDto,
  SegmentRecipientsQuery,
} from '@/types/messagingBulk';
import styles from './PreviewModal.module.css';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  segment: CampaignSegment;
  /** `selectedTemplate?.body` — puede no haber template elegido todavía (SegmentPreviewPanel no lo exige). */
  templateBody: string | undefined;
  variablesMap: CampaignVariableSpec;
  /**
   * bulk-csv-recipients (CSV-FE-6) — reemplaza el viejo `manualCount`: ahora
   * el modal pide la UNIÓN COMPLETA (segmento + manuales + CSV) a
   * `/segment/recipients`, así que necesita los ids/contactos reales, no sólo
   * un conteo para un aviso. El BE ya extendió el endpoint (deuda F4
   * cerrada, D11) — la tabla de acá ES la unión, no hace falta ningún aviso.
   */
  manualClientIds?: string[];
  /** bulk-csv-recipients (CSV-FE-6) — contactos crudos del CSV cargado. */
  manualContacts?: ManualContactInput[];
  /** bulk-task-recipients (D8) — subset de estados de tarea tildado en el tab "Tarea". */
  taskStageIds?: string[];
}

const LIMIT = 20;

/** `SegmentRecipientDto.clientId` puede ser `null` (contacto CSV crudo, D11) — `DataTable<T>` exige `id`: `clientId ?? phoneE164` es único dentro del set resuelto. */
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

/** bulk-csv-recipients (D3) — status SINTÉTICO de un contacto CSV crudo (sin vínculo a ningún Client). */
const SYNTHETIC_STATUS_LABELS: Record<string, string> = {
  no_cliente: 'No es cliente',
};

/** El status de un recipient/statusCount puede no estar en el union de `StatusBadge` — fallback a texto plano (nunca solo color, y nunca rompe). */
function StatusCell({ status }: { status: string }) {
  if (isKnownStatus(status)) {
    // CSV-FE-8 — `baja` es un flag NO-excluyente: se señala con texto explícito, no sólo el badge genérico.
    return <StatusBadge status={status} label={status === 'baja' ? 'Cliente de baja' : undefined} />;
  }
  return <span className={styles.statusFallback}>{SYNTHETIC_STATUS_LABELS[status] ?? status}</span>;
}

/**
 * PreviewModal (messaging-bulk-v11 FE apply chunk 2; reescrito en
 * bulk-csv-recipients FE, CSV-FE-6..CSV-FE-8) — vista COMPLETA del envío
 * antes de crear la campaña: el mensaje real (`template.body` con cada
 * `{{N}}` resuelto), el resumen (total + desglose por estado + skipped), los
 * destinatarios PAGINADOS server-side de la UNIÓN completa (segmento +
 * manuales + CSV, `useSegmentRecipients`) y una vista "Excluidos (N)"
 * (`useExcludedRecipients`, `view=excluded`) para corregir el CSV mirando
 * QUIÉN quedó afuera y por qué.
 *
 * CSV-FE-6 — la query ya NO es segment-only: pide el input COMPLETO y se
 * habilita con `hasRecipients` (cualquier fuente con destinatarios), no
 * `hasSegmentCriteria`. El viejo aviso `manualNote` ("el detalle muestra
 * sólo el segmento") se ELIMINA — la tabla ES la unión (cierra la deuda F4).
 *
 * Shell de accesibilidad calcado de `ConfirmModal` (portal a `document.body`,
 * foco inicial + focus-trap cíclico con Tab/Shift+Tab, restauración de foco,
 * Esc/backdrop cierran, scroll-lock del body) — NO se reinventa.
 */
export function PreviewModal({
  open,
  onClose,
  segment,
  templateBody,
  variablesMap,
  manualClientIds = [],
  manualContacts = [],
  taskStageIds = [],
}: PreviewModalProps) {
  const [page, setPage] = useState(1);
  const [excludedPage, setExcludedPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'recipients' | 'excluded'>('recipients');
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // CSV-FE-6 + bulk-task-recipients (D8) — gate REEMPLAZADO: cualquier fuente
  // con destinatarios (segmento, manuales, CSV o el subset de tarea) habilita
  // la query de la UNIÓN completa. Antes sólo el segmento
  // (`hasSegmentCriteria`) — eso era la deuda F4 (el BE no aceptaba
  // `manualClientIds` en este endpoint todavía).
  const hasAnyRecipients = hasRecipients(segment, manualClientIds, manualContacts.length > 0, taskStageIds.length > 0);

  function buildBaseQuery(): SegmentRecipientsQuery {
    const query: SegmentRecipientsQuery = { ...segment };
    if (manualClientIds.length > 0) query.manualClientIds = manualClientIds;
    if (manualContacts.length > 0) query.manualContacts = manualContacts;
    if (taskStageIds.length > 0) query.taskStageIds = taskStageIds;
    return query;
  }

  const { data, isLoading, isError, isPlaceholderData } = useSegmentRecipients(
    { ...buildBaseQuery(), page, limit: LIMIT },
    open && hasAnyRecipients,
  );

  const excluded = useExcludedRecipients(
    { ...buildBaseQuery(), page: excludedPage, limit: LIMIT },
    open && hasAnyRecipients && activeTab === 'excluded',
  );

  // FIX-1 — `keepPreviousData` mantiene la paginación SUAVE dentro del mismo
  // input, pero al reabrir con OTRO input (segmento/manuales/CSV) devolvería
  // los destinatarios ANTERIORES como placeholder (con `isLoading=false`), y
  // en un preview antes-de-enviar mostrar el input equivocado es PELIGROSO.
  // Trackeamos el fingerprint del input cuya data ya "asentó" (no-placeholder);
  // si el placeholder actual es de OTRO input, forzamos el skeleton en lugar
  // de pintar data ajena. El `setState` condicional en render es el patrón
  // oficial de React para "ajustar estado ante un cambio de prop" (no dispara
  // loop) y NO rompe la paginación — el placeholder del MISMO input sí se
  // sigue mostrando.
  const inputFingerprint = JSON.stringify({ segment, manualClientIds, manualContacts, taskStageIds });
  const [settledFingerprint, setSettledFingerprint] = useState<string | null>(null);
  if (!isPlaceholderData && data && settledFingerprint !== inputFingerprint) {
    setSettledFingerprint(inputFingerprint);
  }
  const showStaleInput = isPlaceholderData && settledFingerprint !== inputFingerprint;
  const showLoading = isLoading || showStaleInput;

  // L2 (review adversarial, consistencia con FIX-1) — MISMO guard para la
  // pestaña Excluidos: `useExcludedRecipients` también usa
  // `placeholderData: keepPreviousData`, así que cambiar de input (segmento/
  // manuales/CSV) con esa pestaña activa mostraría los excluidos del input
  // ANTERIOR (isPlaceholderData=true pero `isLoading=false`) — la misma
  // trampa de FIX-1, sólo que en la otra tabla.
  const [excludedSettledFingerprint, setExcludedSettledFingerprint] = useState<string | null>(null);
  if (!excluded.isPlaceholderData && excluded.data && excludedSettledFingerprint !== inputFingerprint) {
    setExcludedSettledFingerprint(inputFingerprint);
  }
  const showExcludedStaleInput = excluded.isPlaceholderData && excludedSettledFingerprint !== inputFingerprint;
  const showExcludedLoading = excluded.isLoading || showExcludedStaleInput;

  // FIX-5 — resetea la página (Y la vista) a su default al CERRAR (no al
  // abrir). Reseteándolo en un effect al abrir, el PRIMER render ya habilitó
  // la query con la página vieja → un fetch redundante que se vuelve a
  // disparar al pasar a 1 (doble fetch). Al hacerlo en el cierre (query
  // deshabilitada, `enabled: open`), la próxima apertura arranca limpia sin
  // fetch de más.
  useEffect(() => {
    if (!open) {
      setPage(1);
      setExcludedPage(1);
      setActiveTab('recipients');
    }
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

  const rows: RecipientRow[] = (data?.data ?? []).map((r) => ({ ...r, id: r.clientId ?? r.phoneE164 }));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || LIMIT))) : 1;
  const excludedTotalPages = excluded.data
    ? Math.max(1, Math.ceil(excluded.data.total / (excluded.data.limit || LIMIT)))
    : 1;
  // CSV-FE-7 — N sale de los contadores agregados YA PRESENTES en la vista de
  // destinatarios (no hace falta pedir la vista `excluded` sólo para el label del tab).
  //
  // L1 (review adversarial, documentado y ACEPTADO — no se cambia) — este
  // sumatorio sólo cubre 3 de los 5 motivos de `ExcludedRecipientReason`
  // ('opt_out'/'duplicado'/'telefono_invalido', vía `skipped`); NO incluye
  // 'sin_nombre'/'sin_telefono'. Hoy es inofensivo porque el FE ya filtra esas
  // dos razones del CSV client-side (nunca llegan al BE por esa vía) — pero
  // si el BE alguna vez las emite para un excluido de OTRA fuente (segmento/
  // manual, "defensa en profundidad" per el comentario de
  // `ExcludedRecipientReason`), el label "Excluidos (N)" quedaría por debajo
  // del total real de `listExcludedRecipients`. Alinearlo de verdad
  // implicaría pedir SIEMPRE la vista `excluded` (aunque esa pestaña no esté
  // activa) sólo para el label — el trade-off de fetch fue DELIBERADO (ver
  // arriba), así que se documenta el acoplamiento en vez de cambiarlo.
  const excludedCount = data ? data.skipped.optedOut + data.skipped.duplicatePhone + data.skipped.invalidPhone : 0;

  const columns: { label: string; key: string; render?: (row: RecipientRow) => JSX.Element }[] = [
    { label: 'Nombre', key: 'name' },
    { label: 'Teléfono', key: 'phoneE164' },
    { label: 'Estado', key: 'status', render: (row) => <StatusCell status={row.status} /> },
  ];

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

          {hasAnyRecipients && (
            <Tabs
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as 'recipients' | 'excluded')}
              tabs={[
                {
                  id: 'recipients',
                  label: 'Destinatarios',
                  content: (
                    <>
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
                          assertive), acá es informativo — el gate real de creación ya vive
                          afuera del modal. */}
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

                            {excludedCount > 0 && (
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
                    </>
                  ),
                },
                {
                  id: 'excluded',
                  label: `Excluidos (${excludedCount})`,
                  content: (
                    <InvalidRecipientsTable
                      data={excluded.data?.data ?? []}
                      isLoading={showExcludedLoading}
                      isError={excluded.isError}
                      page={excludedPage}
                      totalPages={excludedTotalPages}
                      onPageChange={setExcludedPage}
                    />
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
