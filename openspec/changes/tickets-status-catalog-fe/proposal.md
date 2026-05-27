# Change: tickets-status-catalog-fe

## Intent
Add a frontend admin page for the ticket-status catalog (TicketStatusCatalog table already deployed to prod),
and align TicketsListPage tabs to read statuses from that catalog instead of hardcoded values.

## Scope

### Part A — Admin catalog page
- New page: `src/pages/tickets/TicketStatusesPage.tsx`
- New API file: `src/api/ticketStatuses.api.ts` (mirrors taskPriorities.api.ts pattern)
- New hooks: `src/hooks/useTicketStatuses.ts` (useTicketStatuses / useCreate / useUpdate / useDelete)
- New type: `src/types/ticketStatus.ts`
- Route registered: `/admin/tickets/statuses`
- Sidebar entry: "Estados" under Tickets group
- CSS: reuses `SchedulingTaskCategoriesPage.module.css` (same shape as TaskPriority catalog)

### Part B — Catalog-driven tabs in TicketsListPage
- `src/pages/tickets/TicketsListPage.tsx` updated to import `useTicketStatuses`
- Status tabs rendered per catalog entry (name + color dot) + fixed "Todos" tab
- Removed hardcoded STATUS_FILTERS array (open/pending/resolved/closed — the "resolved" tab was orphaned)
- Dropdown STATUS_FILTERS now also built from the catalog

## Approach
Mirror SchedulingTaskPrioritiesPage exactly (same modal, same table, same CSS module).
TDD: tests written first, implementation follows.

## Backend contract (already deployed)
- GET/POST/PUT/DELETE /api/tickets/statuses
- Shape: { id, name (unique), color, weight, createdAt, updatedAt }
- Seeded: open, pending, closed
