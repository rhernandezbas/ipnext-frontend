<!-- generated from engram topic_key: sdd/projects-page-auto-sync/spec -->
## Spec — projects-page-auto-sync

### REQ-1: SchedulingProjectsPage MUST NOT render a manual refresh button
- Scenario: page renders → no element with title "Recargar" exists
- Scenario: header shows only Añadir + Filtrar (plus modals when triggered)

### REQ-2: Task mutations affecting taskCounts MUST invalidate ['projects']
For each of: useCreateTask, useDeleteTask, useUpdateTask, useUpdateTaskStatus, useCloseTask, useMoveTaskToStage, useBulkMoveTasksToStage:
- Scenario: mutation resolves successfully → react-query invalidates `['projects']` (in addition to existing invalidations)
- Scenario: mutation fails → no invalidation of `['projects']` (use onSuccess/onSettled per existing pattern)

### REQ-3: Project mutations continue to invalidate ['projects']
- useCreateProject, useUpdateProject, useDeleteProject — already satisfied; no regression expected.

### Non-functional
- No new dependencies.
- No CSS changes beyond what removal naturally triggers (IconRefresh + button vanish; no leftover style rules need pruning since they remain valid).
