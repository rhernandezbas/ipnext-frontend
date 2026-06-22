import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  InspectPppoeDevicesResult,
  AddInstalledItemInput,
  AddInstalledItemResult,
  SameTypeCandidate,
} from '@/types/serviceInventory';
import { InventoryConflictError } from '@/api/serviceInventory.api';
import styles from './AddByPppoeReviewModal.module.css';

interface AddByPppoeReviewModalProps {
  contractId: string;
  result: InspectPppoeDevicesResult;
  onClose: () => void;
  /**
   * Called once per device to add. Resolves with the dedup outcome
   * ('created' | 'enriched') or throws `InventoryConflictError` on a 409.
   */
  onCreate: (input: AddInstalledItemInput) => Promise<AddInstalledItemResult>;
}

/** A device the operator chose to register, with its computed add payload. */
interface PlannedDevice {
  /** Stable key + human label, e.g. "Antena" / "Router". */
  label: string;
  input: AddInstalledItemInput;
}

/** Per-device outcome after attempting the add. */
type DeviceOutcome =
  | { kind: 'created'; label: string }
  | { kind: 'enriched'; label: string }
  | { kind: 'not_revivable'; label: string; message: string }
  | { kind: 'error'; label: string; message: string };

/** A device whose add hit SAME_TYPE_NEEDS_DECISION and awaits an operator choice. */
interface PendingDecision {
  device: PlannedDevice;
  candidates: SameTypeCandidate[];
}

type Step =
  | { mode: 'review' }
  | { mode: 'decide'; decision: PendingDecision }
  | { mode: 'summary' };

/**
 * Review modal for "Agregar por PPPoE" (#add-by-pppoe), dedup-aware.
 *
 * Step 1 (review): shows the discovered antenna + router, lets the operator
 * toggle each device and edit the model, then "Agregar equipos".
 *
 * On confirm, each device is POSTed. The BE may:
 *   - create a new item (201)            → outcome "agregado"
 *   - enrich an existing one (200)       → outcome "datos completados"
 *   - need a decision (409 SAME_TYPE)    → step 2 (decide): the operator
 *       chooses to COMPLETE an existing item (re-POST with completeItemId) or
 *       ADD AS NEW (re-POST with force:true). Never auto-decided.
 *   - refuse to revive (409 ASSET_NOT_REVIVABLE) → a clear, non-crashing message.
 *
 * Step 3 (summary): once every device is resolved, lists what happened and the
 * operator dismisses the modal.
 *
 * Patterns match InstalledItemFormModal: portal to body, Esc closes, backdrop
 * click closes, scroll lock, focus on mount.
 */
