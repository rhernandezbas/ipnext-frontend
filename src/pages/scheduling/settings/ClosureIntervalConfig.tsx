import { useState, useEffect } from 'react';
import { Can } from '@/components/auth/Can';
import { useClosureConfig, useUpdateClosureConfig } from '@/hooks/useClosureConfig';
import styles from './IClassSettings.module.css';
import localStyles from './ClosureIntervalConfig.module.css';

const MS_PER_MINUTE = 60_000;

function msToMinutes(ms: number): number {
  return Math.round(ms / MS_PER_MINUTE);
}

function minutesToMs(minutes: number): number {
  return minutes * MS_PER_MINUTE;
}

/**
 * Settings card for configuring the closure and autocomplete scheduler intervals.
 * Gated to `iclass.manage`. Changes take effect on next server restart.
 */
function ClosureIntervalConfigInner() {
  const { data, isLoading, isError } = useClosureConfig();
  const update = useUpdateClosureConfig();

  const [closureMin, setClosureMin] = useState<number>(0);
  const [autocompleteMin, setAutocompleteMin] = useState<number>(0);

  // Sync local state when data arrives (or changes after invalidation)
  useEffect(() => {
    if (data) {
      setClosureMin(msToMinutes(data.closureIntervalMs));
      setAutocompleteMin(msToMinutes(data.autocompleteIntervalMs));
    }
  }, [data]);

  if (isLoading) {
    return (
      <section className={styles.statusCard}>
        <p className={styles.tableLoading}>Cargando…</p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.statusCard}>
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>
            <span className={styles.bannerTitle}>No se pudo cargar la configuración de intervalos.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      </section>
    );
  }

  const originalClosureMin = msToMinutes(data.closureIntervalMs);
  const originalAutocompleteMin = msToMinutes(data.autocompleteIntervalMs);

  const isDirty =
    closureMin !== originalClosureMin || autocompleteMin !== originalAutocompleteMin;
  const isValid = closureMin >= 1 && autocompleteMin >= 1;
  const canSave = isDirty && isValid && !update.isPending;

  function handleSave() {
    update.mutate({
      closureIntervalMs: minutesToMs(closureMin),
      autocompleteIntervalMs: minutesToMs(autocompleteMin),
    });
  }

  return (
    <section className={styles.statusCard}>
      <header className={styles.statusHeader}>
        <h2 className={styles.statusTitle}>Frecuencia de los procesos automáticos</h2>
      </header>

      <p className={styles.statusDescription}>
        Controlá cada cuánto tiempo corren el loop de cierre y el auto-completado.
        El mínimo es 1 minuto; valores bajos aumentan la carga en el servidor.
      </p>

      <div className={localStyles.formRow}>
        <div className={localStyles.formGroup}>
          <label className={localStyles.label} htmlFor="closure-interval-min">
            Cierre automático (minutos)
          </label>
          <input
            id="closure-interval-min"
            type="number"
            className={localStyles.numberInput}
            min={1}
            value={closureMin}
            onChange={(e) => setClosureMin(Number(e.target.value))}
            aria-label="Cierre automático (minutos)"
          />
        </div>

        <div className={localStyles.formGroup}>
          <label className={localStyles.label} htmlFor="autocomplete-interval-min">
            Auto-completado (minutos)
          </label>
          <input
            id="autocomplete-interval-min"
            type="number"
            className={localStyles.numberInput}
            min={1}
            value={autocompleteMin}
            onChange={(e) => setAutocompleteMin(Number(e.target.value))}
            aria-label="Auto-completado (minutos)"
          />
        </div>
      </div>

      <div className={`${styles.statusActionRow} ${localStyles.actionRow}`}>
        <p className={localStyles.restartNote}>
          Los cambios se aplican en el próximo reinicio del servidor.
        </p>
        <button
          className={styles.btnPrimary}
          disabled={!canSave}
          onClick={handleSave}
          aria-label="Guardar configuración de intervalos"
        >
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {update.isSuccess && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <span>
            <span className={styles.bannerTitle}>Guardado.</span>{' '}
            Los intervalos se actualizaron correctamente.
          </span>
        </div>
      )}

      {update.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>
            <span className={styles.bannerTitle}>No se pudo guardar.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </section>
  );
}

/** Permission-gated wrapper for ClosureIntervalConfigInner. */
export function ClosureIntervalConfig() {
  return (
    <Can permission="iclass.manage">
      <ClosureIntervalConfigInner />
    </Can>
  );
}
