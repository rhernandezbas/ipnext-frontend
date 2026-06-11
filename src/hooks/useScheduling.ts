import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScheduledTask, TaskChecklistItem, TaskListFilter, CreateTaskPayload, TaskGeneralStatus } from '@/types/scheduling';
import * as api from '@/api/scheduling.api';
import { createTaskFromTicket } from '@/api/tickets.api';
import { PROJECTS_KEY } from '@/hooks/useProjects';

/**
 * Invalidate both the scheduling tasks list and the projects list.
 * Projects need invalidation because the API returns per-project `taskCounts`
 * aggregates that mutate whenever a task is created, deleted, moved, or has
 * its status changed.
 */
function invalidateTasksAndProjects(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['scheduling-tasks'] });
  void qc.invalidateQueries({ queryKey: PROJECTS_KEY });
  // Refresh the activity feed (#10) so changes show without a page reload.
  void qc.invalidateQueries({ queryKey: ['task-activity'] });
}

/**
 * Invalidate one task's detail view AND its activity feed (#10) — used by the
 * checklist/inventory mutations so their events appear without a page reload.
 */
function invalidateTaskDetail(qc: ReturnType<typeof useQueryClient>, taskId: string) {
  void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] });
  void qc.invalidateQueries({ queryKey: ['task-activity', taskId] });
}

export function useTasks() {
  return useQuery({ queryKey: ['scheduling-tasks'], queryFn: () => api.listTasks() });
}

/** Fetch tasks filtered by a specific customer. Used for the count badge in CustomerDetailPage. */
export function useTasksByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['scheduling-tasks', { customerId }],
    queryFn: () => api.listTasks({ customerId }),
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

/**
 * Like useTasks but accepts a filter and uses a filter-keyed queryKey.
 * Used by SchedulingTasksPage — does NOT affect other pages using useTasks().
 */
export function useFilteredTasks(filter: TaskListFilter = {}) {
  return useQuery({
    queryKey: ['scheduling-tasks', filter],
    queryFn: () => api.listTasks(filter),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['scheduling-task', id],
    queryFn: () => api.getTask(id!),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskPayload) => api.createTask(data),
    onSuccess: () => invalidateTasksAndProjects(qc),
  });
}

/**
 * Create a task FROM a ticket (#9). Hits POST /tickets/:id/tasks so the backend
 * persists `ticketId` (the generic POST /scheduling drops it by design). Resolves
 * with the created task so the caller can redirect to its detail page.
 */
export function useCreateTaskFromTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: CreateTaskPayload }) =>
      createTaskFromTicket(ticketId, body),
    onSuccess: () => invalidateTasksAndProjects(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduledTask> }) =>
      api.updateTask(id, data),
    onSuccess: (_result, { id }) => {
      invalidateTasksAndProjects(qc);
      void qc.invalidateQueries({ queryKey: ['scheduling-task', id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => invalidateTasksAndProjects(qc),
  });
}

/**
 * Set a task's general status (#41) — open / closed / dismissed.
 * Hits POST /scheduling/:id/status (gated by scheduling.write on the BE).
 * Invalidates the task lists, the task detail + its activity feed, and the
 * projects aggregates (task counts move with the status).
 */
export function useSetTaskGeneralStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskGeneralStatus }) =>
      api.setTaskGeneralStatus(id, status),
    onSuccess: (_result, { id }) => {
      invalidateTasksAndProjects(qc);
      invalidateTaskDetail(qc, id);
    },
  });
}

/**
 * Close (or re-open) a task. Re-implemented over the general-status endpoint
 * (#41): `isClosed:true → status 'closed'`, `isClosed:false → status 'open'`.
 * The `{ id, isClosed }` signature is kept INTACT so existing call sites
 * (TaskHeader / TasksTableView bulk close) need no changes.
 */
