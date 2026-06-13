# Tasks: tickets-statuses-config (#8)

## Implementation checklist

- [x] Write failing tests (TDD red phase):
  - [x] `src/__tests__/tickets/settings/TicketStatusesBody.test.tsx`
  - [x] `src/__tests__/tickets/TicketsSettingsPage.statuses.test.tsx`
  - [x] `src/__tests__/tickets/statusesRedirect.test.tsx`
- [x] Create `src/pages/tickets/settings/TicketStatusesBody.tsx`
  - [x] Named export `TicketStatusesBody` (body-only, no h1/breadcrumb)
  - [x] Uses same hooks as old page: `useTicketStatuses`, `useCreateTicketStatus`, `useUpdateTicketStatus`, `useDeleteTicketStatus`
  - [x] Write actions wrapped in `<Can permission="tickets.manage">`
  - [x] Uses `TicketAreasBody.module.css` for consistent tokens
- [x] Update `src/pages/tickets/TicketsSettingsPage.tsx` — add statuses tab
- [x] Update `src/App.tsx` — statuses route → Navigate redirect; remove lazy import
- [x] Update `src/components/organisms/Sidebar/Sidebar.tsx` — remove 'Estados' child
- [x] Delete `src/pages/tickets/TicketStatusesPage.tsx`
- [x] Delete `src/__tests__/tickets/TicketStatusesPage.test.tsx`
- [x] Gate: `npx vitest run` on touched test files — all pass
- [x] Gate: `npx tsc --noEmit` — no type errors
