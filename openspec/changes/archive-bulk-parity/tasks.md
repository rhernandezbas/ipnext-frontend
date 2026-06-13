# Tasks: archive-bulk-parity

## Status: DONE

---

## #6 — Archived tickets query: no status param (already done in main)

- [x] Confirm `TicketsArchivedPage` uses `archivedView` prop → `archived:true`, `status` undefined
- [x] Test: `TicketsListPage.archived.test.tsx` — `archivedView does NOT pass a status to useTicketList` ✅

No code change required. Test already present and passing.

---

## #7 — Remove bulk delete buttons from both views

### Tickets (`TicketsTableView`)

- [x] TDD red: `TicketsTableView.bulk.noDelete.test.tsx` — bulk "Eliminar" absent, "Eliminar definitivamente" absent, "Archivar" present
- [x] Remove bulk "Eliminar" (`tickets.delete`) button from `BulkActionBar` JSX
- [x] Remove bulk "Eliminar definitivamente" (`tickets.delete_hard`) button from `BulkActionBar` JSX
- [x] Remove `onDelete`, `onHardDelete` from `BulkActionBarProps` interface
- [x] Remove `handleDelete`, `handleHardDelete` functions
- [x] Remove `useDeleteTicket`, `useHardDeleteTicket` hook calls
- [x] Remove `BULK_COPY.delete`, `BULK_COPY.hardDelete` entries
- [x] Remove unused `useConfirm` import and call
- [x] Update `TicketsTableView.bulk.archive.test.tsx` — hard-delete describe collapsed to "never present"
- [x] Update `TicketsTableView.bulk.test.tsx` — remove "Eliminar success" toast test
- [x] Update `TicketsTableView.permissions.test.tsx` — 3 tests referencing Eliminar button collapsed/updated
- [x] TDD green: all tests pass ✅

### Tasks (`TasksTableView`)

- [x] TDD red: `TasksTableView.bulk.noHardDelete.test.tsx` — bulk "Eliminar" absent even with `scheduling.hard_delete`
- [x] Remove `{canHardDelete && <Eliminar>}` block from `BulkActionBar` JSX
- [x] Remove `canHardDelete` prop from `BulkActionBarProps` and destructuring
- [x] Remove `onDelete` prop from `BulkActionBarProps` and destructuring
- [x] Remove `handleDelete` function
- [x] Remove `useDeleteTask` hook call and import
- [x] Remove `BULK_COPY.delete` entry
- [x] Remove `canHardDelete` computed var from `TasksTableView`
- [x] TDD green: all tests pass ✅

---

## #12 — Tasks archive: mock → real route

- [x] TDD red: `SchedulingArchiveRoute.test.tsx` — `/archive` renders `SchedulingArchivedTasksPage`, heading "Tareas Archivadas", `archived:true` filter, `readOnly` (no bulk bar)
- [x] `App.tsx`: remove `SchedulingArchivePage` lazy import
- [x] `App.tsx`: repoint `/archive` route to `SchedulingArchivedTasksPage`
- [x] `App.tsx`: remove `/archivadas` route
- [x] Delete `src/pages/scheduling/SchedulingArchivePage.tsx`
- [x] Delete `src/pages/scheduling/SchedulingArchivePage.module.css`
- [x] Delete `src/api/schedulingArchive.api.ts`
- [x] Delete `src/hooks/useSchedulingArchive.ts`
- [x] Delete `src/types/schedulingArchive.ts`
- [x] Delete `src/__tests__/scheduling/SchedulingArchivePage.test.tsx` (tested deleted page)
- [x] `npx tsc --noEmit` clean ✅
- [x] TDD green: all tests pass ✅