export function AddByPppoeReviewModal({
  result,
  onClose,
  onCreate,
}: AddByPppoeReviewModalProps) {
  const { antenna, router, warnings } = result;

  // Per-device inclusion toggles (default on when the device has a MAC to register).
  // Sin MAC la antena no aporta nada al inventario → default off + toggle deshabilitado.
  const [includeAntenna, setIncludeAntenna] = useState(antenna.mac !== null);
  const [includeRouter, setIncludeRouter] = useState(router !== null);

  // Editable model fields
  const [antennaModel, setAntennaModel] = useState(antenna.model ?? '');
  const [routerModel, setRouterModel] = useState(router?.brand ?? '');

  const [step, setStep] = useState<Step>({ mode: 'review' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accumulated outcomes across the whole confirm run (review + decisions).
  const outcomesRef = useRef<DeviceOutcome[]>([]);
  // Devices still waiting for a SAME_TYPE decision (resolved one at a time).
  const pendingRef = useRef<PendingDecision[]>([]);
  // Chosen candidate id in the current decision step (radio selection).
  const [chosenCandidateId, setChosenCandidateId] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  /** Build the list of devices the operator selected to register. */
  function plannedDevices(): PlannedDevice[] {
    const devices: PlannedDevice[] = [];
    if (includeAntenna) {
      devices.push({
        label: 'Antena',
        input: {
          type: 'ANTENA',
          mac: antenna.mac ?? undefined,
          model: antennaModel.trim() || undefined,
        },
      });
    }
    if (includeRouter && router !== null) {
      devices.push({
        label: 'Router',
        input: {
          type: 'ROUTER',
          mac: router.mac,
          model: routerModel.trim() || undefined,
        },
      });
    }
    return devices;
  }

  /**
   * Attempt one device. Records the success outcome, queues a decision on
   * SAME_TYPE, records a clear message on ASSET_NOT_REVIVABLE, or a generic
   * error otherwise. Never throws.
   */
  async function attemptDevice(device: PlannedDevice): Promise<void> {
    try {
      const res = await onCreate(device.input);
      outcomesRef.current.push({ kind: res.outcome, label: device.label });
    } catch (err: unknown) {
      if (err instanceof InventoryConflictError) {
        if (err.conflict.code === 'SAME_TYPE_NEEDS_DECISION') {
          pendingRef.current.push({ device, candidates: err.conflict.candidates });
          return;
        }
        // ASSET_NOT_REVIVABLE — clear, honest, Spanish wording regardless of BE locale.
        outcomesRef.current.push({
          kind: 'not_revivable',
          label: device.label,
          message:
            'El equipo figura dado de baja o dañado en el inventario, no se puede reactivar.',
        });
        return;
      }
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const msg = apiMsg ?? (err instanceof Error ? err.message : null) ?? 'Error al agregar equipo';
      outcomesRef.current.push({ kind: 'error', label: device.label, message: msg });
    }
  }

  /** After all attempts: move to the next pending decision, or the summary. */
  function advanceAfterAttempts() {
    setSaving(false);
    const next = pendingRef.current.shift();
    if (next) {
      // Pre-select the first candidate as the recommended "Completar" target,
      // but the operator must still click — we never auto-decide.
      setChosenCandidateId(next.candidates[0]?.id ?? null);
      setStep({ mode: 'decide', decision: next });
    } else {
      setStep({ mode: 'summary' });
    }
  }

  /** Confirm in the review step — attempt every selected device once. */
  async function handleConfirm() {
    setSaving(true);
    setError(null);
    outcomesRef.current = [];
    pendingRef.current = [];

    for (const device of plannedDevices()) {
      await attemptDevice(device);
    }
    advanceAfterAttempts();
  }

  /** Resolve the current SAME_TYPE decision. */
  async function resolveDecision(resolution: 'complete' | 'force') {
    if (step.mode !== 'decide') return;
    const { device } = step.decision;
    setSaving(true);
    setError(null);

    const input: AddInstalledItemInput =
      resolution === 'complete'
        ? { ...device.input, completeItemId: chosenCandidateId ?? undefined }
        : { ...device.input, force: true };

    await attemptDevice({ ...device, input });
    advanceAfterAttempts();
  }

  // ── Derived view state ──────────────────────────────────────────────────────
  const nothingSelected = !includeAntenna && !includeRouter;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="abp-review-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className={styles.header}>
          <div>
            <h2 id="abp-review-title" className={styles.title}>
              {step.mode === 'decide'
                ? 'Equipo similar ya registrado'
                : step.mode === 'summary'
                  ? 'Resultado'
                  : 'Equipos detectados'}
            </h2>
            <p className={styles.subtitle}>
              {step.mode === 'decide'
                ? 'Ya hay un equipo del mismo tipo. Decidí qué hacer.'
                : step.mode === 'summary'
                  ? 'Esto es lo que pasó con cada equipo.'
                  : 'Revisá y editá los datos antes de guardar.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className={styles.body}>
          {step.mode === 'review' && (
            <ReviewBody
              antenna={antenna}
              router={router}
              warnings={warnings}
              includeAntenna={includeAntenna}
              setIncludeAntenna={setIncludeAntenna}
              includeRouter={includeRouter}
              setIncludeRouter={setIncludeRouter}
              antennaModel={antennaModel}
              setAntennaModel={setAntennaModel}
              routerModel={routerModel}
              setRouterModel={setRouterModel}
            />
          )}

          {step.mode === 'decide' && (
            <DecisionBody
              decision={step.decision}
              chosenCandidateId={chosenCandidateId}
              setChosenCandidateId={setChosenCandidateId}
            />
          )}

          {step.mode === 'summary' && <SummaryBody outcomes={outcomesRef.current} />}

          {error && <p className={styles.errorBanner} role="alert">{error}</p>}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className={styles.footer}>
          {step.mode === 'review' && (
            <>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleConfirm}
                disabled={saving || nothingSelected}
              >
                {saving ? 'Guardando…' : 'Agregar equipos'}
              </button>
            </>
          )}

          {step.mode === 'decide' && (
            <>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => resolveDecision('force')}
                disabled={saving}
              >
                Agregar como nuevo
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => resolveDecision('complete')}
                disabled={saving || !chosenCandidateId}
              >
                {saving ? 'Guardando…' : 'Completar su MAC'}
              </button>
            </>
          )}

          {step.mode === 'summary' && (
            <button type="button" className={styles.submitBtn} onClick={onClose}>
              Listo
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// ── Sub-views ────────────────────────────────────────────────────────────────

interface ReviewBodyProps {
  antenna: InspectPppoeDevicesResult['antenna'];
  router: InspectPppoeDevicesResult['router'];
  warnings: string[];
  includeAntenna: boolean;
  setIncludeAntenna: (v: boolean) => void;
  includeRouter: boolean;
  setIncludeRouter: (v: boolean) => void;
  antennaModel: string;
  setAntennaModel: (v: string) => void;
  routerModel: string;
  setRouterModel: (v: string) => void;
}

function ReviewBody({
  antenna,
  router,
  warnings,
  includeAntenna,
  setIncludeAntenna,
  includeRouter,
  setIncludeRouter,
  antennaModel,
  setAntennaModel,
  routerModel,
  setRouterModel,
}: ReviewBodyProps) {
  return (
    <>
      {warnings.length > 0 && (
        <div className={styles.warningsBanner} role="status">
          <svg className={styles.icon} width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M7.5 1.5L13.5 12.5H1.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M7.5 6v3M7.5 11v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          <ul>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Antenna card */}
      <div className={styles.deviceCard}>
        <div className={`${styles.deviceCardHeader} ${!includeAntenna ? styles.unchecked : ''}`}>
          <input
            type="checkbox"
            id="abp-include-antenna"
            className={styles.deviceToggle}
            checked={includeAntenna}
            onChange={(e) => setIncludeAntenna(e.target.checked)}
            disabled={!antenna.mac}
            aria-label="Antena"
          />
          <label htmlFor="abp-include-antenna" className={styles.deviceLabel}>
            <span className={styles.typeTag}>ANTENA</span>
            Antena
          </label>
        </div>
        <div className={`${styles.deviceCardBody} ${!includeAntenna ? styles.dimmed : ''}`}>
          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.label}>MAC</span>
              {antenna.mac
                ? <span className={styles.macValue}>{antenna.mac}</span>
                : <span className={styles.macValueNull}>No detectada</span>}
            </div>
            <div className={styles.field}>
              <label htmlFor="abp-antenna-model" className={styles.label}>
                Modelo (Antena)
              </label>
              <input
                id="abp-antenna-model"
                type="text"
                className={styles.control}
                value={antennaModel}
                onChange={(e) => setAntennaModel(e.target.value)}
                placeholder="Ej. Mimosa C5x"
                autoComplete="off"
                disabled={!includeAntenna}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Router card or "no router" note */}
      {router !== null ? (
        <div className={styles.deviceCard}>
          <div className={`${styles.deviceCardHeader} ${!includeRouter ? styles.unchecked : ''}`}>
            <input
              type="checkbox"
              id="abp-include-router"
              className={styles.deviceToggle}
              checked={includeRouter}
              onChange={(e) => setIncludeRouter(e.target.checked)}
              aria-label="Router"
            />
            <label htmlFor="abp-include-router" className={styles.deviceLabel}>
              <span className={styles.typeTag}>ROUTER</span>
              Router
            </label>
          </div>
          <div className={`${styles.deviceCardBody} ${!includeRouter ? styles.dimmed : ''}`}>
            <div className={styles.row}>
              <div className={styles.field}>
                <span className={styles.label}>MAC</span>
                <span className={styles.macValue}>{router.mac}</span>
              </div>
              <div className={styles.field}>
                <label htmlFor="abp-router-model" className={styles.label}>
                  Modelo (Router)
                </label>
                <input
                  id="abp-router-model"
                  type="text"
                  className={styles.control}
                  value={routerModel}
                  onChange={(e) => setRouterModel(e.target.value)}
                  placeholder="Ej. TP-Link TL-WR840N"
                  autoComplete="off"
                  disabled={!includeRouter}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.noRouter}>
          <svg className={styles.icon} width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.25" />
            <path d="M7.5 5v2.5L9 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          No se detectó router del cliente
        </div>
      )}
    </>
  );
}

interface DecisionBodyProps {
  decision: PendingDecision;
  chosenCandidateId: string | null;
  setChosenCandidateId: (id: string) => void;
}

function DecisionBody({ decision, chosenCandidateId, setChosenCandidateId }: DecisionBodyProps) {
  const { device, candidates } = decision;
  const newMac = device.input.mac ?? '—';
  const multiple = candidates.length > 1;

  return (
    <>
      <div className={styles.decisionLead} role="status">
        <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" />
          <path d="M8 4.5v4M8 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <p>
          Ya hay {multiple ? 'equipos' : `una ${device.label.toLowerCase()}`} del mismo tipo sin esta
          MAC. ¿La nueva MAC <strong className={styles.macStrong}>{newMac}</strong> es de{' '}
          {multiple ? 'alguno de estos equipos' : 'este equipo'}?
        </p>
      </div>

      <fieldset className={styles.candidateList}>
        <legend className={styles.srOnly}>Equipos existentes del mismo tipo</legend>
        {candidates.map((c) => {
          const id = `abp-candidate-${c.id}`;
          const label = `${c.type} · SN: ${c.serialNumber ?? '—'}`;
          return (
            <label key={c.id} htmlFor={id} className={styles.candidateRow}>
              <input
                type="radio"
                id={id}
                name="abp-candidate"
                className={styles.candidateRadio}
                value={c.id}
                checked={chosenCandidateId === c.id}
                onChange={() => setChosenCandidateId(c.id)}
                aria-label={label}
              />
              <span className={styles.candidateInfo}>
                <span className={styles.typeTag}>{c.type}</span>
                <span className={styles.candidateMeta}>
                  SN: <span className={styles.mono}>{c.serialNumber ?? '—'}</span>
                  {c.mac ? <> · MAC: <span className={styles.mono}>{c.mac}</span></> : null}
                  {c.model ? <> · {c.model}</> : null}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <p className={styles.decisionHint}>
        <strong>Completar su MAC</strong> (recomendado) carga la MAC en ese equipo existente.
        <br />
        <strong>Agregar como nuevo</strong> crea un equipo aparte.
      </p>
    </>
  );
}

function SummaryBody({ outcomes }: { outcomes: DeviceOutcome[] }) {
  if (outcomes.length === 0) {
    return <p className={styles.summaryEmpty}>No se agregó ningún equipo.</p>;
  }
  return (
    <ul className={styles.summaryList}>
      {outcomes.map((o, i) => (
        <li key={i} className={`${styles.summaryRow} ${styles[`summary_${o.kind}`] ?? ''}`}>
          <span className={styles.summaryIcon} aria-hidden="true">
            {o.kind === 'created' || o.kind === 'enriched' ? (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M3 8l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.25" />
                <path d="M7.5 4.5v4M7.5 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <span className={styles.summaryText}>
            <strong>{o.label}:</strong>{' '}
            {o.kind === 'created' && 'agregado al inventario.'}
            {o.kind === 'enriched' && 'datos completados en el equipo existente.'}
            {o.kind === 'not_revivable' && o.message}
            {o.kind === 'error' && o.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
