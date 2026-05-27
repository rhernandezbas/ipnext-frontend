# Spec: Task Comments Timeline

## REQ-LIST-1
`useTaskComments(taskId)` fetches `GET /api/scheduling/:taskId/comments`.
Query key: `['task-comments', taskId]`. Enabled only when `taskId` is truthy.

## REQ-LIST-2
Comments are rendered chronologically (server order). Each shows: `authorName`, `body`, `createdAt` (formatted), and a delete button.

## REQ-LIST-3
Attachments are rendered as `<a href={url} target="_blank">filename</a>` links. No file upload.

## REQ-ADD-1
`useAddTaskComment(taskId)` calls `POST /api/scheduling/:taskId/comments` with `{ body, authorName, attachments }`.
On success: invalidates `['task-comments', taskId]`.

## REQ-ADD-2
The add-comment form has: textarea (body, required), text input (authorName, required), zero-or-more attachment rows (url + filename each).
Submit is disabled when body or authorName is empty or mutation is pending.

## REQ-DELETE-1
`useDeleteTaskComment(taskId)` calls `DELETE /api/scheduling/comments/:commentId`.
On success: invalidates `['task-comments', taskId]`.

## REQ-DELETE-2
Each comment has a delete button (`aria-label="Eliminar comentario de {authorName}"`).

## REQ-EMPTY
When the list is empty: show "Sin comentarios aún."

## REQ-LOADING
While loading: show "Cargando comentarios..."

## REQ-PLACE
`TaskCommentsTimeline` is placed after `ChecklistSection` in the main column of `SchedulingTaskDetailPage`.
