import { useState } from 'react';
import { Can } from '@/components/auth/Can';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useRunClosureBackfill, useReprocessClosure } from '@/hooks/useIClassClosure';
import type { ClosureBackfillResult, ClosureReprocessResult } from '@/api/iclassClosure.api';
import styles from './IClassSettings.module.css';

const FLAG_KEY = 'iclass-closure-loop';
const REPROCESS_FLAG_KEY = 'iclass-closure-reprocess';
const AUDIT_FLAG_KEY = 'iclass-audit';
const AUTOCOMPLETE_FLAG_KEY = 'task-autocomplete';

/**
 * Sub-tab "Cierre de OS" del back office de IClass.
 * Toggle del feature flag `iclass-closure-loop`: cuando está activo, el backend
 * importa las OS cerradas en IClass y mueve la tarea vinculada al estado mapeado
 * para ese resultado (ver sub-tab "Mapeo de resultados"). Mismo patrón que
 * IClassFlagBody: el hook devuelve `enabled: false` si la key no existe (AD-3).
 */
export function IClassClosureFlagBody() {
  const { data, isLoading, isError, refetch } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();
  const backfill = useRunClosureBackfill();
  const [lastBackfill, setLastBackfill] = useState<ClosureBackfillResult | null>(null);
  const reprocess = useReprocessClosure();
  const [lastReprocess, setLastReprocess] = useState<ClosureReprocessResult | null>(null);
  const reprocessFlag = useFeatureFlag(REPROCESS_FLAG_KEY);
  const reprocessEnabled = reprocessFlag.data?.enabled ?? false;
  const auditFlag = useFeatureFlag(AUDIT_FLAG_KEY);
  const auditEnabled = auditFlag.data?.enabled ?? false;
  const autocompleteFlag = useFeatureFlag(AUTOCOMPLETE_FLAG_KEY);
  const autocompleteEnabled = autocompleteFlag.data?.enabled ?? false;

  async function handleBackfill() {
    try {
      setLastBackfill(await backfill.mutateAsync());
    } catch {
      // surfaced via backfill.isError banner
    }
  }

  async function handleReprocess() {
    try {
      setLastReprocess(await reprocess.mutateAsync());
    } catch {
      // surfaced via reprocess.isError banner
    }
  }

  function handleReprocessToggle() {
    setFlag.mutate({ key: REPROCESS_FLAG_KEY, enabled: !reprocessEnabled });
  }

  function handleAuditToggle() {
    setFlag.mutate({ key: AUDIT_FLAG_KEY, enabled: !auditEnabled });
  }

  function handleAutocompleteToggle() {
    setFlag.mutate({ key: AUTOCOMPLETE_FLAG_KEY, enabled: !autocompleteEnabled });
  }

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
          <span><span className={styles.bannerTitle}>No se pudo cargar el estado del cierre automático.</span> Reintentá en unos segundos.</span>
        </div>
        <button className={styles.btnSecondary} onClick={() => refetch()}>
          Reintentar
        </button>
      </section>
    );
  }

  const enabled = data.enabled;

  function handleToggle() {
    setFlag.mutate({ key: FLAG_KEY, enabled: !enabled });
  }

  return (
    <div className={styles.section}>
      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Cierre automático de OS</h2>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          {enabled
            ? 'Cuando una OS se cierra en IClass, la tarea vinculada se mueve automáticamente al estado mapeado para ese resultado de cierre. Configurá los mapeos en la solapa "Mapeo de resultados".'
            : 'El cierre de una OS en IClass no afecta a las tareas locales. Activá para cerrar el loop: las OS cerradas mueven su tarea al estado que mapeaste.'}
        </p>

        <div className={styles.statusActionRow}>
          <span className={styles.statusActionLabel}>
            {enabled ? 'Desactivar cierre automático' : 'Activar cierre automático'}
          </span>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={setFlag.isPending}
              onChange={handleToggle}
              aria-label="Cierre automático de OS de IClass"
            />
            <span className={styles.switchTrack} aria-hidden="true" />
          </label>
        </div>
      </section>

      {setFlag.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudo cambiar el estado del cierre automático.</span> Reintentá en unos segundos.</span>
        </div>
      )}

      <section className={styles.statusCard}>
        <header className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Reconciliar tareas pendientes</h2>
        </header>
        <p className={styles.statusDescription}>
          Revisa ahora las tareas ya enviadas a IClass (en "Registrado en IClass") y, para las que ya cerraron, las mueve al estado mapeado. Es idempotente: podés correrlo las veces que quieras.
        </p>
        <div className={styles.statusActionRow}>
          <span className={styles.statusActionLabel}>Buscar cierres recientes y actualizar tareas</span>
          <button className={styles.btnSecondary} onClick={handleBackfill} disabled={backfill.isPending}>
            {backfill.isPending ? 'Reconciliando…' : 'Reconciliar ahora'}
          </button>
        </div>
      </section>

      {lastBackfill && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <span>
            <span className={styles.bannerTitle}>{lastBackfill.transitioned} tareas movidas.</span>{' '}
            {lastBackfill.mirrored} OS espejadas · {lastBackfill.skippedNotClosed} aún abiertas · {lastBackfill.skippedUnchanged} sin cambios.
          </span>
        </div>
      )}

      {backfill.isError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <span><span className={styles.bannerTitle}>No se pudo reconciliar.</span> Reintentá en unos segundos.</span>
        </div>
      )}

      <Can permission="iclass.manage">
        <section className={styles.statusCard}>
          <header className={styles.statusHeader}>
            <h2 className={styles.statusTitle}>Auditoría de IA</h2>
            <span className={`${styles.statusBadge} ${auditEnabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              {auditEnabled ? 'Activo' : 'Inactivo'}
            </span>
          </header>
          <p className={styles.statusDescription}>
            Cuando una OS cierra, un modelo de IA audita la calidad de la instalación (fotos, checklist, notas del técnico) y deja los hallazgos en la tarea. Apagado por defecto; prendelo cuando el modelo esté disponible.
          </p>
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {auditEnabled ? 'Desactivar auditoría de IA' : 'Activar auditoría de IA'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={auditEnabled}
                disabled={setFlag.isPending}
                onChange={handleAuditToggle}
                aria-label="Auditoría de IA en el cierre de OS"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </section>

        <section className={styles.statusCard}>
          <header className={styles.statusHeader}>
            <h2 className={styles.statusTitle}>Auto-completado de tareas</h2>
            <span className={`${styles.statusBadge} ${autocompleteEnabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              {autocompleteEnabled ? 'Activo' : 'Inactivo'}
            </span>
          </header>
          <p className={styles.statusDescription}>
            Un proceso periódico re-dispara automáticamente los efectos de cierre pendientes (comentario, auditoría, inventario) de las tareas incompletas. Apagado por defecto; misma maquinaria que "Reprocesar", pero automática.
          </p>
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {autocompleteEnabled ? 'Desactivar auto-completado' : 'Activar auto-completado'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={autocompleteEnabled}
                disabled={setFlag.isPending}
                onChange={handleAutocompleteToggle}
                aria-label="Auto-completado de tareas"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </section>

        <section className={styles.statusCard}>
          <header className={styles.statusHeader}>
            <h2 className={styles.statusTitle}>Reprocesar side-effects pendientes</h2>
          </header>
          <p className={styles.statusDescription}>
            Re-dispara solo los efectos pendientes (comentario, inventario, auditoría IA) de las OS ya espejadas, sin duplicar. Aplica a cualquier OS cerrada con efectos faltantes, no solo a las que están en "Registrado en IClass".
          </p>
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {reprocessEnabled ? 'Desactivar reprocesamiento' : 'Activar reprocesamiento'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={reprocessEnabled}
                disabled={setFlag.isPending}
                onChange={handleReprocessToggle}
                aria-label="Reprocesamiento de side-effects de cierre"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>Re-disparar efectos faltantes ahora</span>
            <button className={styles.btnSecondary} onClick={handleReprocess} disabled={reprocess.isPending || !reprocessEnabled}>
              {reprocess.isPending ? 'Reprocesando…' : 'Reprocesar ahora'}
            </button>
          </div>
        </section>

        {lastReprocess && (lastReprocess.skipped ? (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span><span className={styles.bannerTitle}>El flag de reprocesamiento está apagado.</span> Activá "iclass-closure-reprocess" para re-disparar los efectos.</span>
          </div>
        ) : (
          <div className={`${styles.banner} ${styles.bannerSuccess}`}>
            <span><span className={styles.bannerTitle}>{lastReprocess.processed} OS reprocesadas.</span>{' '}
            {lastReprocess.candidates} candidatas · {lastReprocess.noTask} sin tarea vinculada.</span>
          </div>
        ))}

        {reprocess.isError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <span><span className={styles.bannerTitle}>No se pudo reprocesar.</span> Reintentá en unos segundos.</span>
          </div>
        )}
      </Can>
    </div>
  );
}
