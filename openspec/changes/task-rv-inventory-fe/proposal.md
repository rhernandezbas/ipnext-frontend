# Proposal: task-rv-inventory-fe

## Intent

Add an "RV" (Revisado por Inventario) column to the scheduling tasks table view. The column shows a colour-coded dot (green = reviewed, red = not reviewed) that the user can click to toggle the flag via the backend endpoint `PATCH /api/scheduling/:id/inventory-review`.

## Scope

- `src/types/scheduling.ts` — add `reviewedByInventory: boolean` to `ScheduledTask`
- `src/api/scheduling.api.ts` — add `setTaskInventoryReview(taskId, reviewed)`
- `src/hooks/useScheduling.ts` — add `useSetTaskInventoryReview()` mutation hook
- `src/pages/scheduling/SchedulingTasksPage/components/TasksTableView.tsx` — add `RvIndicator` atom + `RV` column
- `src/pages/scheduling/SchedulingTasksPage/components/TasksTableView.module.css` — RV button/dot styles
- `src/__tests__/scheduling/components/TasksTableView.rv.test.tsx` — new test file (TDD)
- Patch existing test mocks to include the new hook export

## Approach

- Backend contract already deployed; frontend consumes it.
- Strict TDD: tests written first (red), then implementation (green).
- Colour tokens: `#22c55e` (green, matches `hecho` category) and `#ef4444` (red, matches `cancelado` category) — no dedicated semantic token exists for these in `variables.css`.
- The `RV` column is added to `ALL_TASK_COLUMNS` so it is visible in the column-selector UI.

## Status

COMPLETED — committed.
