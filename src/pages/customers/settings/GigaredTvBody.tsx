import { useState } from 'react';
import { useGigaredConfig, useUpdateGigaredConfig } from '@/hooks/useGigared';
import { gigaredApi } from '@/api/gigared.api';
import type { GigaredSummary } from '@/types/gigared';
import styles from './GigaredTv.module.css';

/** Map a "Probar conexión" error to a Spanish message based on the BE code. */
function mapProbeError(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { code?: string } } };
  const code = e?.response?.data?.code;
  if (code === 'GIGARED_AUTH_FAILED') return 'API key inválida.';
  if (code === 'GIGARED_NOT_CONFIGURED') return 'La integración está apagada o sin API key.';
  if (code === 'GIGARED_UNAVAILABLE') return 'Gigared no responde. Reintentá en unos minutos.';
  return 'No se pudo probar la conexión. Reintentá en unos segundos.';
}

type ProbeState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; summary: GigaredSummary }
  | { kind: 'error'; message: string };

/**
 * Settings tab body for the Gigared TV integration. Three controls:
 *  - new API key input (password); sent only when non-empty (never echoes the key),
 *  - "Integración activa" toggle (writes the `enabled` flag live via updateConfig),
 *  - "Probar conexión" button → GET /summary, rendering counts on success or a
 *    mapped error (502 AUTH_FAILED → "API key inválida").
 */
export function GigaredTvBody() {
  const { data: config, isLoading, isError, refetch } = useGigaredConfig();
  const update = useUpdateGigaredConfig();

  const [newKey, setNewKey] = useState('');
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' });
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isError && !config) {
    return (
      <div className={styles.body}>
        <section className={styles.section}>
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
      </div>
    );
  }

  if (isLoading || !config) {
    return (
      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.card}>
            <p className={styles.tableLoading}>Cargando…</p>
          </div>
        </section>
      </div>
    );
  }

  const keyStatus = config.configured ? `···${config.apiKeyLast4 ?? ''}` : 'Sin configurar';

  async function handleSaveKey() {
    if (!newKey || update.isPending) return;
    setSaveError(null);
    try {
      await update.mutateAsync({ apiKey: newKey });
      setNewKey('');
    } catch {
      setSaveError('No se pudo guardar la API key.');
    }
  }

  async function handleToggleEnabled(next: boolean) {
    if (update.isPending) return;
    setSaveError(null);
    try {
      await update.mutateAsync({ enabled: next });
    } catch {
      setSaveError('No se pudo cambiar el estado de la integración.');
    }
  }

  async function handleProbe() {
    setProbe({ kind: 'loading' });
    try {
      const summary = await gigaredApi.getSummary();
      setProbe({ kind: 'ok', summary });
    } catch (err) {
      setProbe({ kind: 'error', message: mapProbeError(err) });
    }
  }

  return (
    <div className={styles.body}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>API Key</h3>
        <div className={styles.card}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Estado actual</span>
            <span className={styles.keyStatus}>{keyStatus}</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="gigared-new-key">
              Nueva API key
            </label>
            <input
              id="gigared-new-key"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Pegá la API key del partner"
            />
            <span className={styles.fieldHint}>
              Se guarda solo si escribís una nueva. La key nunca se muestra completa.
            </span>
          </div>

          <div className={styles.toggleRow}>
            <span className={styles.fieldLabel}>Integración activa</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={config.enabled}
                disabled={update.isPending}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
                aria-label="Integración activa"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>

          {saveError && (
            <div className={`${styles.banner} ${styles.bannerError}`}>
              <span>{saveError}</span>
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={probe.kind === 'loading'}
              onClick={handleProbe}
            >
              {probe.kind === 'loading' ? 'Probando…' : 'Probar conexión'}
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!newKey || update.isPending}
              onClick={handleSaveKey}
            >
              {update.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          {probe.kind === 'ok' && (
            <div className={`${styles.banner} ${styles.bannerSuccess}`}>
              <span>
                Conexión exitosa: {probe.summary.accounts.total} cuentas ·{' '}
                {probe.summary.services.length} servicios del partner.
              </span>
            </div>
          )}

          {probe.kind === 'error' && (
            <div className={`${styles.banner} ${styles.bannerError}`}>
              <span>{probe.message}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
