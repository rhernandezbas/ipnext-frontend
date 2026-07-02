import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import styles from './UispSyncCard.module.css';

const FLAG_KEY = 'pppoe-auto-move';

/**
 * Card del flag `pppoe-auto-move` para NetworkingSettingsPage → sección PPPoE
 * (pppoe-move-nas W2, REQ-AUTO-4: sin esta card el flag es INVISIBLE y el
 * go-live del watcher es imposible desde la UI).
 *
 * Activa/desactiva el vigilante de NAS: cada ~2 minutos detecta clientes PPPoE
 * que autentican por un NAS distinto al asignado y los mueve automáticamente.
 * A diferencia de las cards de ingesta (solo lectura de datos), PRENDER esto
 * dispara acciones automáticas sobre clientes reales → el ON pide confirmación
 * (useConfirm, tone danger); el OFF es directo, sin fricción.
 *
 * Flag gate: admin.flags (mismo permiso que las cards vecinas — toggle oculto
 * sin el permiso). Clona el patrón de RadiusAuthIngestCard (misma estructura,
 * mismo CSS module, mismos hooks).
 */
export function PppoeAutoMoveCard() {
  const { data: flagData, isLoading: flagLoading, isError: flagError } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();
  const confirm = useConfirm();

  if (flagLoading) {
    return (
      <section className={styles.statusCard}>
        <p className={styles.loadingText}>Cargando…</p>
      </section>
    );
  }

  const enabled = flagData?.enabled ?? false;

  async function handleFlagToggle() {
    if (!enabled) {
      // Prender arranca una automatización que mueve clientes REALES → confirmar.
      const ok = await confirm({
        title: 'Activar auto-move de PPPoE',
        message:
          'Este toggle enciende una automatización que actúa sobre clientes reales: ' +
          'cada 2 minutos el vigilante mueve de NAS (IP nueva del pool CGNAT + reconexión) ' +
          'a los clientes PPPoE que autentican por un NAS distinto al asignado. ' +
          '¿Activarlo ahora?',
        confirmLabel: 'Activar auto-move',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    // Apagar es inocuo (el tick siguiente ya no procesa) → directo.
    setFlag.mutate({ key: FLAG_KEY, enabled: false });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Auto-move de PPPoE (vigilante de NAS)</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Cada 2 minutos detecta clientes PPPoE que autentican por un NAS distinto al asignado
          y los mueve automáticamente (IP nueva del pool CGNAT del destino + reconexión).
          Solo actúa sobre IPs CGNAT; públicas y casos dudosos se registran en{' '}
          <strong>Movimientos NAS</strong> sin tocar al cliente.
        </p>

        {/* ── Flag toggle (admin.flags gate) ─────────────────────────── */}
        {!flagError && (
          <Can permission="admin.flags">
            <div className={styles.statusActionRow}>
              <span className={styles.statusActionLabel}>
                {enabled ? 'Desactivar auto-move' : 'Activar auto-move'}
              </span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={setFlag.isPending}
                  onChange={handleFlagToggle}
                  aria-label="Auto-move de PPPoE automático"
                />
                <span className={styles.switchTrack} aria-hidden="true" />
              </label>
            </div>
          </Can>
        )}
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>
            <span className={styles.bannerTitle}>No se pudo cambiar el estado del auto-move.</span>{' '}
            Reintentá en unos segundos.
          </span>
        </div>
      )}
    </div>
  );
}
