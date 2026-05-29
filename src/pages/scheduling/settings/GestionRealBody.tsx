import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useGestionRealConfig,
  useUpdateGestionRealConfig,
  useGestionRealStatus,
  useGestionRealNeedsReview,
} from '@/hooks/useGestionRealIngest';
import { useProjects } from '@/hooks/useProjects';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import {
  INTERVAL_PRESETS_MIN,
  minutesToMs,
  resolveIntervalPreset,
} from '@/types/gestionRealIngest';
import type {
  IngestConfigDTO,
  UpdateIngestConfigPayload,
} from '@/types/gestionRealIngest';
import styles from './GestionReal.module.css';

/**
 * Local mutable form state. `intervalMs` is stored RAW (in ms) so a loaded
 * non-preset value (e.g. 200000) survives a save untouched. The select edits it
 * only when the user actually changes the interval (via minutesToMs).
 */
interface FormState {
  enabled: boolean;
  intervalMs: number;
  windowMonths: number;
  fiberProjectId: string | null;
  wirelessProjectId: string | null;
}

function configToForm(c: IngestConfigDTO): FormState {
  return {
    enabled: c.enabled,
    intervalMs: c.intervalMs,
    windowMonths: c.windowMonths,
    fiberProjectId: c.fiberProjectId,
    wirelessProjectId: c.wirelessProjectId,
  };
}

function formEquals(a: FormState, b: FormState): boolean {
  return (
    a.enabled === b.enabled &&
    a.intervalMs === b.intervalMs &&
    a.windowMonths === b.windowMonths &&
    a.fiberProjectId === b.fiberProjectId &&
    a.wirelessProjectId === b.wirelessProjectId
  );
}

/** Map a save error to a Spanish message based on the backend error code. */
function mapSaveError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  const status = e?.response?.status;
  const code = e?.response?.data?.code;
  if (status === 400 || code === 'VALIDATION_ERROR') {
    return 'Datos inválidos. Revisá los campos e intentá de nuevo.';
  }
  if (status === 404 || code === 'PROJECT_NOT_FOUND') {
    return 'El proyecto seleccionado no fue encontrado.';
  }
  return 'No se pudo guardar la configuración. Reintentá en unos segundos.';
}

const es = new Intl.NumberFormat('es-AR');

// ── Configuración ───────────────────────────────────────────────────────────

