import { useEffect, useMemo, useState } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useTaskStageConfig, useUpdateTaskStageConfig } from '@/hooks/useTaskStageConfig';
import type { Workflow, WorkflowStage } from '@/types/workflow';
import styles from './TaskStageConfigCard.module.css';

/**
 * TaskStageConfigCard (bulk-task-recipients FE, D8, Parte A) — tarjeta
 * "Destinatarios por estado de tarea" en `WhatsappSettingsPage` (molde
 * `NocBroadcastCard`): multi-select PROPIO (checklist con checkboxes
 * accesibles, JAMÁS un `<select multiple>` nativo) agrupado por Workflow,
 * poblado por `useWorkflows()` (catálogo de estados, gate FE
 * `scheduling.read`) + el mapeo actual de `GET /config/task-stages` (gate
 * `messaging.read`, resuelto por el `<Can>` que envuelve esta card en
 * `WhatsappSettingsPage`). Guarda con `PUT` (gate `messaging.manage`).
 *
 * 4 ramas de estado (D8): cargando / catálogo de workflows vacío / sin
 * `scheduling.read` (hint accionable, NO un 403 opaco) / cargado (checklist +
 * mapeo tildado). El fetch de workflows NI SE DISPARA sin `scheduling.read`
 * (403 seguro que ningún "Reintentá" cura — mismo criterio M2 de
 * `NetworkFilterPanel`).
 *
 * Guardar con confirm SI el nuevo set REDUCE el mapeo actual (algún stage
 * previamente mapeado queda destildado): el impacto es real — esos estados
 * dejan de estar disponibles como criterio en campañas NUEVAS (las ya creadas
 * no cambian, snapshot inmutable D7 del BE). Agregar estados nuevos sin
 * quitar ninguno guarda directo, sin confirm.
 */
export function TaskStageConfigCard() {
  const { can } = useMyPermissions();
  const confirm = useConfirm();
  const hasSchedulingRead = can('scheduling.read');
  const canManage = can('messaging.manage');

  const workflowsQuery = useWorkflows(hasSchedulingRead);
  const configQuery = useTaskStageConfig();
  const update = useUpdateTaskStageConfig();

  const workflows: Workflow[] = workflowsQuery.data ?? [];
  const mappedStages = configQuery.data?.stages ?? [];
  const baselineIds = useMemo(() => mappedStages.map((s) => s.stageId), [mappedStages]);

  const [selected, setSelected] = useState<Set<string> | null>(null);

  // Reset baseline cuando el mapeo cargado cambia (load inicial / tras guardar OK).
  useEffect(() => {
    if (configQuery.data) setSelected(new Set(baselineIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baselineIds ya memoizado sobre configQuery.data
  }, [configQuery.data]);

  // ── 4 ramas ──────────────────────────────────────────────────────────────
  if (!hasSchedulingRead) {
    return (
      <section className={styles.card}>
        <p className={styles.hint}>
          Necesitás permiso de <strong>scheduling</strong> (scheduling.read) para elegir estados de tarea acá.
        </p>
      </section>
    );
  }

  if (workflowsQuery.isLoading || configQuery.isLoading || selected === null) {
    return (
      <section className={styles.card}>
        <p className={styles.loading}>Cargando…</p>
      </section>
    );
  }

  const workflowsWithStages = workflows.filter((wf) => wf.stages.length > 0);
  if (workflowsWithStages.length === 0) {
    return (
      <section className={styles.card}>
        <p className={styles.hint}>
          No hay estados de tarea configurados en Scheduling todavía — creá workflows/estados primero.
        </p>
      </section>
    );
  }

  const baselineSet = new Set(baselineIds);
  const dirty = !sameSet(selected, baselineSet);
  const removedCount = baselineIds.filter((id) => !selected.has(id)).length;

  function toggleStage(stageId: string) {
    if (!canManage) return;
    if (update.isSuccess || update.isError) update.reset();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  async function handleSave() {
    if (!selected || !dirty || update.isPending || !canManage) return;
    if (removedCount > 0) {
      const ok = await confirm({
        title: 'Desmapear estados de tarea',
        message: `Vas a desmapear ${removedCount} estado${removedCount === 1 ? '' : 's'} de tarea. Dejarán de estar disponibles como criterio en campañas NUEVAS (las campañas ya creadas no cambian).`,
        tone: 'danger',
        confirmLabel: 'Desmapear',
      });
      if (!ok) return;
    }
    update.mutate({ stageIds: [...selected] });
  }

  const saveError = update.isError ? mapSaveError(update.error) : null;

  return (
    <section className={styles.card}>
      <p className={styles.description}>
        Elegí en qué estados de tarea (agrupados por workflow) un cliente cuenta como destinatario del criterio
        &quot;Tarea&quot; en el envío masivo de WhatsApp.
      </p>

      {!canManage && (
        <p className={styles.readOnlyNote} role="status">
          Solo lectura — necesitás permiso de gestión (messaging.manage) para editar el mapeo.
        </p>
      )}

      <div className={styles.groups}>
        {workflowsWithStages.map((wf) => (
          <fieldset key={wf.id} className={styles.group} disabled={!canManage}>
            <legend className={styles.groupLegend}>{wf.name}</legend>
            <div className={styles.stageList}>
              {[...wf.stages].sort((a, b) => a.order - b.order).map((stage: WorkflowStage) => {
                const checkboxId = `task-stage-${stage.id}`;
                return (
                  <label
                    key={stage.id}
                    htmlFor={checkboxId}
                    className={styles.stageOption}
                    data-disabled={canManage ? undefined : 'true'}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selected.has(stage.id)}
                      disabled={!canManage}
                      onChange={() => toggleStage(stage.id)}
                    />
                    {stage.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {saveError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>{saveError}</span>
        </div>
      )}
      {update.isSuccess && !dirty && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" aria-live="polite">
          <span>Mapeo guardado.</span>
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!dirty || update.isPending || !canManage}
          onClick={() => void handleSave()}
        >
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  );
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

interface ApiError {
  response?: { status?: number; data?: { code?: string } };
}

function mapSaveError(err: unknown): string {
  const e = err as ApiError;
  const status = e?.response?.status;
  if (status === 403) {
    return 'No tenés permiso para editar el mapeo de estados de tarea.';
  }
  if (status === 422) {
    return 'Uno o más estados elegidos ya no existen. Recargá la página e intentá de nuevo.';
  }
  return 'No se pudo guardar el mapeo. Reintentá en unos segundos.';
}
