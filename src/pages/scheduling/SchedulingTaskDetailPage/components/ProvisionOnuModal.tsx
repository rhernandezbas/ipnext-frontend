import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUnconfiguredOnus, useProvisionOnu } from '@/hooks/useFiberProvision';
import type {
  ProvisionOnuPayload,
  ProvisionPlanResult,
  ProvisionExecutedResult,
  ProvisionStepName,
  ProvisionStepResult,
  PppoeStaleReason,
  UnconfiguredOnu,
} from '@/types/fiber';
import { mapFiberError } from './fiberProvisionErrors';
import styles from './ProvisionOnuModal.module.css';

/** Elementos tabulables dentro del diálogo (focus-trap — patrón ConfirmModal). */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const STEP_LABELS: Record<ProvisionStepName, string> = {
  authorize: 'Autorizar ONU',
  mgmt_ip: 'IP de management',
  tr069: 'TR-069',
  remote_wan: 'Acceso remoto WAN',
  wifi_24: 'WiFi 2.4 GHz',
  wifi_5: 'WiFi 5 GHz',
};

const STATUS_SYMBOLS: Record<ProvisionStepResult['status'], string> = {
  ok: '✓',
  failed: '✗',
  skipped: '⊘',
};

const STATUS_LABELS: Record<ProvisionStepResult['status'], string> = {
  ok: 'OK',
  failed: 'Falló',
  skipped: 'Salteado',
};

const PPPOE_ACTION_COPY: Record<ProvisionPlanResult['pppoe']['action'], string> = {
  'reuse-existing': 'Reusa las credenciales PPPoE existentes del contrato',
  'review-stale': 'Hay un PPPoE previo en estado dudoso — se revisa al ejecutar',
  generate: 'Genera credenciales PPPoE nuevas',
};

/** Copy por reason del PPPoE stale (K1) — el reason NUNCA se aplana (fix H3 BE). */
const STALE_COPY: Record<PppoeStaleReason, string> = {
  disabled: 'usuario previo dado de baja — revisar',
  pending: 'aprovisionamiento previo pendiente',
  'radius-desync': 'ya existe en el RADIUS — verificar manualmente',
};

type WizardStep = 'picker' | 'plan' | 'result';

const STEP_TITLES: Record<WizardStep, string> = {
  picker: 'Paso 1 de 3 — Elegí la ONU detectada',
  plan: 'Paso 2 de 3 — Revisá y aprobá el plan (dry-run)',
  result: 'Paso 3 de 3 — Resultado del aprovisionamiento',
};

interface ProvisionOnuModalProps {
  contractId: string;
  onClose: () => void;
}

/** Botón copiar con feedback accesible — para claves WiFi/PPPoE. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin clipboard (contexto inseguro / permiso denegado) → no rompemos el flujo.
    }
  }
  return (
    <span className={styles.copyWrap}>
      <button
        type="button"
        className={styles.copyBtn}
        aria-label={label}
        onClick={() => void handleCopy()}
      >
        Copiar
      </button>
      <span role="status" aria-live="polite" className={styles.copyFeedback}>
        {copied ? 'Copiado' : ''}
      </span>
    </span>
  );
}

/**
 * smartolt-provision-fe (K2-FE) — modal multi-paso "Aprovisionar ONU".
 *
 * Flujo button-driven con APROBACIÓN del dry-run (innegociable — es la
 * protección del operador):
 *  1. Picker de ONUs sin configurar (no-Huawei deshabilitadas; VLAN según OLT).
 *  2. Dry-run: POST {dryRun:true} → PLAN legible de los 7 calls + WiFi + PPPoE.
 *  3. Ejecución real: POST {dryRun:false} → steps por estado + credenciales.
 *
 * TODO el estado del wizard vive en este componente (top-level useState): un
 * re-render del padre NUNCA pierde el paso ni la selección. El componente se
 * monta solo con el modal abierto (el padre lo condiciona), así que cada
 * apertura arranca limpia y la query de ONUs no corre de fondo.
 *
 * Doble-click = doble provisión NO: `busy` se setea sincrónicamente antes del
 * await y deshabilita el botón — aunque el BE lo tolere, acá no se permite.
 */
