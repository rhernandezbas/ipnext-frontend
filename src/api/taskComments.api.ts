import axiosClient from './axios-client';
import type { TaskComment, AddTaskCommentInput } from '@/types/taskComments';

const BASE = '/scheduling';

export const listTaskComments = (taskId: string) =>
  axiosClient
    .get<TaskComment[]>(`${BASE}/${taskId}/comments`)
    .then(r => r.data);

export const addTaskComment = (input: AddTaskCommentInput) =>
  axiosClient
    .post<TaskComment>(`${BASE}/${input.taskId}/comments`, {
      body: input.body,
      authorName: input.authorName,
      attachments: input.attachments,
    })
    .then(r => r.data);

export const deleteTaskComment = (commentId: string) =>
  axiosClient.delete(`${BASE}/comments/${commentId}`);
