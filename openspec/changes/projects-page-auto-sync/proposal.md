<!-- generated from engram topic_key: sdd/projects-page-auto-sync/proposal -->
## Proposal — projects-page-auto-sync

### Why
Manual refresh button is friction. Users edit tasks elsewhere (board, list, drawer) and have to come back to /admin/scheduling/projects and click Recargar to see updated `taskCounts`. React Query already manages cache — we just need invalidation on the mutations that change task state.

### What
1. Remove the Recargar button + IconRefresh SVG from SchedulingProjectsPage.tsx; drop `refetch` from `useProjects()` destructure.
2. In useScheduling.ts, extend the `onSuccess` of these mutations to ALSO invalidate `['projects']`:
   - useCreateTask, useDeleteTask, useUpdateTask, useUpdateTaskStatus, useCloseTask, useMoveTaskToStage, useBulkMoveTasksToStage
3. Verify useCreateProject already invalidates projects (it does) — no change needed.

### Approach
- Strict TDD: red test asserting button is gone; green by removing it.
- For each scheduling mutation: red test asserting `['projects']` invalidation, green by adding `qc.invalidateQueries({ queryKey: ['projects'] })` to onSuccess.

### Tradeoffs
- Extra invalidations may cause more re-fetches of /api/projects when user is on the projects page AND mutates a task. Acceptable: payload is small and React Query dedupes.
- Alternative: optimistic update of taskCounts inside scheduling mutations. Rejected — adds complexity for marginal gain; server is source of truth for aggregates.
