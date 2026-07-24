import { useEffect, useState } from 'react';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useNocAlertThresholds, useUpdateNocAlertThresholds } from '@/hooks/useNocAlertThresholds';
import type { NocAlertThresholdsDto, UpdateNocAlertThresholdsPayload } from '@/types/nocAlertThresholds';
import styles from './NocAlertThresholdsEditor.module.css';

/**
 * Editor de umbrales de alertas de fibra (change `noc-alerts-config`, Fase F
 * FE). Molde: `NocBroadcastCard` (GET puebla el form, diff a mano, feedback
 * éxito/error, `dirty` gatea el botón Guardar).
 *
 * GATE REAL — corrección respecto al pedido original: el contrato del BE
 * (`alerts.routes.ts::createThresholdsReadAuth`) NO tiene un fallback de
 * lectura para `monitoring.read`. El GET humano (sin la key del collector
 * Rust) exige `session + monitoring.manage` — LO MISMO que el PUT. Un
 * usuario con solo `monitoring.read` recibiría un 403 al simple GET, así que
 * "mostrar read-only" con datos reales es imposible: no hay datos que leer
 * sin `monitoring.manage`. Por eso este componente NO intenta el fetch sin
 * el permiso — muestra un fallback explicando el permiso faltante (mismo
 * criterio que `Can .. fallback=` en `NetworkingSettingsPage`), en vez de
 * gastar un request que siempre va a devolver 403.
 */

interface FormState {
  critDbm: string;
  warnDbm: string;
  deltaAlert: string;
  ponMinAbon: string;
  ponDelta: string;
}

function configToForm(c: NocAlertThresholdsDto): FormState {
  return {
    critDbm: String(c.critDbm),
    warnDbm: String(c.warnDbm),
    deltaAlert: String(c.deltaAlert),
    ponMinAbon: String(c.ponMinAbon),
    ponDelta: String(c.ponDelta),
  };
}

/** `null` cuando el string no es un número finito. */
function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

interface ValidationResult {
  payload: UpdateNocAlertThresholdsPayload | null;
  errors: string[];
}

/**
 * Valida el form contra el contrato del BE (`UpdateNocAlertThresholdsSchema`:
 * las 5 claves obligatorias y numéricas, `ponMinAbon` entero no-negativo) +
 * UNA regla de sanidad semántica agregada acá (NO del Zod del BE): `critDbm`
 * tiene que ser un Rx MÁS NEGATIVO (peor señal) que `warnDbm` — si no, los
 * umbrales quedan invertidos y ninguna alerta escalaría de warning a crítica
 * como corresponde.
 */
function validate(form: FormState): ValidationResult {
  const errors: string[] = [];

  const critDbm = parseNumber(form.critDbm);
  const warnDbm = parseNumber(form.warnDbm);
  const deltaAlert = parseNumber(form.deltaAlert);
  const ponDelta = parseNumber(form.ponDelta);
  const ponMinAbonRaw = parseNumber(form.ponMinAbon);

  if (critDbm === null) errors.push('Rx crítico (dBm) tiene que ser un número.');
  if (warnDbm === null) errors.push('Rx warning (dBm) tiene que ser un número.');
  if (deltaAlert === null) errors.push('Delta de alerta individual (dB) tiene que ser un número.');
  if (ponDelta === null) errors.push('Delta medio del PON (dB) tiene que ser un número.');

  let ponMinAbon: number | null = null;
  if (ponMinAbonRaw === null) {
    errors.push('Mínimo de abonados del PON tiene que ser un número.');
  } else if (!Number.isInteger(ponMinAbonRaw) || ponMinAbonRaw < 0) {
    errors.push('Mínimo de abonados del PON tiene que ser un entero mayor o igual a 0.');
  } else {
    ponMinAbon = ponMinAbonRaw;
  }

  if (critDbm !== null && warnDbm !== null && critDbm > warnDbm) {
    errors.push(
      'El Rx crítico debe ser igual o más negativo (peor señal) que el Rx warning — si no, ninguna alerta escala a crítica.',
    );
  }

  if (errors.length > 0 || critDbm === null || warnDbm === null || deltaAlert === null || ponDelta === null || ponMinAbon === null) {
    return { payload: null, errors };
  }

  return { payload: { critDbm, warnDbm, deltaAlert, ponMinAbon, ponDelta }, errors: [] };
}

function payloadsEqual(a: UpdateNocAlertThresholdsPayload, b: UpdateNocAlertThresholdsPayload): boolean {
  return (
    a.critDbm === b.critDbm &&
    a.warnDbm === b.warnDbm &&
    a.deltaAlert === b.deltaAlert &&
    a.ponMinAbon === b.ponMinAbon &&
    a.ponDelta === b.ponDelta
  );
}

interface ApiError {
  response?: { status?: number; data?: { code?: string } };
}

function mapSaveError(err: unknown): string {
  const e = err as ApiError;
  const status = e?.response?.status;
  if (status === 400) return 'Datos inválidos. Revisá los valores e intentá de nuevo.';
  if (status === 403) return 'No tenés permiso para guardar los umbrales (falta monitoring.manage).';
  return 'No se pudieron guardar los umbrales. Reintentá en unos segundos.';
}

