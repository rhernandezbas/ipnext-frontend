# Proposal: Task Comments Timeline (Frontend)

## Intent
Add a comments timeline section to the scheduling task detail page. Technicians and admins can leave comments on a task, attach file references (url + filename), and delete comments.

## Scope
- `src/types/taskComments.ts` — TypeScript interfaces mirroring the backend entity
- `src/api/taskComments.api.ts` — list / add / delete calling backend endpoints
- `src/hooks/useTaskComments.ts` — TanStack Query hooks wrapping the api
- `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline.tsx` — UI component
- `src/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline.module.css` — scoped styles
- `src/pages/scheduling/SchedulingTaskDetailPage.tsx` — wire in `<TaskCommentsTimeline>`
- `src/__tests__/scheduling/components/TaskCommentsTimeline.test.tsx` — Vitest tests

## Backend Contract (confirmed)
- `GET  /api/scheduling/:taskId/comments` → `TaskComment[]`
- `POST /api/scheduling/:taskId/comments` body: `{ body, authorName, attachments[] }` → `TaskComment` (201)
- `DELETE /api/scheduling/comments/:commentId` → 204

## Approach
- Mirror the ChecklistSection component pattern: co-located CSS module, hooks from a dedicated hooks file.
- No file upload — attachments are metadata-only (url + filename).
- Placed after ChecklistSection in the main column for logical flow.
- TDD: tests written before implementation.
