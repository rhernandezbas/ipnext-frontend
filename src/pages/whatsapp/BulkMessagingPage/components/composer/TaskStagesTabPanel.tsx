import type { MappedStageDto } from '@/types/taskStageConfig';
import styles from './TaskStagesTabPanel.module.css';

interface TaskStagesTabPanelProps {
  /** Estados MAPEADOS (config real de Ajustes → WhatsApp) — el ÚNICO universo tildable. */
  mappedStages: MappedStageDto[];
  isLoading: boolean;
  isError: boolean;
  /**
   * fix wave F6 (review adversarial) — true cuando `isError` es un 403 (sin
   * `messaging.read`): NO-retryable, "Reintentá" no cura nada. El caller
   * (`CampaignComposer`) lo deriva del `error` real de la query.
   */
  isForbidden?: boolean;
  /** `stageId[]` tildados — controlado, mismo patrón que `SegmentBuilder`/`NetworkFilterPanel`. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Chip honesto: total del preview AUTOMÁTICO del composer (unión de las 4 fuentes), solo con selección. */
  previewCount?: number;
  /** Chip honesto: tareas de red (sin cliente) en los stages tildados — `0`/ausente no se muestra. */
  noCustomerCount?: number;
  /** bulk-task-stage-transition (TRANS-6) — cuántas tareas transicionarán de estado al enviar. */
  willTransitionCount?: number;
  /** bulk-task-stage-transition (TRANS-6) — nombre del estado resultante configurado (para el hint). */
  resultingStageName?: string | null;
}

/**
 * TaskStagesTabPanel (bulk-task-recipients FE, D8, Parte B) — panel del tab
 * "Tarea" de la card "Destinatarios" del `CampaignComposer`. Checklist PROPIO
 * (checkboxes accesibles, JAMÁS un `<select multiple>` nativo) de los stages
 * MAPEADOS — el operador tilda un subset, que viaja como `taskStageIds` en
 * preview/recipients/create.
 *
 * Config vacía (sin ningún stage mapeado) → hint accionable señalando dónde
 * mapear ("Configurá estados de tarea en Ajustes → WhatsApp"), SIN checklist
 * — mismo criterio que "Números" (bulk-granular-perms) queda con su contenido
 * deshabilitado en vez de esconder el tab entero.
 */
export function TaskStagesTabPanel({
  mappedStages,
  isLoading,
  isError,
  isForbidden = false,
  value,
  onChange,
  previewCount,
  noCustomerCount,
  willTransitionCount,
  resultingStageName,
}: TaskStagesTabPanelProps) {
  if (isLoading) {
    return (
      <div className={styles.panel}>
        <p className={styles.notice} role="status">
          Cargando estados de tarea…
        </p>
      </div>
    );
  }

  if (isError) {
    // fix wave F6 — mismo criterio M2 que `TaskStageConfigCard` (rama sin
    // scheduling.read): un 403 es un problema de PERMISO, no transitorio —
    // "Reintentá" nunca lo va a curar.
    if (isForbidden) {
      return (
        <div className={styles.panel}>
          <p className={styles.hint} role="alert">
            No tenés permiso para ver los estados de tarea mapeados (necesitás <strong>messaging.read</strong>).
          </p>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <p className={styles.error} role="alert">
          No se pudieron cargar los estados de tarea. Reintentá.
        </p>
      </div>
    );
  }

  if (mappedStages.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.hint} role="status">
          Configurá estados de tarea en Ajustes → WhatsApp para usar este criterio.
        </p>
      </div>
    );
  }

  function toggle(stageId: string) {
    const next = value.includes(stageId) ? value.filter((id) => id !== stageId) : [...value, stageId];
    onChange(next);
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Estados de tarea</legend>

      {/* fix wave F3 (review adversarial) — mismo aviso que la card de
          Ajustes: sin esto, tildar un stage 'hecho'/'cancelado' esperando
          tareas cerradas resuelve en 0 destinatarios sin explicación. */}
      <p className={styles.hint}>
        Solo cuentan tareas <strong>ABIERTAS</strong> — las cerradas o descartadas no suman destinatarios.
      </p>

      <div className={styles.stageGroup} role="group" aria-label="Estados de tarea mapeados">
        {mappedStages.map((stage) => {
          const checkboxId = `bulk-task-stage-${stage.stageId}`;
          return (
            <label key={stage.stageId} htmlFor={checkboxId} className={styles.stageOption}>
              <input
                id={checkboxId}
                type="checkbox"
                className={styles.checkbox}
                checked={value.includes(stage.stageId)}
                onChange={() => toggle(stage.stageId)}
              />
              {stage.stageName} <span className={styles.workflowTag}>· {stage.workflowName}</span>
            </label>
          );
        })}
      </div>

      {value.length > 0 && typeof previewCount === 'number' && (
        <p className={styles.chip} role="status" aria-live="polite">
          Preview actual: <strong>{previewCount}</strong> destinatario{previewCount === 1 ? '' : 's'} en total (todas
          las fuentes combinadas).
        </p>
      )}

      {typeof noCustomerCount === 'number' && noCustomerCount > 0 && (
        <p className={styles.chip} role="status" aria-live="polite">
          {noCustomerCount} tarea{noCustomerCount === 1 ? '' : 's'} de red sin cliente excluida
          {noCustomerCount === 1 ? '' : 's'}.
        </p>
      )}

      {/* bulk-task-stage-transition (TRANS-6) — hint honesto de la transición */}
      {typeof willTransitionCount === 'number' && willTransitionCount > 0 && resultingStageName && (
        <p className={styles.chip} role="status" aria-live="polite">
          <strong>{willTransitionCount}</strong> tarea{willTransitionCount === 1 ? '' : 's'} pasará
          {willTransitionCount === 1 ? '' : 'n'} al estado <strong>{resultingStageName}</strong> cuando el mensaje salga OK.
        </p>
      )}
    </fieldset>
  );
}
