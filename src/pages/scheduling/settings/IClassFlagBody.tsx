import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from '../SchedulingTaskCategoriesPage.module.css';

const FLAG_KEY = 'iclass-integration';

/**
 * Sub-tab "Integración" del back office de IClass.
 * Toggle ON/OFF del feature flag `iclass-integration`. Si la key no existe en
 * DB el hook devuelve `enabled: false` (AD-3), así que acá solo manejamos
 * loading / network-error / data.
 */
export function IClassFlagBody() {
  const { data, isLoading, isError, refetch } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();

  if (isLoading) {
    return (
      <div className={styles.card}>
        <p className={styles.empty}>Cargando…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.card}>
        <p className={styles.error}>No se pudo cargar el estado de la integración.</p>
        <button className={styles.btnSecondary} onClick={() => refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  const enabled = data.enabled;

  function handleToggle() {
    setFlag.mutate({ key: FLAG_KEY, enabled: !enabled });
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.modalTitle}>Integración con IClass</h2>

      <label className={styles.label} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={setFlag.isPending}
          onChange={handleToggle}
          aria-label="Integración con IClass"
        />
        <span>
          {enabled
            ? 'Integración activa: las tareas que pases a la etapa "Enviar a IClass" crearán órdenes de servicio.'
            : 'Integración inactiva: las tareas que pases a la etapa "Enviar a IClass" sólo cambian de etapa, no se envía nada al panel.'}
        </span>
      </label>

      {setFlag.isError && (
        <p className={styles.error}>No se pudo cambiar el estado de la integración. Reintentá en unos segundos.</p>
      )}
    </div>
  );
}
