# Proposal: tickets-statuses-config (#8)

## Intent

Move the Ticket Statuses catalog page (`/admin/tickets/statuses`) inside the
Tickets Settings page (`/admin/tickets/settings`) as a new tab, alongside
Areas and SLA. The standalone route is replaced with a redirect that preserves
existing bookmarks.

## Scope of change

1. **New file** `src/pages/tickets/settings/TicketStatusesBody.tsx` — body-only
   component (no breadcrumb/h1 header) extracted from `TicketStatusesPage.tsx`,
   mirroring `TicketAreasBody.tsx` structure and CSS token conventions.

2. **TicketsSettingsPage.tsx** — adds `{ id: 'statuses', label: 'Estados', content: <TicketStatusesBody /> }`
   to the TABS array.

3. **App.tsx** — standalone `statuses` route changed to `<Navigate to="/admin/tickets/settings" replace />`.
   Lazy `TicketStatusesPage` import removed (no longer needed).

4. **Sidebar.tsx** — `{ to: '/admin/tickets/statuses', label: 'Estados' }` child
   item removed from the Tickets nav group.

5. **TicketStatusesPage.tsx** — deleted (body fully extracted; route redirects).

6. **TicketStatusesPage.test.tsx** — deleted; replaced by `TicketStatusesBody.test.tsx`.

## Permission regression — intentional alignment

The old standalone route was gated at `tickets.read`.
The new settings page is gated at `tickets.manage`.

**Impact**: users with `tickets.read` but NOT `tickets.manage` lose access to
the statuses catalog view. This is an intentional alignment: the statuses
catalog is an admin config concern (same as Areas and SLA, which were already
`tickets.manage`-only). Read-only users are consumers of statuses, not
administrators of them.

**Mitigation**: teams that need read-only status visibility can be granted
`tickets.manage` or can request a future `tickets.config.read` permission split.
