import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AddInstalledItemInput, AddInstalledItemResult, SameTypeCandidate } from '@/types/serviceInventory';
import { InventoryConflictError } from '@/api/serviceInventory.api';
import type { OnuWifiStatus } from '@/types/wifi';
import styles from './AssociateOnuModal.module.css';

interface AssociateOnuModalProps {
  /** GET /api/wifi/onu/:serial — manual trigger, resuelve el estado real de la ONU. */
  onVerify: (serial: string) => Promise<OnuWifiStatus>;
  verifying: boolean;
  /** POST /contracts/:contractId/inventory — puede tirar InventoryConflictError (409). */
  onCreate: (input: AddInstalledItemInput) => Promise<AddInstalledItemResult>;
  onAssociated: () => void;
  onClose: () => void;
}

type Step =
  | { mode: 'input' }
  | { mode: 'verified'; status: OnuWifiStatus }
  | { mode: 'decide'; candidates: SameTypeCandidate[] }
  | { mode: 'done'; outcome: 'created' | 'enriched' };

/**
 * "Asociar ONU" (#2 del proposal wifi-self-service). El operador NUNCA
 * confirma a ciegas: primero verifica el serial contra SmartOLT (GET) y ve
 * modelo/estado, recién ahí confirma el POST que lo asocia al contrato.
 * Reusa el mismo contrato de dedup 409 SAME_TYPE_NEEDS_DECISION que
 * `AddByPppoeReviewModal` (completar equipo existente vs agregar como nuevo).
 */
export function AssociateOnuModal({ onVerify, verifying, onCreate, onAssociated, onClose }: AssociateOnuModalProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [serial, setSerial] = useState('');
  const [step, setStep] = useState<Step>({ mode: 'input' });
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chosenCandidateId, setChosenCandidateId] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const normalizedSerial = serial.trim();

  async function handleVerify() {
    if (!normalizedSerial || verifying) return;
    setVerifyError(null);
    try {
      const status = await onVerify(normalizedSerial);
      setStep({ mode: 'verified', status });
    } catch {
      setVerifyError('No se pudo verificar el serial. Reintentá.');
    }
  }

  async function handleConfirm() {
    if (step.mode !== 'verified' || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await onCreate({ type: 'ONU', serialNumber: normalizedSerial });
      setStep({ mode: 'done', outcome: res.outcome });
    } catch (err) {
      if (err instanceof InventoryConflictError && err.conflict.code === 'SAME_TYPE_NEEDS_DECISION') {
        setChosenCandidateId(err.conflict.candidates[0]?.id ?? null);
        setStep({ mode: 'decide', candidates: err.conflict.candidates });
      } else if (err instanceof InventoryConflictError) {
        setSaveError('El equipo figura dado de baja o dañado en el inventario, no se puede reactivar.');
      } else {
        const apiMsg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
        setSaveError(apiMsg?.message ?? apiMsg?.error ?? 'No se pudo asociar la ONU.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDecision(resolution: 'complete' | 'force') {
    setSaving(true);
    setSaveError(null);
    const input: AddInstalledItemInput =
      resolution === 'complete'
        ? { type: 'ONU', serialNumber: normalizedSerial, completeItemId: chosenCandidateId ?? undefined }
        : { type: 'ONU', serialNumber: normalizedSerial, force: true };
    try {
      const res = await onCreate(input);
      setStep({ mode: 'done', outcome: res.outcome });
    } catch (err) {
      const apiMsg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setSaveError(apiMsg?.message ?? apiMsg?.error ?? 'No se pudo asociar la ONU.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="associate-onu-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h2 id="associate-onu-title" className={styles.title}>Asociar ONU</h2>
            <p className={styles.subtitle}>
              {step.mode === 'decide'
                ? 'Ya hay un equipo del mismo tipo en este contrato.'
                : 'Verificá el serial contra SmartOLT antes de asociarlo.'}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.body}>
          {(step.mode === 'input' || step.mode === 'verified') && (
            <div className={styles.field}>
              <label htmlFor="associate-onu-serial" className={styles.label}>Serial (SN)</label>
              <div className={styles.verifyRow}>
                <input
                  ref={firstFieldRef}
                  id="associate-onu-serial"
                  className={styles.control}
                  type="text"
                  value={serial}
                  onChange={(e) => {
                    setSerial(e.target.value);
                    setStep({ mode: 'input' });
                    setVerifyError(null);
                  }}
                  placeholder="Ej. 48575443A1B2C3D4"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className={styles.verifyBtn}
                  onClick={() => void handleVerify()}
                  disabled={!normalizedSerial || verifying}
                >
                  {verifying ? 'Verificando…' : 'Verificar'}
                </button>
              </div>
              {verifyError && <p className={styles.errorHint} role="alert">{verifyError}</p>}
            </div>
          )}

          {step.mode === 'verified' && (
            <div className={step.status.found ? styles.resultOk : styles.resultWarn} role="status">
              {step.status.found ? (
                <>
                  <p className={styles.resultTitle}>Equipo encontrado en SmartOLT</p>
                  <dl className={styles.resultGrid}>
                    <div>
                      <dt>Modelo</dt>
                      <dd>{step.status.onuType ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Estado</dt>
                      <dd>{step.status.online ? 'En línea' : 'Offline'}</dd>
                    </div>
                    <div>
                      <dt>TR-069</dt>
                      <dd>{step.status.tr069Enabled ? 'Habilitado' : 'No habilitado'}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className={styles.resultTitle}>
                  El serial cargado no existe en SmartOLT. Revisá que esté bien tipeado.
                </p>
              )}
            </div>
          )}

          {step.mode === 'decide' && (
            <>
              <p className={styles.decisionLead}>
                ¿El serial <strong className={styles.mono}>{normalizedSerial}</strong> es de alguno de
                estos equipos ya cargados, o es uno nuevo?
              </p>
              <fieldset className={styles.candidateList}>
                <legend className={styles.srOnly}>Equipos existentes del mismo tipo</legend>
                {step.candidates.map((c) => {
                  const id = `associate-onu-candidate-${c.id}`;
                  return (
                    <label key={c.id} htmlFor={id} className={styles.candidateRow}>
                      <input
                        type="radio"
                        id={id}
                        name="associate-onu-candidate"
                        checked={chosenCandidateId === c.id}
                        onChange={() => setChosenCandidateId(c.id)}
                      />
                      <span>
                        SN: <span className={styles.mono}>{c.serialNumber ?? '—'}</span>
                        {c.model ? ` · ${c.model}` : ''}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </>
          )}

          {step.mode === 'done' && (
            <p className={styles.resultOk} role="status">
              {step.outcome === 'created' ? 'ONU asociada al contrato.' : 'Datos completados en el equipo existente.'}
            </p>
          )}

          {saveError && <p className={styles.formError} role="alert">{saveError}</p>}
        </div>

        <footer className={styles.footer}>
          {step.mode === 'done' ? (
            <button type="button" className={styles.submitBtn} onClick={onAssociated}>
              Listo
            </button>
          ) : step.mode === 'decide' ? (
            <>
              <button type="button" className={styles.cancelBtn} onClick={() => void handleDecision('force')} disabled={saving}>
                Agregar como nuevo
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => void handleDecision('complete')}
                disabled={saving || !chosenCandidateId}
              >
                {saving ? 'Guardando…' : 'Completar equipo existente'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => void handleConfirm()}
                disabled={step.mode !== 'verified' || !step.status.found || saving}
              >
                {saving ? 'Asociando…' : 'Confirmar y asociar'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
