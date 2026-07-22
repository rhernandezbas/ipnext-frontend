import axiosClient from './axios-client';
import type { TaskStageConfigOutput, UpdateTaskStageConfigPayload } from '@/types/taskStageConfig';

/**
 * taskStageConfig.api (bulk-task-recipients FE, D6) — cliente del router
 * `/api/messaging/config/task-stages` (`taskStageConfig.routes.ts`, molde
 * `nocBroadcast.api`): config CRUD del mapeo Stage→elegible-como-destinatario.
 *
 * Envelope FLAT en ambos verbos (`res.json({stages})` directo, sin `{data}`
 * de por medio — a diferencia de `listBulkTemplates`/`listChatwootLabels`).
 */
const BASE = '/messaging/config/task-stages';

export const getTaskStageConfig = (): Promise<TaskStageConfigOutput> =>
  axiosClient.get<TaskStageConfigOutput>(BASE).then((r) => r.data);

export const updateTaskStageConfig = (payload: UpdateTaskStageConfigPayload): Promise<TaskStageConfigOutput> =>
  axiosClient.put<TaskStageConfigOutput>(BASE, payload).then((r) => r.data);
