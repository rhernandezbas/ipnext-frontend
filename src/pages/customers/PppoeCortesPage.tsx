import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isAxiosError } from 'axios';
import { Can } from '@/components/auth/Can';
import {
  usePreviewEnforcement,
  useStartBulkEnforcement,
  useBulkEnforcementStatus,
} from '@/hooks/usePppoe';
import {
  ENFORCEMENT_ACTION_LABELS,
  ENFORCEMENT_ACTION_VERB,
  type EnforcementAction,
  type EnforcementTarget,
  type EnforcementPreview,
} from '@/types/pppoe';
import styles from './PppoeCortesPage.module.css';

// ── Opciones ───────────────────────────────────────────────────────────────────

const ACTIONS: EnforcementAction[] = ['reduce', 'block', 'restore'];

const TARGETS = [
  { value: 'debtors', label: 'Deudores (en mora)', hint: 'Clientes marcados en mora por Gestión Real' },
  { value: 'baja', label: 'Bajas', hint: 'Clientes dados de baja' },
  { value: 'active', label: 'Al día', hint: 'Clientes regularizados (para restaurar)' },
  { value: '__ids__', label: 'Lista de PPPoE', hint: 'IDs de PPPoE, uno por línea' },
] as const;

/** A partir de >= este total, el corte exige confirmación tipeada. */
const TYPED_CONFIRM_THRESHOLD = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildTarget(targetKind: string, idsText: string): EnforcementTarget | null {
  if (targetKind === '__ids__') {
    const ids = idsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    return ids.length ? { pppoeIds: ids } : null;
  }
  // Emitir el LITERAL del contrato para deudores (no {clientStatus:'late'}) — semántica
  // explícita del BE; el resto (baja/active) viaja como clientStatus.
  if (targetKind === 'debtors') return 'debtors';
  return { clientStatus: targetKind };
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function PppoeCortesPage() {
  const [action, setAction] = useState<EnforcementAction>('reduce');
  const [targetKind, setTargetKind] = useState<string>('debtors');
  const [idsText, setIdsText] = useState('');
  const [preview, setPreview] = useState<EnforcementPreview | null>(null);
  // Snapshot EXACTO de lo previsualizado: se ejecuta ESTO, no el target vivo del composer
  // (evita el clásico "confirmás A, ejecutás B" si el composer cambia con el modal abierto).
  const [previewedReq, setPreviewedReq] = useState<{ action: EnforcementAction; target: EnforcementTarget } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewMut = usePreviewEnforcement();
  const startMut = useStartBulkEnforcement();
  const batch = useBulkEnforcementStatus(jobId, jobId !== null);

  const target = useMemo(() => buildTarget(targetKind, idsText), [targetKind, idsText]);
  const routerCount = preview ? Object.keys(preview.byRouter).length : 0;
  const running = jobId !== null && batch.data?.status !== 'done' && batch.data?.status !== 'failed';

  // Cualquier cambio en la composición invalida el preview previo (no ejecutar algo viejo).
  function resetPreview() {
    setPreview(null);
    setPreviewedReq(null);
    setErrorMsg(null);
  }

  async function handlePreview() {
    if (!target) return;
    setErrorMsg(null);
    try {
      const result = await previewMut.mutateAsync({ action, target });
      setPreview(result);
      setPreviewedReq({ action, target }); // snapshot: esto es lo que se ejecutará
    } catch {
      setErrorMsg('No se pudo calcular el preview. Reintentá.');
    }
  }

  async function handleConfirmExecute() {
    if (!previewedReq) return;
    setErrorMsg(null);
    try {
      const { data } = await startMut.mutateAsync(previewedReq); // ejecuta el SNAPSHOT, no el target vivo
      setJobId(data.jobId);
      setConfirmOpen(false);
    } catch (err) {
      setConfirmOpen(false);
      if (isAxiosError(err) && err.response?.status === 409) {
        setErrorMsg('Ya hay un corte masivo en curso. Esperá a que termine antes de disparar otro.');
      } else {
        setErrorMsg('No se pudo iniciar el corte. Reintentá.');
      }
    }
  }

  function handleNewCut() {
    setJobId(null);
    setPreview(null);
    setPreviewedReq(null);
    setErrorMsg(null);
  }

  const verb = ENFORCEMENT_ACTION_VERB[action];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>CRM /</span>
          <h1 className={styles.title}>Cortes PPPoE</h1>
        </div>
      </div>

      <p className={styles.lead}>
        Aplicá en la red el estado que ya marcó Gestión Real: reducí a los deudores, bloqueá las bajas
        y restaurá a los que pagaron. Siempre con preview antes de ejecutar.
      </p>

      {errorMsg && (
        <div className={styles.errorBanner} role="alert">{errorMsg}</div>
      )}

      {/* ── Job en curso / terminado ── */}
      {jobId ? (
        <ProgressPanel
          total={batch.data?.total ?? 0}
          done={batch.data?.doneCount ?? 0}
          failed={batch.data?.failedCount ?? 0}
          status={batch.data?.status ?? 'pending'}
          items={batch.data?.items ?? []}
          running={running}
          onNewCut={handleNewCut}
        />
      ) : (
        <Can permission="pppoe.cut" fallback={<div className={styles.noAccess}>No tenés permiso para ejecutar cortes.</div>}>
          {/* ── Composer ── */}
          <section className={styles.composer} aria-label="Configurar corte">
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Acción</span>
              <div className={styles.segmented} role="group" aria-label="Acción">
                {ACTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={action === a}
                    className={`${styles.segment} ${action === a ? styles[`segment_${a}`] : ''}`}
                    onClick={() => { setAction(a); resetPreview(); }}
                  >
                    {ENFORCEMENT_ACTION_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="pppoe-target">Objetivo</label>
              <select
                id="pppoe-target"
                className={styles.select}
                value={targetKind}
                onChange={(e) => { setTargetKind(e.target.value); resetPreview(); }}
              >
                {TARGETS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <span className={styles.fieldHint}>{TARGETS.find((t) => t.value === targetKind)?.hint}</span>
            </div>

            {targetKind === '__ids__' && (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="pppoe-ids">IDs de PPPoE</label>
                <textarea
                  id="pppoe-ids"
                  className={styles.textarea}
                  placeholder="Un ID por línea (o separados por coma)"
                  value={idsText}
                  onChange={(e) => { setIdsText(e.target.value); resetPreview(); }}
                  rows={4}
                />
              </div>
            )}

            <div className={styles.composerActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={!target || previewMut.isPending}
                onClick={() => void handlePreview()}
              >
                {previewMut.isPending ? 'Calculando…' : 'Previsualizar'}
              </button>
            </div>
          </section>

          {/* ── Preview ── */}
          {preview && (
            <section className={styles.previewPanel} aria-label="Impacto del corte">
              {preview.total === 0 ? (
                <p className={styles.previewEmpty}>
                  No hay servicios para <strong>{verb}</strong> con este objetivo. Nada que ejecutar.
                </p>
              ) : (
                <>
                  <p className={styles.previewSummary}>
                    Vas a <strong className={styles[`verb_${action}`]}>{verb}</strong>{' '}
                    <strong>{preview.total}</strong> {preview.total === 1 ? 'servicio' : 'servicios'} PPPoE
                    {routerCount > 0 && <> en <strong>{routerCount}</strong> {routerCount === 1 ? 'router' : 'routers'}</>}.
                  </p>

                  <div className={styles.byRouter}>
                    <span className={styles.byRouterTitle}>Por router</span>
                    <ul className={styles.byRouterList}>
                      {Object.entries(preview.byRouter)
                        .sort((a, b) => b[1] - a[1])
                        .map(([nasId, count]) => {
                          const pct = preview.total ? Math.round((count / preview.total) * 100) : 0;
                          return (
                            <li key={nasId} className={styles.byRouterRow}>
                              {/* S2: los pendientes (nasId null) agrupan bajo la key
                                  JSON "null" — se muestra "—", nunca "Router null". */}
                              <span className={styles.byRouterNas}>
                                Router {nasId && nasId !== 'null' ? nasId : '—'}
                              </span>
                              <span className={styles.byRouterBarTrack}>
                                <span className={styles.byRouterBarFill} style={{ width: `${pct}%` }} />
                              </span>
                              <span className={styles.byRouterCount}>{count}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </div>

                  {preview.sample.length > 0 && (
                    <p className={styles.sample}>
                      Ejemplos: {preview.sample.slice(0, 6).map((s) => s.username).join(', ')}
                      {preview.total > preview.sample.length && '…'}
                    </p>
                  )}

                  <div className={styles.previewActions}>
                    <button
                      type="button"
                      className={`${styles.btnExecute} ${styles[`execute_${action}`]}`}
                      onClick={() => setConfirmOpen(true)}
                    >
                      Ejecutar corte
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </Can>
      )}

      {confirmOpen && preview && previewedReq && (
        <ConfirmModal
          action={previewedReq.action}
          total={preview.total}
          routerCount={routerCount}
          pending={startMut.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleConfirmExecute()}
        />
      )}
    </div>
  );
}

// ── Confirm modal (portal) ─────────────────────────────────────────────────────

function ConfirmModal(props: {
  action: EnforcementAction;
  total: number;
  routerCount: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { action, total, routerCount, pending, onCancel, onConfirm } = props;
  const verb = ENFORCEMENT_ACTION_VERB[action];
  const needsTyped = total >= TYPED_CONFIRM_THRESHOLD;
  const [typed, setTyped] = useState('');
  const canConfirm = !pending && (!needsTyped || typed.trim() === String(total));

  // a11y: Escape cancela + se restaura el foco al elemento que abrió el modal.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [onCancel, pending]);

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="cut-confirm-title" onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="cut-confirm-title" className={styles.modalTitle}>Confirmar corte masivo</h2>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalLead}>
            Vas a <strong className={styles[`verb_${action}`]}>{verb}</strong>{' '}
            <strong>{total}</strong> {total === 1 ? 'servicio' : 'servicios'} PPPoE
            {routerCount > 0 && <> en <strong>{routerCount}</strong> {routerCount === 1 ? 'router' : 'routers'}</>}.
            {action !== 'restore' && ' Esto afecta el servicio real de los clientes.'}
          </p>
          {needsTyped && (
            <label className={styles.typedConfirm}>
              <span>Escribí <strong>{total}</strong> para confirmar</span>
              <input
                className={styles.input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                inputMode="numeric"
                autoFocus
                aria-label={`Escribí ${total} para confirmar`}
              />
            </label>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={pending} autoFocus={!needsTyped}>
            Cancelar
          </button>
          <button
            type="button"
            className={`${styles.btnExecute} ${styles[`execute_${action}`]}`}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {pending ? 'Iniciando…' : `Sí, ${verb}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Progress panel ──────────────────────────────────────────────────────────────

function ProgressPanel(props: {
  total: number;
  done: number;
  failed: number;
  status: string;
  items: { pppoeId: string; ok: boolean; error?: string }[];
  running: boolean;
  onNewCut: () => void;
}) {
  const { total, done, failed, status, items, running, onNewCut } = props;
  const processed = done + failed;
  const frac = total ? processed / total : (status === 'done' ? 1 : 0);
  const failures = items.filter((i) => !i.ok);

  return (
    <section className={styles.progressPanel} aria-label="Progreso del corte">
      <div className={styles.progressHead} aria-live="polite" aria-atomic="true">
        <span className={`${styles.progressStatus} ${styles[`status_${status}`] ?? ''}`}>
          {running && <span className={styles.spinner} aria-hidden="true" />}
          {status === 'running' || status === 'pending' ? 'En curso' : status === 'done' ? 'Completado' : 'Finalizado con errores'}
        </span>
        <span className={styles.progressCount}>{processed} / {total}</span>
      </div>

      <div className={styles.progressTrack}>
        <span className={styles.progressFill} style={{ transform: `scaleX(${frac})` }} />
      </div>

      <div className={styles.progressStats}>
        <span className={styles.statOk}>{done} aplicados</span>
        {failed > 0 && <span className={styles.statFail}>{failed} con error</span>}
      </div>

      {failures.length > 0 && (
        <div className={styles.failureList}>
          <span className={styles.failureTitle}>Errores</span>
          <ul>
            {failures.slice(0, 50).map((f) => (
              <li key={f.pppoeId} className={styles.failureRow}>
                <code>{f.pppoeId}</code>
                <span>{f.error ?? 'error desconocido'}</span>
              </li>
            ))}
          </ul>
          {failures.length > 50 && <span className={styles.failureMore}>y {failures.length - 50} más…</span>}
        </div>
      )}

      {!running && (
        <div className={styles.progressActions}>
          <button type="button" className={styles.btnSecondary} onClick={onNewCut}>Nuevo corte</button>
        </div>
      )}
    </section>
  );
}
