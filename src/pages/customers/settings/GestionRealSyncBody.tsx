import { useState, useEffect } from 'react';
import { useSyncConfig, useUpdateSyncConfig } from '@/hooks/useGestionRealSyncConfig';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useGestionRealSyncStatus } from '@/hooks/useGestionRealSync';
import {
  INTERVAL_PRESETS_MIN,
  minutesToMs,
  resolveIntervalPreset,
  ESTADOS_CATALOG,
  estadosEqual,
} from '@/types/gestionRealSync';
import type { SyncConfigDTO, UpdateSyncConfigPayload } from '@/types/gestionRealSync';
import styles from './GestionRealSync.module.css';

const FLAG_KEY = 'gestion-real-sync';

/**
 * Local mutable form state. `intervalMs` is stored RAW (in ms) so a loaded
 * non-preset value (e.g. 200000) survives a save untouched. The select edits it
 * only when the user actually changes the interval (via minutesToMs). `estados`
 * is persisted in catalog order so the saved array is deterministic.
 */
interface FormState {
  intervalMs: number;
  estados: string[];
}

function configToForm(c: SyncConfigDTO): FormState {
  return {
    intervalMs: c.intervalMs,
    // Normalize to catalog order so dirty-comparison is stable.
    estados: ESTADOS_CATALOG.filter(e => c.estados.includes(e.value)).map(e => e.value),
  };
}

function formEquals(a: FormState, b: FormState): boolean {
  return a.intervalMs === b.intervalMs && estadosEqual(a.estados, b.estados);
}

/** Map a save error to a Spanish message based on the backend error code. */
function mapSaveError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  const status = e?.response?.status;
  const code = e?.response?.data?.code;
  if (status === 400 || code === 'VALIDATION_ERROR') {
    return 'Datos inválidos. Revisá los campos e intentá de nuevo.';
  }
  return 'No se pudo guardar la configuración. Reintentá en unos segundos.';
}

const es = new Intl.NumberFormat('es-AR');

// ── Configuración ───────────────────────────────────────────────────────────