function ConfigSection() {
  const { data: config, isLoading, isError, refetch } = useGestionRealConfig();
  const { data: projects = [] } = useProjects('all');
  const update = useUpdateGestionRealConfig();

  // Master release flag. When OFF, the backend skips the ingest even if
  // config.enabled is true — surface that so the operator isn't misled.
  const ingestFlag = useFeatureFlag('gestion-real-ingest');
  const systemDisabled = ingestFlag.data ? ingestFlag.data.enabled === false : false;

  const [form, setForm] = useState<FormState | null>(null);

  // Reset baseline whenever the loaded config changes (load / invalidate success).
  useEffect(() => {
    if (config) setForm(configToForm(config));
  }, [config]);

  // Fetch error → surface an error banner with retry, never an infinite spinner.
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

  // Enable-guard: enabling the ingest while a project is unmapped is blocked.
  const missingProject =
    form.enabled && (form.fiberProjectId === null || form.wirelessProjectId === null);

  // windowMonths must be a positive integer — clearing the input yields 0.
  const invalidWindow = !Number.isFinite(form.windowMonths) || form.windowMonths < 1;

  // Display the interval as minutes; flag non-preset loaded values for a graceful option.
  const intervalMin = resolveIntervalPreset(form.intervalMs).minutes;
  const intervalIsPreset = (INTERVAL_PRESETS_MIN as readonly number[]).includes(intervalMin);

  function patch(p: Partial<FormState>) {
    // Clear stale save feedback as soon as the user edits the form.
    if (update.isSuccess || update.isError) update.reset();
    setForm(f => (f ? { ...f, ...p } : f));
  }

  function handleSave() {
    if (!dirty || update.isPending || missingProject || invalidWindow) return;
    const payload: UpdateIngestConfigPayload = {
      enabled: form!.enabled,
      intervalMs: form!.intervalMs,
      windowMonths: form!.windowMonths,
      fiberProjectId: form!.fiberProjectId,
      wirelessProjectId: form!.wirelessProjectId,
    };
    update.mutate(payload);
  }

  const saveError = update.isError ? mapSaveError(update.error) : null;

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Configuración</h3>
      <div className={styles.card}>
        {systemDisabled && (
          <div className={`${styles.banner} ${styles.bannerWarning}`} role="status">
            <span>
              <span className={styles.bannerTitle}>Ingesta deshabilitada a nivel sistema.</span>{' '}
              La ingesta está deshabilitada a nivel sistema (feature flag
              {' '}«gestion-real-ingest»). Un administrador debe activarla en el panel
              de Feature Flags para que la sincronización corra.
            </span>
          </div>
        )}

        <div className={styles.toggleRow}>
          <span className={styles.fieldLabel}>Habilitar ingest de Gestión Real</span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => patch({ enabled: e.target.checked })}
              aria-label="Habilitar ingest de Gestión Real"
            />
            <span className={styles.switchTrack} aria-hidden="true" />
          </label>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gr-interval">Intervalo (minutos)</label>
            <select
              id="gr-interval"
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

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gr-window">Ventana (meses)</label>
            <input
              id="gr-window"
              type="number"
              min={1}
              className={styles.input}
              value={Number.isFinite(form.windowMonths) ? form.windowMonths : ''}
              onChange={e => patch({ windowMonths: e.target.value === '' ? NaN : Number(e.target.value) })}
            />
            {invalidWindow && (
              <span className={styles.fieldHint}>La ventana debe ser al menos 1 mes.</span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gr-fiber">Proyecto Fibra</label>
            <select
              id="gr-fiber"
              className={styles.select}
              value={form.fiberProjectId ?? ''}
              onChange={e => patch({ fiberProjectId: e.target.value || null })}
            >
              <option value="">(sin asignar)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gr-wireless">Proyecto Wireless</label>
            <select
              id="gr-wireless"
              className={styles.select}
              value={form.wirelessProjectId ?? ''}
              onChange={e => patch({ wirelessProjectId: e.target.value || null })}
            >
              <option value="">(sin asignar)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        {missingProject && (
          <div className={`${styles.banner} ${styles.bannerWarning}`}>
            <span>
              <span className={styles.bannerTitle}>Proyecto sin mapear.</span>{' '}
              Asigná un proyecto de Fibra y Wireless antes de habilitar el ingest:
              las órdenes clasificadas sin proyecto caen en revisión pendiente.
            </span>
          </div>
        )}

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
            disabled={!dirty || update.isPending || missingProject || invalidWindow}
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

const COUNTERS: { key: 'created' | 'skippedDuplicate' | 'skippedUnmirrored' | 'unclassified'; label: string }[] = [
  { key: 'created', label: 'Creadas' },
  { key: 'skippedDuplicate', label: 'Omitidas (duplicadas)' },
  { key: 'skippedUnmirrored', label: 'Omitidas (sin espejo)' },
  { key: 'unclassified', label: 'Sin clasificar' },
];

function StatusSection() {
  const { data: status, isLoading, isError } = useGestionRealStatus();

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
              {COUNTERS.map(c => (
                <div key={c.key} className={styles.counter} data-testid={`gr-counter-${c.key}`}>
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

// ── Revisión pendiente ──────────────────────────────────────────────────────

function NeedsReviewSection() {
  const { data: tasks = [], isLoading, isError } = useGestionRealNeedsReview();

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Revisión pendiente</h3>
      <div className={styles.tableWrap}>
        {isError ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span>No se pudo cargar la revisión pendiente.</span>
          </div>
        ) : isLoading ? (
          <p className={styles.tableLoading}>Cargando…</p>
        ) : tasks.length === 0 ? (
          <div className={styles.tableEmpty}>
            <span className={styles.tableEmptyTitle}>No hay tareas pendientes de revisión</span>
            Las órdenes que no se puedan clasificar automáticamente aparecerán acá.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Título</th>
                <th>Dirección</th>
                <th>Orden GR</th>
                <th>Creada</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>
                    <Link className={styles.rowLink} to={`/admin/scheduling/tasks/${t.id}`}>
                      {t.title}
                    </Link>
                  </td>
                  <td>{t.address || '—'}</td>
                  <td>{t.grOrdenId || '—'}</td>
                  <td>{new Date(t.createdAt).toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/**
 * Sub-tab "Gestión Real" del SchedulingSettingsPage. Compone las tres secciones
 * (Configuración / Estado / Revisión pendiente) sobre los 4 endpoints del
 * backend gestion-real-installation-ingest. Las secciones consumen hooks
 * exclusivamente — axios vive en la capa api.
 */
export function GestionRealBody() {
  return (
    <div className={styles.body}>
      <ConfigSection />
      <StatusSection />
      <NeedsReviewSection />
    </div>
  );
}
