import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/taskAttachments.api';

const queryKey = (taskId: string) => ['task-attachments', taskId] as const;

/** Photos attached to a task. Disabled until a taskId is present. */
export function useTaskAttachments(taskId: string) {
  return useQuery({
    queryKey: queryKey(taskId),
    queryFn: () => api.listTaskAttachments(taskId),
    enabled: !!taskId,
  });
}

/**
 * Upload one or more photos to a task. Not taskId-bound at hook level so the
 * SAME mutation can serve the create flow (id known only after create) and the
 * detail "add more" flow. Invalidates the target task's attachments query.
 */
export function useUploadTaskAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, files }: { taskId: string; files: File[] }) =>
      api.uploadTaskAttachments(taskId, files),
    onSuccess: (_data, { taskId }) => {
      void qc.invalidateQueries({ queryKey: queryKey(taskId) });
    },
  });
}

/** Delete a photo. Bound to a taskId so it can invalidate that task's gallery. */
export function useDeleteTaskAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api.deleteTaskAttachment(attachmentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(taskId) });
    },
  });
}
