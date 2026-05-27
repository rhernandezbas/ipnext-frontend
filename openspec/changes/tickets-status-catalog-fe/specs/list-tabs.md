# Spec: TicketsListPage catalog-driven tabs

## Requirements
1. Tabs read from GET /api/tickets/statuses via useTicketStatuses hook
2. One tab per catalog status: shows color dot + status name
3. Fixed "Todos" tab always present (clears status filter)
4. Clicking a tab sets status filter and resets page to 1
5. Active tab highlighted; active catalog tab border uses status color
6. Removed hardcoded STATUS_FILTERS that had "resolved" (orphaned — not a real status)
7. Dropdown STATUS_FILTERS also built from catalog (+ "Todas" option)
8. While catalog loads, only "Todos" tab shown (no flash of hardcoded tabs)

## Scenarios
- Given catalog: [open, pending, closed] → renders 4 buttons (Todos + 3)
- Given user clicks "open" tab → useTicketList called with status="open"
- Given user clicks "Todos" → useTicketList called with status=undefined
- Given "Resuelto" was hardcoded → no longer rendered