function ThresholdsForm() {
  const { data: config, isLoading, isError, refetch } = useNocAlertThresholds();
  const update = useUpdateNocAlertThresholds();
  const confirm = useConfirm();

  const [form, setForm] = useState<FormState | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (config) setForm(configToForm(config));
  }, [config]);

  if (isError && !config) {
    return (
      <section className={styles.card}>
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>No se pudieron cargar los umbrales de alertas.</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (isLoading || !config || !form) {
    return (
      <section className={styles.card}>
        <p className={styles.loading}>Cargando…</p>
      </section>
    );
  }

  const baseline = configToForm(config);
  const { payload, errors } = validate(form);
  const baselinePayload: UpdateNocAlertThresholdsPayload = {
    critDbm: config.critDbm,
    warnDbm: config.warnDbm,
    deltaAlert: config.deltaAlert,
    ponMinAbon: config.ponMinAbon,
    ponDelta: config.ponDelta,
  };
  const dirty = payload !== null ? !payloadsEqual(payload, baselinePayload) : JSON.stringify(form) !== JSON.stringify(baseline);

  function patch(p: Partial<FormState>) {
    if (update.isSuccess || update.isError) update.reset();
    setValidationErrors([]);
    setForm((f) => (f ? { ...f, ...p } : f));
  }

  async function handleSave() {
    if (!dirty || update.isPending) return;
    if (!payload) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    const ok = await confirm({
      title: 'Guardar umbrales de alertas',
      message:
        'Esto cambia en caliente cuándo se dispara warning/crítico para TODOS los clientes de ' +
        'fibra monitoreados — afecta directamente qué alertas ve el equipo NOC a partir de ahora.',
      confirmLabel: 'Guardar umbrales',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    update.mutate(payload);
  }

  const saveError = update.isError ? mapSaveError(update.error) : null;

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>Umbrales de alertas de fibra</h2>
      </header>

      <p className={styles.hint}>
        Definen cuándo el hub NOC dispara <strong>warning</strong> / <strong>crítico</strong> por señal
        óptica y cuándo sospecha de un problema compartido en un PON.
      </p>

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="thr-crit">
            Rx crítico
          </label>
          <div className={styles.inputWithUnit}>
            <input
              id="thr-crit"
              type="number"
              step="0.1"
              inputMode="decimal"
              className={styles.input}
              value={form.critDbm}
              onChange={(e) => patch({ critDbm: e.target.value })}
              aria-describedby="thr-crit-hint"
            />
            <span className={styles.unit} aria-hidden="true">dBm</span>
          </div>
          <span id="thr-crit-hint" className={styles.fieldHint}>
            Rx peor que este valor (más negativo) = <strong>Crítico</strong>. Ej: -30.
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="thr-warn">
            Rx warning
          </label>
          <div className={styles.inputWithUnit}>
            <input
              id="thr-warn"
              type="number"
              step="0.1"
              inputMode="decimal"
              className={styles.input}
              value={form.warnDbm}
              onChange={(e) => patch({ warnDbm: e.target.value })}
              aria-describedby="thr-warn-hint"
            />
            <span className={styles.unit} aria-hidden="true">dBm</span>
          </div>
          <span id="thr-warn-hint" className={styles.fieldHint}>
            Rx peor que este valor = <strong>Warning</strong>. Ej: -27.
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="thr-delta">
            Delta de alerta individual
          </label>
          <div className={styles.inputWithUnit}>
            <input
              id="thr-delta"
              type="number"
              step="0.1"
              inputMode="decimal"
              className={styles.input}
              value={form.deltaAlert}
              onChange={(e) => patch({ deltaAlert: e.target.value })}
              aria-describedby="thr-delta-hint"
            />
            <span className={styles.unit} aria-hidden="true">dB</span>
          </div>
          <span id="thr-delta-hint" className={styles.fieldHint}>
            Empeoramiento individual que se reporta. Ej: 2.0.
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="thr-ponmin">
            Mínimo de abonados del PON
          </label>
          <div className={styles.inputWithUnit}>
            <input
              id="thr-ponmin"
              type="number"
              step="1"
              min="0"
              inputMode="numeric"
              className={styles.input}
              value={form.ponMinAbon}
              onChange={(e) => patch({ ponMinAbon: e.target.value })}
              aria-describedby="thr-ponmin-hint"
            />
            <span className={styles.unit} aria-hidden="true">abonados</span>
          </div>
          <span id="thr-ponmin-hint" className={styles.fieldHint}>
            Cantidad de abonados afectados en un mismo PON para sospechar de fibra/caja compartida. Ej: 2.
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="thr-pondelta">
            Delta medio del PON
          </label>
          <div className={styles.inputWithUnit}>
            <input
              id="thr-pondelta"
              type="number"
              step="0.1"
              inputMode="decimal"
              className={styles.input}
              value={form.ponDelta}
              onChange={(e) => patch({ ponDelta: e.target.value })}
              aria-describedby="thr-pondelta-hint"
            />
            <span className={styles.unit} aria-hidden="true">dB</span>
          </div>
          <span id="thr-pondelta-hint" className={styles.fieldHint}>
            Empeoramiento medio del PON para sospechar de un problema compartido. Ej: 1.5.
          </span>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert" aria-live="assertive">
          <ul className={styles.errorList}>
            {validationErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {saveError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert" aria-live="assertive">
          <span>{saveError}</span>
        </div>
      )}

      {update.isSuccess && !dirty && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" aria-live="polite">
          <span>Umbrales guardados.</span>
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!dirty || update.isPending}
          onClick={handleSave}
        >
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  );
}

export function NocAlertThresholdsEditor() {
  return (
    <Can
      permission="monitoring.manage"
      fallback={
        <section className={styles.card}>
          <p className={styles.noPermission}>
            Necesitás el permiso <strong>monitoring.manage</strong> para ver y editar los umbrales de
            alertas — el backend exige ese permiso incluso para leerlos (no hay modo solo-lectura con
            monitoring.read).
          </p>
        </section>
      }
    >
      <ThresholdsForm />
    </Can>
  );
}
