import { Link } from 'react-router-dom';
import { Can } from '@/components/auth/Can';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './AutomationsBody.module.css';

const RETURNS_FLAG_KEY = 'iclass-inventory-returns';
const DEDUCT_FLAG_KEY = 'inventory-material-auto-deduct';

/**
 * Sub-tab "Automatizaciones" de Configuración de Inventario.
 * Expone los toggles de los dos feature flags que controlan el encolado
 * de sugerencias en Devoluciones y Descuentos de materiales.
 *
 * Ambos flags SOLO encolan sugerencias — nunca mutan stock directamente.
 * La única mutación real ocurre cuando el operador confirma cada sugerencia.
 *
 * Sigue el mismo patrón que IClassClosureFlagBody:
 *  - useFeatureFlag devuelve `enabled: false` si la key no existe (AD-3).
 *  - Toggles gateados con <Can permission="inventory.manage">.
 */
export function AutomationsBody() {
  const returnsFlag = useFeatureFlag(RETURNS_FLAG_KEY);
  const deductFlag = useFeatureFlag(DEDUCT_FLAG_KEY);
  const setFlag = useSetFeatureFlag();

  const returnsEnabled = returnsFlag.data?.enabled ?? false;
  const deductEnabled = deductFlag.data?.enabled ?? false;

  function handleReturnsToggle() {
    setFlag.mutate({ key: RETURNS_FLAG_KEY, enabled: !returnsEnabled });
  }

  function handleDeductToggle() {
    setFlag.mutate({ key: DEDUCT_FLAG_KEY, enabled: !deductEnabled });
  }

  if (returnsFlag.isLoading || deductFlag.isLoading) {
    return (
      <section className={styles.statusCard}>
        <p>Cargando…</p>
      </section>
    );
  }

  if (returnsFlag.isError || deductFlag.isError) {
    return (
      <section className={styles.statusCard}>
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>
            <span className={styles.bannerTitle}>No se pudo cargar el estado de las automatizaciones.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.section}>
      <p className={styles.note}>
        Estos flags solo <strong>encolan sugerencias</strong> — nunca mutan el stock directamente.
        La única mutación es la confirmación manual del operador.
      </p>

      {/* ── Card 1: Devoluciones por retiro ──────────────────────────── */}
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Devoluciones por retiro</h2>
          <span
            className={`${styles.statusBadge} ${returnsEnabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}
          >
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {returnsEnabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          {returnsEnabled
            ? 'Cuando una OS de retiro cierra en IClass, el equipo detectado se encola en Devoluciones pendientes para que un operador confirme su vuelta al depósito.'
            : 'Los retiros cierran sin encolar devoluciones. Activá para detectar el equipo del retiro y proponer su devolución al depósito. La confirmación siempre es manual.'}
        </p>

        <p className={styles.statusDescription}>
          <Link to="/admin/inventory/returns">Ver devoluciones pendientes</Link>
        </p>

        <Can permission="inventory.manage">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {returnsEnabled ? 'Desactivar devoluciones por retiro' : 'Activar devoluciones por retiro'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={returnsEnabled}
                disabled={setFlag.isPending}
                onChange={handleReturnsToggle}
                aria-label="Devoluciones por retiro"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado de la automatización.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}

      {/* ── Card 2: Descuento de materiales ──────────────────────────── */}
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Descuento de materiales</h2>
          <span
            className={`${styles.statusBadge} ${deductEnabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}
          >
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {deductEnabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          {deductEnabled
            ? 'Cada consumo de material registrado en una tarea encola un descuento en Descuentos pendientes (del stock del técnico asignado; sin stock → revisión). El operador confirma cada descuento.'
            : 'El consumo de materiales se registra pero no propone descuentos de stock. Activá para encolar descuentos pendientes. La confirmación siempre es manual.'}
        </p>

        <p className={styles.statusDescription}>
          <Link to="/admin/inventory/deductions">Ver descuentos pendientes</Link>
        </p>

        <Can permission="inventory.manage">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {deductEnabled ? 'Desactivar descuento de materiales' : 'Activar descuento de materiales'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={deductEnabled}
                disabled={setFlag.isPending}
                onChange={handleDeductToggle}
                aria-label="Descuento de materiales"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>
      </section>
    </div>
  );
}
