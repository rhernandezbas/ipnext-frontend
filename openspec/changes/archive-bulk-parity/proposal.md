# Proposal: archive-bulk-parity

## Intent

Harden the archive/delete UX across tickets and scheduling tasks to match the backend's
permission model: remove redundant bulk-delete actions and wire the real archived-tasks
route so the mock is gone.

## Scope

- **#6 (tickets archived shows closed)**: `TicketsArchivedPage` already uses `archivedView`
  prop which forces `archived:true` and drops the `status` filter. Already done in main.
  No code change — test confirmed.

- **#7 (bulk delete redundant)**:
  - `TicketsTableView`: Remove bulk "Eliminar" (soft-delete, `tickets.delete`) and
    "Eliminar definitivamente" (hard-delete, `tickets.delete_hard`) from the bulk bar.
    Individual ticket delete/hard-delete actions are unchanged. Keep Asignar, Cambiar estado,
    Cerrar, Archivar, Limpiar.
  - `TasksTableView`: Remove the `{canHardDelete && <Eliminar>}` conditional from the bulk
    bar. Hard-delete remains as a per-row super-admin action. Keep all other bulk actions.

- **#12 (tasks archive mock → real)**:
  - Repoint `/admin/scheduling/archive` route to `SchedulingArchivedTasksPage` (real page
    using `useFilteredTasks({ archived: true })`).
  - Remove the duplicate `/admin/scheduling/archivadas` route.
  - Delete dead files: `SchedulingArchivePage.tsx`, `SchedulingArchivePage.module.css`,
    `schedulingArchive.api.ts`, `useSchedulingArchive.ts`, `schedulingArchive.ts`.

## Approach

Strict TDD: write failing tests first, then make code green.
- New tests: `TicketsTableView.bulk.noDelete.test.tsx`, `TasksTableView.bulk.noHardDelete.test.tsx`,
  `SchedulingArchiveRoute.test.tsx`.
- Updated tests: existing `TicketsTableView.bulk.archive.test.tsx` hard-delete describe block
  collapsed to a single "never present" assertion; `TicketsTableView.bulk.test.tsx` Eliminar
  toast test removed.
- Deleted: `SchedulingArchivePage.test.tsx` (tests deleted page).

## Key decisions

- The backend permission model was already correct. The UI was just exposing extra delete
  buttons that bypass the "archive first" workflow. Removing them enforces the intended flow.
- `useConfirm` removed from `TicketsTableView` BulkActionBar (no longer needed).
- `canHardDelete` / `onDelete` / `useDeleteTask` removed from `TasksTableView` and
  `BulkActionBarProps` since they no longer drive any UI.
