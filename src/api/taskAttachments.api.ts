import axiosClient from './axios-client';
import type { TaskAttachment } from '@/types/taskAttachments';

const BASE = '/scheduling';

/** GET /scheduling/:taskId/attachments — gated `scheduling.read`. */
export const listTaskAttachments = (taskId: string) =>
  axiosClient
    .get<TaskAttachment[]>(`${BASE}/${taskId}/attachments`)
    .then(r => r.data);

/**
 * POST /scheduling/:taskId/attachments — gated `scheduling.write`.
 *
 * multipart/form-data, field name `photos` (the BE's multer field). Up to 15
 * files, 10 MiB each, jpg/png/webp only (validated client-side at the input and
 * server-side). axios 1.x rewrites the multipart Content-Type to add the proper
 * `boundary` for a FormData body in the browser, so the explicit header here is
 * just intent — the boundary is appended automatically.
 */
export const uploadTaskAttachments = (taskId: string, files: File[]) => {
  const form = new FormData();
  for (const file of files) form.append('photos', file);
  return axiosClient
    .post<TaskAttachment[]>(`${BASE}/${taskId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(r => r.data);
};

/** DELETE /scheduling/attachments/:id — gated `scheduling.write`. */
export const deleteTaskAttachment = (attachmentId: string) =>
  axiosClient.delete(`${BASE}/attachments/${attachmentId}`);
