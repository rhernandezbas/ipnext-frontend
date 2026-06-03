import axiosClient from './axios-client';
import type { ActivityPage } from '@/types/taskActivity';

/**
 * Fetch one page of a task's activity feed (newest-first, keyset cursor).
 * GET /api/scheduling/:id/activity?limit=&cursor=
 */
export const getTaskActivity = (taskId: string, cursor?: string | null, limit = 50) =>
  axiosClient
    .get<ActivityPage>(`/scheduling/${taskId}/activity`, {
      params: { limit, ...(cursor ? { cursor } : {}) },
    })
    .then(r => r.data);
