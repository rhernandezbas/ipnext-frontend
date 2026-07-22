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
}

/** Body de PUT — replace-set (reemplaza el mapeo completo, NO suma). */
export interface UpdateTaskStageConfigPayload {
  stageIds: string[];
}
