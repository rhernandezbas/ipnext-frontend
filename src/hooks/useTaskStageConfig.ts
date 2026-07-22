import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTaskStageConfig, updateTaskStageConfig } from '@/api/taskStageConfig.api';
import type { TaskStageConfigOutput, UpdateTaskStageConfigPayload } from '@/types/taskStageConfig';

/**
 * useTaskStageConfig (bulk-task-recipients FE, D8) — hooks del mapeo
 * Stage→elegible-como-destinatario-de-tarea. Molde `useNocBroadcast.ts`
 * (mismo par GET query + PUT mutation con invalidación).
 *
 * Dos consumidores comparten esta MISMA key: `TaskStageConfigCard` (Ajustes →
 * WhatsApp, gate `messaging.read`/`.manage`) Y el tab "Tarea" de
 * `CampaignComposer` (gate: el mismo que los otros tabs de destinatarios —
 * sin gate propio, la ruta ya exige `messaging.bulk`). Guardar en la card
 * invalida la cache — el composer ve el mapeo nuevo sin F5.
 */
export const taskStageConfigKey = ['taskStageConfig'] as const;

/** `enabled` (default `true`) — lo ata el caller a un permiso cuando corresponda (molde `useTemplates(enabled)`). */
export function useTaskStageConfig(enabled: boolean = true) {
  return useQuery({
    queryKey: taskStageConfigKey,
    queryFn: getTaskStageConfig,
    enabled,
  });
}

/** PUT replace-set. Al resolver OK, sincroniza la cache con la respuesta (ya hidratada) e invalida para consistencia eventual. */
export function useUpdateTaskStageConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTaskStageConfigPayload) => updateTaskStageConfig(payload),
    onSuccess: (data: TaskStageConfigOutput) => {
      qc.setQueryData(taskStageConfigKey, data);
      void qc.invalidateQueries({ queryKey: taskStageConfigKey });
    },
  });
}
