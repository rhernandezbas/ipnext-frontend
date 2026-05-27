# Tasks: task-rv-inventory-fe

- [x] Add `reviewedByInventory: boolean` to `ScheduledTask` type
- [x] Add `setTaskInventoryReview(taskId, reviewed)` to `scheduling.api.ts`
- [x] Add `useSetTaskInventoryReview()` hook to `useScheduling.ts`
- [x] Write `TasksTableView.rv.test.tsx` (TDD — red phase first)
- [x] Add `RvIndicator` atom component to `TasksTableView.tsx`
- [x] Add `RV` entry to `ALL_TASK_COLUMNS`
- [x] Wire `RV` column renderer in `ALL_COLUMNS` using `RvIndicator`
- [x] Add `.rvBtn` / `.rvDot` CSS to `TasksTableView.module.css`
- [x] Patch `TasksTableView.stageSelect.test.tsx` mock to include new hook
- [x] Patch `SchedulingTasksPage.test.tsx` mock + fixture for new hook/field
- [x] All tests green (969/969)
- [x] Commit
