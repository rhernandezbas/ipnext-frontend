import { useMutation, useQueryClient } from '@tanstack/react-query';
import { closeIClassOS, assignIClassTeam } from '@/api/iclassOsActions.api';
import type { CloseIClassOSPayload, AssignIClassTeamPayload } from '@/api/iclassOsActions.api';

/**
 * Cierra/valida una OS de IClass desde Prominense.
 * POST /scheduling/:id/iclass/close
 * Gate: scheduling.iclass_close + flag iclass-close-action
 *
 * Invalida el detalle de la tarea y la lista para que el badge de estado
 * IClass se actualice sin necesidad de recargar.
 */
export function useCloseIClassOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...payload }: { taskId: string } & CloseIClassOSPayload) =>
      closeIClassOS(taskId, payload),
    onSuccess: (_data, { taskId }) => {
      void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] });
      void qc.invalidateQueries({ queryKey: ['scheduling-tasks'] });
      void qc.invalidateQueries({ queryKey: ['task-activity', taskId] });
    },
  });
}

/**
 * Asigna una cuadrilla a una OS de IClass desde Prominense.
 * POST /scheduling/:id/iclass/assign-team
 * Gate: scheduling.iclass_assign + flag iclass-assign-action
 */
export function useAssignIClassTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...payload }: { taskId: string } & AssignIClassTeamPayload) =>
      assignIClassTeam(taskId, payload),
    onSuccess: (_data, { taskId }) => {
      void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] });
      void qc.invalidateQueries({ queryKey: ['scheduling-tasks'] });
      void qc.invalidateQueries({ queryKey: ['task-activity', taskId] });
    },
  });
}
