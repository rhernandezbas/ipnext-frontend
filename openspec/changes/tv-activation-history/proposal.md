# TV Activation History — FE Proposal (#5 FE)

## Intent
Add a dedicated subpage for TV activation history visible to operators.
The page surfaces a chronological log (newest first) of every `alta`, `baja`, and `reactivación`
event, with filtering by operator, customer, and date range.

## Scope
- **Route**: `/admin/customers/tv/history` (sibling of existing `/tv` route, under Clientes).
- **Sidebar**: new "Historial TV" child item in the Clientes group, gated by `tv.read`.
- **Page**: `GigaredActivationHistoryPage` — header, filters, DataTable, empty state, loading/error.
- **Hook**: `useGigaredActivationHistory(filter)` in `src/hooks/useGigared.ts`.
- **API**: `gigaredApi.getActivationHistory(filter)` → `TvActivationEvent[]` via `GET /gigared/customers/activation-history`.
- **Types**: `TvActivationEvent`, `ActivationHistoryFilter` in `src/types/gigared.ts`.

## Wire Contract (from BE)
```
GET /api/gigared/customers/activation-history?actorId=&customerId=&from=&to=
→ TvActivationEvent[]  (newest first)

TvActivationEvent {
  id: string
  clientId: string
  customerName?: string
  cic?: string
  eventType: 'alta' | 'baja' | 'reactivacion'
  actorId: string
  actorName: string
  internalId?: string | null
  seq?: number
  contractId?: string
  createdAt: ISO string
}
```

## Approach
- Mirror the GigaredAccountsPage (DataTable + filters + pills + CSS tokens).
- Event type badges: Alta (green), Baja (red), Reactivación (amber) — inline CSS, not reusing StatusBadge to keep exact copy of the chip design.
- Customer name links to `/admin/customers/view/{clientId}` (same pattern as GigaredAccountsPage).
- Date displayed via `formatDateTimeShort` (canonical "DD mmm YYYY - HH:MM").
- Filters are server-side (no client-side buffering), sent on every filter change.
- Sidebar: `matchPaths` on the Clientes group already includes `/admin/customers`, so the history route auto-expands.

## FE Implementation Status
- `TvActivationEvent` + `ActivationHistoryFilter` added to `src/types/gigared.ts`.
- `gigaredApi.getActivationHistory` added to `src/api/gigared.api.ts`.
- `useGigaredActivationHistory` hook added to `src/hooks/useGigared.ts`.
- `GigaredActivationHistoryPage.tsx` + `.module.css` created in `src/pages/crm/`.
- Route added to `src/App.tsx` (under `customers > tv/history`).
- Sidebar entry added to `src/components/organisms/Sidebar/Sidebar.tsx`.
- 24 Vitest tests: 7 hook, 15 page, 2 sidebar — all GREEN, 0 TypeScript errors.
