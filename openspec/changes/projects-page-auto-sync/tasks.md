<!-- generated from engram topic_key: sdd/projects-page-auto-sync/tasks -->
## Tasks — projects-page-auto-sync

- [x] T1 (test red): Add "does not render Recargar button" test to SchedulingProjectsPage.test.tsx
- [x] T2 (green): Remove Recargar button + IconRefresh fn + `refetch` from useProjects() destructure in SchedulingProjectsPage.tsx
- [x] T3 (refactor): Export `PROJECTS_KEY` from useProjects.ts
- [x] T4 (test red): Add invalidation tests for useCreateTask, useDeleteTask, useUpdateTask, useUpdateTaskStatus, useCloseTask, useMoveTaskToStage, useBulkMoveTasksToStage — assert each invalidates `['projects']` on success
- [x] T5 (green): Wire PROJECTS_KEY invalidation into each of the 7 task mutations
- [x] T6 (verify): Run full vitest suite
- [x] T7: Commit atomically per logical group (page removal, hook invalidation)