export function ProvisionOnuModal({ contractId, onClose }: ProvisionOnuModalProps) {
  const [step, setStep] = useState<WizardStep>('picker');
  const [selectedSn, setSelectedSn] = useState<string | null>(null);
  const [vlanText, setVlanText] = useState('');
  const [vlanOverride, setVlanOverride] = useState(false);
  const [vlanError, setVlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ProvisionPlanResult | null>(null);
  const [result, setResult] = useState<ProvisionExecutedResult | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const onusQuery = useUnconfiguredOnus();
  const provision = useProvisionOnu();

  const onus: UnconfiguredOnu[] = onusQuery.data ?? [];
  const selected = onus.find(o => o.sn === selectedSn) ?? null;
  // La ejecución REAL en vuelo es lo único que bloquea cerrar el modal:
  // abandonar a mitad de la provisión dejaría al operador sin las credenciales.
  const executing = busy && step === 'plan';

  // Foco: guardar el trigger al montar, foco inicial al diálogo, restaurar al cerrar.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, []);

  // Al cambiar de paso, devolver el foco al diálogo (el control enfocado del
  // paso anterior desaparece; sin esto el foco cae a <body> y el trap queda ciego).
  useEffect(() => {
    dialogRef.current?.focus();
  }, [step]);

  // Scroll-lock + teclado: Esc cierra (salvo ejecución en vuelo), Tab cicla adentro.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!executing) onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);
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
  }, [executing, onClose]);

  function handleClose() {
    if (executing) return;
    onClose();
  }

  function handleSelect(sn: string) {
    setSelectedSn(sn);
    setVlanOverride(false);
    setVlanText('');
    setVlanError(null);
    setPostError(null);
  }

  /** true cuando el input de VLAN está editable (obligatoria u override manual). */
  const vlanEditable = selected ? selected.vlanRequired || vlanOverride : false;

  /** Resuelve la VLAN a enviar según el modo. `undefined` = usar default del BE. */
  function resolveVlan(): { ok: true; vlan?: number } | { ok: false; msg: string } {
    if (!selected) return { ok: false, msg: 'Elegí una ONU primero.' };
    if (!vlanEditable) return { ok: true }; // default del catálogo: el BE la resuelve
    if (vlanText.trim() === '') {
      return { ok: false, msg: 'Ingresá la VLAN de servicio (1-4094).' };
    }
    const n = Number(vlanText);
    if (!Number.isInteger(n) || n < 1 || n > 4094) {
      return { ok: false, msg: 'La VLAN tiene que ser un número entero entre 1 y 4094.' };
    }
    return { ok: true, vlan: n };
  }

  async function handleDryRun() {
    if (!selected || busy) return;
    const v = resolveVlan();
    if (!v.ok) {
      setVlanError(v.msg);
      return;
    }
    setVlanError(null);
    setPostError(null);
    setBusy(true);
    try {
      const payload: ProvisionOnuPayload = { contractId, onuSn: selected.sn, dryRun: true };
      if (v.vlan !== undefined) payload.vlan = v.vlan;
      const res = await provision.mutateAsync(payload);
      if (res.dryRun) {
        setPlan(res);
        setStep('plan');
      }
    } catch (err) {
      setPostError(mapFiberError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExecute() {
    if (!plan || busy) return;
    setPostError(null);
    setBusy(true);
    try {
      // Se ejecuta EXACTAMENTE lo aprobado: mismos onuSn/vlan del plan.
      const payload: ProvisionOnuPayload = { contractId, onuSn: plan.onuSn, dryRun: false };
      if (plan.vlan !== null) payload.vlan = plan.vlan;
      const res = await provision.mutateAsync(payload);
      if (!res.dryRun) {
        setResult(res);
        setStep('result');
      }
    } catch (err) {
      setPostError(mapFiberError(err));
    } finally {
      setBusy(false);
    }
  }

  // ── Paso 1: picker ──────────────────────────────────────────────────────────

  function renderPicker() {
    return (
      <>
        <div className={styles.pickerToolbar}>
          <p className={styles.pickerHint}>
            ONUs detectadas por las OLTs que todavía no fueron configuradas.
          </p>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void onusQuery.refetch()}
            disabled={onusQuery.isFetching}
          >
            {onusQuery.isFetching ? 'Refrescando…' : 'Refrescar'}
          </button>
        </div>

        {onusQuery.isLoading ? (
          <div className={styles.loadingBlock}>
            <p role="status">Buscando ONUs sin configurar…</p>
            <div className={styles.skeleton} aria-hidden="true" />
            <div className={styles.skeleton} aria-hidden="true" />
            <div className={styles.skeleton} aria-hidden="true" />
          </div>
        ) : onusQuery.isError ? (
          <div className={styles.errorBlock}>
            <p role="alert" className={styles.errorText}>{mapFiberError(onusQuery.error)}</p>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => void onusQuery.refetch()}
            >
              Reintentar
            </button>
          </div>
        ) : onus.length === 0 ? (
          <p className={styles.emptyBlock}>
            No hay ONUs sin configurar detectadas en las OLTs. Conectá la ONU del
            cliente a la fibra, esperá a que la OLT la detecte y refrescá la lista.
          </p>
        ) : (
          <ul className={styles.onuList}>
            {onus.map(onu => (
              <li key={onu.sn} className={styles.onuItem}>
                <label className={`${styles.onuRow} ${!onu.huawei ? styles.onuRowDisabled : ''}`}>
                  <input
                    type="radio"
                    name="provision-onu-sn"
                    className={styles.onuRadio}
                    checked={selectedSn === onu.sn}
                    disabled={!onu.huawei}
                    onChange={() => handleSelect(onu.sn)}
                    aria-label={`ONU ${onu.sn}`}
                  />
                  <span className={styles.onuInfo}>
                    <span className={styles.onuSn}>{onu.sn}</span>
                    <span className={styles.onuMeta}>{onu.onuTypeName ?? 'Tipo desconocido'}</span>
                    <span className={styles.onuMeta}>
                      OLT {onu.oltName ?? onu.oltId} · board {onu.board ?? '?'} / port {onu.port ?? '?'}
                    </span>
                    {!onu.huawei && (
                      <span className={styles.onuDisabledReason}>solo Huawei se auto-aprovisiona</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className={styles.vlanBlock}>
            <label className={styles.vlanLabel} htmlFor="provision-vlan">
              VLAN de servicio
            </label>
            <div className={styles.vlanRow}>
              <input
                id="provision-vlan"
                type="number"
                inputMode="numeric"
                min={1}
                max={4094}
                className={styles.vlanInput}
                required={vlanEditable}
                readOnly={!vlanEditable}
                value={vlanEditable ? vlanText : (selected.serviceVlanDefault ?? '')}
                onChange={e => {
                  setVlanText(e.target.value);
                  setVlanError(null);
                }}
                aria-invalid={vlanError ? true : undefined}
                aria-describedby="provision-vlan-hint"
              />
              {!selected.vlanRequired && !vlanOverride && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setVlanOverride(true);
                    setVlanText(String(selected.serviceVlanDefault ?? ''));
                  }}
                >
                  Cambiar VLAN
                </button>
              )}
              {!selected.vlanRequired && vlanOverride && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setVlanOverride(false);
                    setVlanText('');
                    setVlanError(null);
                  }}
                >
                  Usar default
                </button>
              )}
            </div>
            <p id="provision-vlan-hint" className={styles.vlanHint}>
              {selected.vlanRequired
                ? 'esta OLT no tiene VLAN default — la elige el operador'
                : vlanOverride
                  ? `Override manual — el default del catálogo es ${selected.serviceVlanDefault}.`
                  : 'Default del catálogo de la OLT — se puede overridear.'}
            </p>
            {vlanError && (
              <p role="alert" className={styles.errorText}>{vlanError}</p>
            )}
          </div>
        )}

        {postError && <p role="alert" className={styles.errorText}>{postError}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.btnSecondary} onClick={handleClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!selected || busy}
            onClick={() => void handleDryRun()}
          >
            {busy ? 'Generando plan…' : 'Ver plan (dry-run)'}
          </button>
        </div>
      </>
    );
  }

  // ── Paso 2: plan (dry-run) ──────────────────────────────────────────────────

  function renderPlan() {
    if (!plan) return null;
    return (
      <>
        <dl className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <dt>ONU</dt>
            <dd className={styles.mono}>{plan.onuSn}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>VLAN de servicio</dt>
            <dd>{plan.vlan ?? 'default del OLT — se resuelve al ejecutar'}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>WiFi 2.4 GHz</dt>
            <dd>{plan.wifi.ssid24}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>WiFi 5 GHz</dt>
            <dd>{plan.wifi.ssid5}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Clave WiFi</dt>
            <dd>{plan.wifi.password}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>PPPoE</dt>
            <dd>
              <span>{PPPOE_ACTION_COPY[plan.pppoe.action]}</span>{' '}
              <span className={styles.mono}>{plan.pppoe.username}</span>
            </dd>
          </div>
        </dl>

        <h3 className={styles.blockTitle}>Calls a SmartOLT que se van a ejecutar</h3>
        <ol className={styles.planList}>
          {plan.plan.map((item, idx) => (
            <li key={idx} className={styles.planItem}>
              <span className={styles.planCall}>{item.call}</span>
              <div className={styles.planParamsWrap}>
                <code className={styles.planParams}>{JSON.stringify(item.params)}</code>
              </div>
            </li>
          ))}
        </ol>

        <p className={styles.impactNote} id="provision-impact">
          Ejecutar este plan configura la ONU REAL del cliente: la autoriza en la
          OLT y le escribe VLAN, TR-069 y WiFi.
        </p>

        {postError && <p role="alert" className={styles.errorText}>{postError}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => {
              setPostError(null);
              setStep('picker');
            }}
            disabled={busy}
          >
            Volver
          </button>
          <button type="button" className={styles.btnSecondary} onClick={handleClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            aria-describedby="provision-impact"
            disabled={busy}
            onClick={() => void handleExecute()}
          >
            {busy ? 'Aprovisionando…' : 'Ejecutar aprovisionamiento'}
          </button>
        </div>
      </>
    );
  }

  // ── Paso 3: resultado ───────────────────────────────────────────────────────

  function renderPppoeResult(pppoe: ProvisionExecutedResult['pppoe']) {
    switch (pppoe.status) {
      case 'created':
        return (
          <div className={styles.pppoeBlock}>
            <p className={styles.okNote}>Credenciales PPPoE creadas — pasáselas al instalador:</p>
            <dl className={styles.credGrid}>
              <div className={styles.summaryItem}>
                <dt>Usuario PPPoE</dt>
                <dd>
                  <code className={styles.secret}>{pppoe.username}</code>
                  <CopyButton value={pppoe.username} label="Copiar usuario PPPoE" />
                </dd>
              </div>
              <div className={styles.summaryItem}>
                <dt>Clave PPPoE</dt>
                <dd>
                  <code className={styles.secret}>{pppoe.password}</code>
                  <CopyButton value={pppoe.password} label="Copiar clave PPPoE" />
                </dd>
              </div>
            </dl>
          </div>
        );
      case 'existing':
        return (
          <p className={styles.pppoeBlock}>
            PPPoE ya existente — usuario{' '}
            <code className={styles.secret}>{pppoe.username}</code> (la clave vive
            solo en el RADIUS).
          </p>
        );
      case 'stale':
        return (
          <div className={`${styles.pppoeBlock} ${styles.warnBox}`}>
            <span aria-hidden="true" className={styles.warnIcon}>⚠</span>
            <p className={styles.warnText}>
              PPPoE en revisión — usuario{' '}
              <code className={styles.secret}>{pppoe.username}</code>:{' '}
              <span>{STALE_COPY[pppoe.reason]}</span>
            </p>
          </div>
        );
      case 'failed':
        return (
          <p className={`${styles.pppoeBlock} ${styles.warnBox}`}>
            La pre-provisión PPPoE falló — la ONU quedó aprovisionada igual;
            gestioná las credenciales PPPoE a mano.
          </p>
        );
      case 'skipped':
        return (
          <p className={styles.pppoeBlock}>
            PPPoE no pre-provisionado (sin perfil PPPoE configurado o contrato sin
            número GR).
          </p>
        );
    }
  }

  function renderResult() {
    if (!result) return null;
    return (
      <>
        <h3 className={styles.blockTitle}>Pasos ejecutados</h3>
        <ul className={styles.stepList}>
          {result.steps.map(s => (
            <li key={s.step} data-testid={`step-${s.step}`} className={styles.stepRow}>
              <span aria-hidden="true" className={`${styles.stepSymbol} ${styles[`stepSymbol_${s.status}`]}`}>
                {STATUS_SYMBOLS[s.status]}
              </span>
              <span className={styles.stepName}>{STEP_LABELS[s.step]}</span>
              <span className={`${styles.stepBadge} ${styles[`stepBadge_${s.status}`]}`}>
                {STATUS_LABELS[s.status]}
              </span>
              {s.detail && <span className={styles.stepDetail}>{s.detail}</span>}
            </li>
          ))}
        </ul>

        <h3 className={styles.blockTitle}>WiFi configurada</h3>
        <dl className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <dt>SSID 2.4 GHz</dt>
            <dd>{result.wifi.ssid24}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>SSID 5 GHz</dt>
            <dd>{result.wifi.ssid5}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Clave WiFi</dt>
            <dd>
              <code className={styles.secret}>{result.wifi.password}</code>
              <CopyButton value={result.wifi.password} label="Copiar clave WiFi" />
            </dd>
          </div>
        </dl>

        <h3 className={styles.blockTitle}>PPPoE</h3>
        {renderPppoeResult(result.pppoe)}

        {result.taskUpdated ? (
          <p className={styles.infoNote}>
            El detalle del aprovisionamiento quedó registrado en la descripción de
            la tarea.
          </p>
        ) : (
          <p className={styles.warnBox}>
            No se pudo registrar el detalle en la descripción de la tarea — guardá
            las credenciales de esta pantalla ahora.
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>
            Listo
          </button>
        </div>
      </>
    );
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="provision-onu-title"
    >
      <div className={styles.dialog} ref={dialogRef} tabIndex={-1}>
        <div className={styles.header}>
          <div>
            <h2 id="provision-onu-title" className={styles.title}>Aprovisionar ONU</h2>
            <p className={styles.stepIndicator}>{STEP_TITLES[step]}</p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Cerrar"
            disabled={executing}
          >
            ✕
          </button>
        </div>

        {step === 'picker' && renderPicker()}
        {step === 'plan' && renderPlan()}
        {step === 'result' && renderResult()}
      </div>
    </div>,
    document.body,
  );
}