export function useCloseTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isClosed }: { id: string; isClosed: boolean }) =>
      api.setTaskGeneralStatus(id, isClosed ? 'closed' : 'open'),
    onSuccess: (_result, { id }) => {
      invalidateTasksAndProjects(qc);
      void qc.invalidateQueries({ queryKey: ['scheduling-task', id] });
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateTaskStatus(id, status),
    onSuccess: () => invalidateTasksAndProjects(qc),
  });
}

export function useMoveTaskToStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      api.moveTaskToStage(id, stageId),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: ['scheduling-task', id] });
      invalidateTasksAndProjects(qc);
    },
  });
}

/**
 * Bulk move many tasks to a stage. Invalidates the task lists when settled so
 * the table reflects whatever moved (even on partial failure).
 */
export function useBulkMoveTasksToStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, stageId }: { ids: string[]; stageId: string }) =>
      api.bulkMoveToStage(ids, stageId),
    onSettled: () => {
      invalidateTasksAndProjects(qc);
    },
  });
}

// ── Checklist hooks ──────────────────────────────────────────────────────────

export function useAddChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.addChecklistItem(taskId, text),
    onSuccess: () => invalidateTaskDetail(qc, taskId),
  });
}

export function useToggleChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.toggleChecklistItem(taskId, itemId),
    onMutate: async (itemId: string) => {
      await qc.cancelQueries({ queryKey: ['scheduling-task', taskId] });
      const snapshot = qc.getQueryData<ScheduledTask>(['scheduling-task', taskId]);
      if (snapshot) {
        qc.setQueryData<ScheduledTask>(['scheduling-task', taskId], {
          ...snapshot,
          checklist: snapshot.checklist.map(item =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
        });
      }
      return { snapshot };
    },
    onError: (_err, _itemId, context) => {
      if (context?.snapshot) {
        qc.setQueryData(['scheduling-task', taskId], context.snapshot);
      }
    },
    onSettled: (_data, err) => {
      if (err) {
        void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] });
      }
      // Always refresh the activity feed (#10) — the toggle emits an event.
      void qc.invalidateQueries({ queryKey: ['task-activity', taskId] });
    },
  });
}

export function useUpdateChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, text }: { itemId: string; text: string }) =>
      api.updateChecklistItem(taskId, itemId, text),
    onSuccess: () => invalidateTaskDetail(qc, taskId),
  });
}

export function useRemoveChecklistItem(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.removeChecklistItem(taskId, itemId),
    onSuccess: () => invalidateTaskDetail(qc, taskId),
  });
}

export function useReorderChecklist(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderChecklist(taskId, orderedIds),
    onSuccess: () => invalidateTaskDetail(qc, taskId),
  });
}

export function useAssignTemplateToTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => api.assignTemplateToTask(taskId, templateId),
    onSuccess: () => invalidateTaskDetail(qc, taskId),
  });
}

export function useClearChecklist(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.clearChecklist(taskId),
    onSuccess: () => invalidateTaskDetail(qc, taskId),
  });
}

// ── Inventory review ─────────────────────────────────────────────────────────

export function useSetTaskInventoryReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewed }: { id: string; reviewed: boolean }) =>
      api.setTaskInventoryReview(id, reviewed),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: ['scheduling-tasks'] });
      invalidateTaskDetail(qc, id);
    },
  });
}

// Type alias exported for convenience in components
export type { TaskChecklistItem };

// ── IClass manual resend ─────────────────────────────────────────────────────

/** Cache IClass nodes for 5 min — the list is small and changes rarely. */
export function useIClassNodes(enabled = false) {
  return useQuery({
    queryKey: ['iclass-nodes'],
    queryFn: () => api.listIClassNodes(),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useResendToIClass(taskId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeCode: string) => {
      if (!taskId) return Promise.reject(new Error('taskId is required'));
      return api.resendTaskToIClass(taskId, nodeCode);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling-task', taskId] });
      void qc.invalidateQueries({ queryKey: ['scheduling-tasks'] });
    },
  });
}