function ConfigSection() {
  const { data: config, isLoading, isError, refetch } = useSyncConfig();
  const update = useUpdateSyncConfig();

  // The feature flag `gestion-real-sync` is the SINGLE on/off for the sync.
  // The activation toggle below reads/writes it live (independent of Guardar).
  // The sync has no enable-guard: turning on/off is always allowed.
  const syncFlag = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();
  const flagEnabled = syncFlag.data?.enabled ?? false;

  const [form, setForm] = useState<FormState | null>(null);

  // Reset baseline whenever the loaded config changes (load / invalidate success).
  useEffect(() => {
    if (config) setForm(configToForm(config));
  }, [config]);

  if (isError && !config) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Configuración</h3>
        <div className={styles.card}>
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span>No se pudo cargar la configuración.</span>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnPrimary} onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading || !config || !form) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Configuración</h3>
        <div className={styles.card}>
          <p className={styles.tableLoading}>Cargando…</p>
        </div>
      </section>
    );
  }

  const baseline = configToForm(config);
  const dirty = !formEquals(form, baseline);

  // Display the interval as minutes; flag non-preset loaded values for a graceful
  // option. A value is only a "preset" when it round-trips exactly: e.g. 200000ms
  // rounds to 3 min but minutesToMs(3)=180000 ≠ 200000, so it is custom.
  const intervalMin = resolveIntervalPreset(form.intervalMs).minutes;
  const intervalIsPreset =
    (INTERVAL_PRESETS_MIN as readonly number[]).includes(intervalMin) &&
    minutesToMs(intervalMin) === form.intervalMs;

  function patch(p: Partial<FormState>) {
    // Clear stale save feedback as soon as the user edits the form.
    if (update.isSuccess || update.isError) update.reset();
    setForm(f => (f ? { ...f, ...p } : f));
  }

  function toggleEstado(value: string, checked: boolean) {
    setForm(f => {
      if (!f) return f;
      const next = checked ? [...f.estados, value] : f.estados.filter(v => v !== value);
      // Persist in catalog order for deterministic, stable comparisons.
      const ordered = ESTADOS_CATALOG.filter(e => next.includes(e.value)).map(e => e.value);
      return { ...f, estados: ordered };
    });
    if (update.isSuccess || update.isError) update.reset();
  }

  // Activation toggle: writes the feature flag live. No enable-guard.
  function handleToggleFlag(next: boolean) {
    if (setFlag.isPending) return;
    setFlag.mutate({ key: FLAG_KEY, enabled: next });
  }

  function handleSave() {
    if (!dirty || update.isPending) return;
    const payload: UpdateSyncConfigPayload = {
      intervalMs: form!.intervalMs,
      estados: form!.estados,
    };
    update.mutate(payload);
  }

  const saveError = update.isError ? mapSaveError(update.error) : null;

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Configuración</h3>
      <div className={styles.card}>
        <div className={styles.toggleRow}>
          <span className={styles.fieldLabel}>Activar sincronización de Gestión Real</span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={flagEnabled}
              disabled={setFlag.isPending}
              onChange={e => handleToggleFlag(e.target.checked)}
              aria-label="Activar sincronización de Gestión Real"
            />
            <span className={styles.switchTrack} aria-hidden="true" />
          </label>
        </div>

        {!flagEnabled && (
          <span className={styles.fieldHint}>La sincronización está desactivada.</span>
        )}

        {setFlag.isError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span>No se pudo cambiar el estado de la sincronización. Reintentá en unos segundos.</span>
          </div>
        )}

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gr-sync-interval">Intervalo (minutos)</label>
            <select
              id="gr-sync-interval"
              className={styles.select}
              value={String(intervalMin)}
              onChange={e => patch({ intervalMs: minutesToMs(Number(e.target.value)) })}
            >
              {!intervalIsPreset && (
                <option value={String(intervalMin)}>
                  {intervalMin} min (personalizado)
                </option>
              )}
              {INTERVAL_PRESETS_MIN.map(m => (
                <option key={m} value={String(m)}>{m} min</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className={styles.estadosFieldset}>
          <legend className={styles.estadosLegend}>Estados a sincronizar</legend>
          <div className={styles.estadosGrid}>
            {ESTADOS_CATALOG.map(estado => (
              <label key={estado.value} className={styles.estadoOption}>
                <input
                  type="checkbox"
                  checked={form.estados.includes(estado.value)}
                  onChange={e => toggleEstado(estado.value, e.target.checked)}
                  aria-label={estado.label}
                />
                {estado.label}
              </label>
            ))}
          </div>
          {form.estados.length === 0 && (
            <span className={styles.fieldHint}>
              Sin estados seleccionados no se sincroniza ningún cliente.
            </span>
          )}
        </fieldset>

        {saveError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span>{saveError}</span>
          </div>
        )}

        {update.isSuccess && !dirty && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`}>
            <span>Configuración guardada.</span>
          </div>
        )}

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!dirty || update.isPending}
            onClick={handleSave}
          >
            {update.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Estado ──────────────────────────────────────────────────────────────────

const COUNTERS: { key: 'itemsSynced' | 'clientCount' | 'contractCount'; label: string }[] = [
  { key: 'itemsSynced', label: 'Items sincronizados' },
  { key: 'clientCount', label: 'Clientes' },
  { key: 'contractCount', label: 'Contratos' },
];

function StatusSection() {
  const { data: status, isLoading, isError } = useGestionRealSyncStatus();

  const lastRun =
    status?.lastRunAt != null
      ? new Date(status.lastRunAt).toLocaleString('es-AR')
      : 'Nunca';

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Estado</h3>
      <div className={styles.card}>
        {isError && !status ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span>No se pudo cargar el estado.</span>
          </div>
        ) : isLoading && !status ? (
          <p className={styles.tableLoading}>Cargando…</p>
        ) : (
          <>
            <p className={styles.lastRun}>
              Última corrida: <span className={styles.lastRunValue}>{lastRun}</span>
            </p>
            <div className={styles.countersGrid}>
              {COUNTERS.filter(c => status?.[c.key] != null || c.key === 'itemsSynced').map(c => (
                <div key={c.key} className={styles.counter} data-testid={`gr-sync-counter-${c.key}`}>
                  <span className={styles.counterValue}>{es.format(status?.[c.key] ?? 0)}</span>
                  <span className={styles.counterLabel}>{c.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Sub-tab "Sincronización" del SchedulingSettingsPage. Compone las dos secciones
 * (Configuración / Estado) sobre los endpoints de gestion-real/sync. Las secciones
 * consumen hooks exclusivamente — axios vive en la capa api. Espeja
 * `GestionRealBody` pero con un shape distinto ({ intervalMs, estados }) y sin
 * sección de revisión pendiente.
 */
export function GestionRealSyncBody() {
  return (
    <div className={styles.body}>
      <ConfigSection />
      <StatusSection />
    </div>
  );
}
