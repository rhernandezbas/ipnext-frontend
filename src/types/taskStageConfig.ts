/**
 * bulk-task-recipients FE (D8) — DTOs del 5to dominio de destinatarios del
 * bulk WhatsApp ("Tarea"): capability de config `messaging-task-stage-config`.
 * Espejo del BE (`GetTaskStageRecipientConfig`/`UpdateTaskStageRecipientConfig`,
 * `taskStageConfig.routes.ts`) — archivo PROPIO (no colgado de
 * `messagingBulk.ts`), mismo criterio que el BE separó
 * `messaging-task-stage-config` de `messaging-bulk` (2 capabilities
 * distintas, D2/desvío #3 del tasks.md).
 */

/**
 * Un `Stage` mapeado como elegible para el criterio "Tarea" — hidratado
 * (nombre/código/color/workflow), NO solo el id crudo. `color` puede ser
 * `null` (un Stage sin color asignado en Scheduling).
 */
export interface MappedStageDto {
  stageId: string;
  stageName: string;
  stageCode: string;
  color: string | null;
  workflowId: string;
  workflowName: string;
}

/** GET y PUT `/api/messaging/config/task-stages` devuelven el mismo sobre. */
export interface TaskStageConfigOutput {
  stages: MappedStageDto[];
  /**
   * bulk-task-stage-transition (TTC-4) — el ÚNICO estado resultante global al que
   * transicionan las tareas cuando el bulk las envía (o `null` si no hay). Aditivo
   * sobre el GET existente.
   */
  resultingStage?: MappedStageDto | null;
}

/** Body de PUT — replace-set (reemplaza el mapeo completo, NO suma). */
export interface UpdateTaskStageConfigPayload {
  stageIds: string[];
}

/** bulk-task-stage-transition — respuesta de PUT `/resulting-stage`. */
export interface TaskStageTransitionConfigOutput {
  resultingStage: MappedStageDto | null;
}

/** bulk-task-stage-transition — body de PUT `/resulting-stage` (string o null para limpiar). */
export interface SetResultingStagePayload {
  stageId: string | null;
}
