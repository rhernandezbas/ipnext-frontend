export interface TaskCommentAttachment {
  id: string;
  commentId: string;
  url: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: TaskCommentAttachment[];
}

export interface AddTaskCommentInput {
  taskId: string;
  authorName: string;
  body: string;
  attachments: Array<{
    url: string;
    filename: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
}
