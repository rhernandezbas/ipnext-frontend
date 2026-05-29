<!-- generated from engram topic_key: sdd/projects-page-auto-sync/design -->
## Design — projects-page-auto-sync

### AD-1: Centralize projects query-key constant
Currently `KEY = ['projects']` lives in useProjects.ts (not exported). For cross-hook invalidation we have two options:
- (a) Export `PROJECTS_KEY` from useProjects.ts and import in useScheduling.ts.
- (b) Inline the literal `['projects']` in useScheduling.ts.

Decision: **(a) export const PROJECTS_KEY**. Reason: single source of truth; rename-safe; matches DIP/coupling-minimization principle. Cost is negligible.

### AD-2: Invalidation timing
Use `onSuccess` (not `onSettled`) for everything except bulk operations. The bulk hook already uses `onSettled` to handle partial failures — we add projects invalidation to that same callback. Reason: keep consistency with existing patterns; on partial bulk success, projects counts ARE affected, so invalidating on settle is correct.

### AD-3: No test changes for redundant cases
useCreateProject/useUpdateProject/useDeleteProject already invalidate `['projects']`. No new tests added — existing behavior preserved.

### Files touched
- src/pages/scheduling/SchedulingProjectsPage.tsx — remove IconRefresh fn, remove button, remove `refetch` from useProjects destructure
- src/hooks/useProjects.ts — export PROJECTS_KEY
- src/hooks/useScheduling.ts — import PROJECTS_KEY, invalidate it in onSuccess/onSettled of the 7 task mutations
- src/__tests__/scheduling/SchedulingProjectsPage.test.tsx — assert button absent
- src/__tests__/scheduling/useScheduling.test.ts — add invalidation assertions for the 7 mutations
