import type { MappedStageDto } from '@/types/taskStageConfig';
import styles from './TaskStagesTabPanel.module.css';

interface TaskStagesTabPanelProps {
  /** Estados MAPEADOS (config real de Ajustes → WhatsApp) — el ÚNICO universo tildable. */
  mappedStages: MappedStageDto[];
  isLoading: boolean;
  isError: boolean;
  /** `stageId[]` tildados — controlado, mismo patrón que `SegmentBuilder`/`NetworkFilterPanel`. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Chip honesto: total del preview AUTOMÁTICO del composer (unión de las 4 fuentes), solo con selección. */
  previewCount?: number;
  /** Chip honesto: tareas de red (sin cliente) en los stages tildados — `0`/ausente no se muestra. */
  noCustomerCount?: number;
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
  value,
  onChange,
  previewCount,
  noCustomerCount,
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
    </fieldset>
  );
}
